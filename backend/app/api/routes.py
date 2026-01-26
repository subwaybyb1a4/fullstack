"""
경로 조회 API 라우터
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, List
import uuid
import hashlib
from datetime import datetime, timedelta
from app.schemas.route import (
    RouteResponse, StationInfo, Route, RouteType, 
    SearchResponse, RouteDetail, SegmentResponse, SegmentType, RouteRequest
)
from app.services.route_service import RouteService, ComfortRouteService
from app.services.odsay_service import ODSayService
from app.services.congestion_service import CongestionService
from app.services.llm_service import LLMService
from app.services.fast_transfer_service import FastTransferService

router = APIRouter(prefix="/routes", tags=["routes"])


def get_route_service() -> RouteService:
    """경로 서비스 의존성 주입"""
    odsay_service = None
    try:
        odsay_service = ODSayService()
        print(f"[API] ODSay 서비스 초기화 성공")
    except ValueError as e:
        print(f"[API] ODSay 서비스 초기화 실패: {str(e)}")
        odsay_service = None
    except Exception as e:
        print(f"[API] ODSay 서비스 초기화 중 예외 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        odsay_service = None
    return RouteService(odsay_service=odsay_service)


def get_comfort_route_service(route_service: RouteService = Depends(get_route_service)) -> ComfortRouteService:
    """시간부자 경로 서비스 의존성 주입"""
    return ComfortRouteService(route_service=route_service)


def get_fast_transfer_service() -> FastTransferService:
    """빠른 환승 서비스 의존성 주입"""
    return FastTransferService()


def map_route_to_detail(route: Route, fast_transfer_service: FastTransferService = None) -> RouteDetail:
    """Route 객체를 RouteDetail(Client용)로 변환"""
    
    # Generate deterministic route_id from route signature
    route_signature = tuple(
        (seg.from_station.station_id, seg.to_station.station_id, seg.line_number)
        for seg in route.segments
    )
    signature_str = str(route_signature)
    route_id = hashlib.md5(signature_str.encode()).hexdigest()
    
    # 1. Total Time (minutes)
    total_time = round(route.total_duration / 60)
    
    # 2. Arrival Time
    now = datetime.now()
    arrival_dt = now + timedelta(seconds=route.total_duration)
    # 24시간 형식 "HH:MM"
    arrival_time = arrival_dt.strftime("%H:%M")
    
    # 3. Total Walk Time (minutes)
    total_walk_time = round(route.total_walking_time / 60)
    
    # 4. Transfer Count
    transfer_count = len(route.transfers)
    
    # 5. Congestion Status
    congestion_status = "보통"
    if route.congestion_level:
        congestion_status = route.congestion_level
    
    # 6. Segments Construction
    # Interleave Subways with Transfer Walks
    new_segments = []
    
    transfer_idx = 0
    
    for i, seg in enumerate(route.segments):
        # Determine segment type and label
        seg_type = SegmentType.SUBWAY
        label = seg.line_number
        
        # Check if it is a walk segment
        # RouteService might label it "도보" or use empty line_number with walking logic
        is_walk_seg = (seg.line_number == "도보")
        
        start_name = None
        end_name = None
        fast_transfer_door = None
        
        if is_walk_seg:
            seg_type = SegmentType.WALK
            label = "도보"
        else:
            seg_type = SegmentType.SUBWAY
            label = seg.line_number
            if "수도권" in label:
                label = label.replace("수도권 ", "")
            if "호선" in label:
                label = label.replace("호선", "")
            
            # Populate start/end names for subway segments
            start_name = seg.from_station.station_name
            end_name = seg.to_station.station_name
            
            # Check for Fast Transfer Info (if next segment implies transfer)
            # Conditions:
            # 1. Current is Subway
            # 2. Next segment exists and logic says it's a transfer flow (different line)
            # OR checking transfer info.
            
            # Look ahead for transfer
            if i < len(route.segments) - 1:
                next_seg = route.segments[i+1]
                # If next is SUBWAY (with diff line) -> Transfer happens at 'end_name'
                # If next is WALK (Transfer Walk) -> Transfer happens at 'end_name'
                
                # Logic: If I am getting off at 'end_name' to transfer to 'next_line'
                # Find 'next_line'
                next_line = None
                if next_seg.line_number == "도보":
                    # Look further ahead for the line we are transferring TO
                    if i + 2 < len(route.segments):
                         next_next_seg = route.segments[i+2]
                         if next_next_seg.line_number != "도보":
                             next_line = next_next_seg.line_number
                else:
                    if next_seg.line_number != seg.line_number:
                        next_line = next_seg.line_number
                
                if next_line:
                    # Clean line names for matching ("수도권 4호선" -> "4호선")
                    curr_line_clean = seg.line_number.replace("수도권 ", "")
                    next_line_clean = next_line.replace("수도권 ", "")
                    
                    if fast_transfer_service:
                         door = fast_transfer_service.get_fast_transfer(
                             station_name=end_name,
                             station_id=seg.to_station.station_id,
                             from_line=curr_line_clean,
                             to_line=next_line_clean
                         )
                         if door:
                             fast_transfer_door = door

        # Duration in minutes
        minutes = round(seg.duration / 60)
        # If less than 1 min but exists, show 1 min? Or 0? 
        if minutes == 0 and seg.duration > 0:
            minutes = 1
            
        new_segments.append(SegmentResponse(
            type=seg_type, 
            label=label, 
            minutes=minutes,
            start_station_name=start_name,
            end_station_name=end_name,
            fast_transfer_door=fast_transfer_door
        ))
        
        # Insert Transfer if needed
        # Condition: Current is Subway, Next is Subway, Lines differ
        if i < len(route.segments) - 1:
            next_seg = route.segments[i+1]
            curr_is_sub = (seg.line_number != "도보")
            next_is_sub = (next_seg.line_number != "도보")
            
            if curr_is_sub and next_is_sub and seg.line_number != next_seg.line_number:
                # Use transfer info if available
                trans_min = 5 # Default fallback
                if transfer_idx < len(route.transfers):
                    trans_info = route.transfers[transfer_idx]
                    trans_min = round(trans_info.walking_time / 60)
                    if trans_min == 0 and trans_info.walking_time > 0:
                        trans_min = 1
                    transfer_idx += 1
                
                new_segments.append(SegmentResponse(type=SegmentType.TRANSFER, label="환승", minutes=trans_min))

    # 7. Summary
    # Use comfort_explanation if comfort route, otherwise llm_description
    summary = route.llm_description
    if route.route_type == RouteType.COMFORT and route.comfort_explanation:
        summary = route.comfort_explanation

    return RouteDetail(
        route_id=route_id,
        congestion_status=congestion_status,
        total_time=total_time,
        arrival_time=arrival_time,
        total_walk_time=total_walk_time,
        transfer_count=transfer_count,
        segments=new_segments,
        summary=summary
    )

# 1. @router.get("") 대신 @router.post("/search")로 변경하여 주소와 방식을 맞춥니다.
@router.post("/search", response_model=SearchResponse)
async def get_routes(
    request: RouteRequest,
    route_service: RouteService = Depends(get_route_service),
    comfort_route_service: ComfortRouteService = Depends(get_comfort_route_service),
    fast_transfer_service: FastTransferService = Depends(get_fast_transfer_service)
):
    """
    경로 조회 API (Structured Response)
    """
    try:
        from_station = request.from_station
        to_station = request.to_station
        departure_time = request.searched_time
        
        search_group_id = str(uuid.uuid4())
        
        congestion_service = CongestionService()
        llm_service = LLMService()

        # 1. 모든 경로 후보군 조회
        # (1) 최단 경로
        fastest_route = await route_service.get_fastest_route(from_station, to_station, departure_time)
        if fastest_route:
            fastest_route.route_type = RouteType.FASTEST
        
        # (2) 최소 도보 경로
        min_walk_route = await route_service.get_min_walk_route(from_station, to_station, departure_time)
        if min_walk_route:
            min_walk_route.route_type = RouteType.MIN_WALK
        
        # (3) 쾌적(편안) 경로 후보들
        comfort_candidates = await comfort_route_service.get_comfort_route(from_station, to_station, departure_time)
        for c in comfort_candidates:
            c.route_type = RouteType.COMFORT

        # 2. 후보군 통합 및 중복 제거
        candidates = []
        if fastest_route: candidates.append(fastest_route)
        if min_walk_route: candidates.append(min_walk_route)
        if comfort_candidates: candidates.extend(comfort_candidates)
        
        unique_map = {}
        
        def get_route_signature(r: Route):
            # 지하철 구간만 추출하여 시그니처 생성 (도보 차이 무시)
            subway_sigs = []
            for seg in r.segments:
                if seg.line_number != "도보":
                    # 호선 명 정규화 (띄어쓰기, '수도권' 제거)
                    # 예: "수도권 4호선" -> "4호선"
                    line = seg.line_number.replace("수도권", "").strip()
                    subway_sigs.append((seg.from_station.station_id, seg.to_station.station_id, line))
            
            # 만약 지하철 구간이 하나도 없으면(도보 전용?), 전체 구간 사용
            if not subway_sigs:
                return tuple(
                    (seg.from_station.station_id, seg.to_station.station_id, seg.line_number)
                    for seg in r.segments
                )
            
            return tuple(subway_sigs)
        
        for r in candidates:
            sig = get_route_signature(r)
            # 중복되면 먼저 들어온 것(Fastest -> MinWalk -> Comfort 순)을 유지
            if sig not in unique_map:
                unique_map[sig] = r
        
        unique_routes = list(unique_map.values())
        
        if not unique_routes:
            # Fallback (Should not happen unless API fails completely)
            raise HTTPException(404, "경로를 찾을 수 없습니다.")

        # 3. 혼잡도 점수 계산 및 LLM 설명 생성 (모든 유니크 경로에 대해)
        for r in unique_routes:
            try:
                # 이미 계산된 경우 스킵 (Comfort 등)
                if r.congestion_score is None:
                    score, details = congestion_service.calculate_route_score(r)
                    if details:
                        avg_c = sum(d["congestion"] for d in details) / len(details)
                    else:
                        avg_c = 0.0
                    
                    level = congestion_service.get_congestion_level(avg_c)
                    r.congestion_score = score
                    r.congestion_level = level
                    r.avg_congestion = avg_c
                
                # LLM 설명이 없으면 생성
                if not r.llm_description and not r.comfort_explanation:
                    r_dict = r.model_dump()
                    # 점수/레벨은 위에서 계산됨
                    details = [] # 재계산 안함
                    desc = await llm_service.generate_route_explanation(r_dict, r.congestion_score, r.congestion_level, details)
                    r.llm_description = desc
                elif r.comfort_explanation:
                    r.llm_description = r.comfort_explanation

            except Exception as e:
                print(f"[API] 경로 처리 중 오류: {e}")
                r.congestion_level = "알 수 없음"

        # 4. 최종 3개 선정 전략
        # 전략: 
        # 1. Global Min Time (무조건 포함)
        # 2. Global Min Walk (무조건 포함)
        # 3. 나머지 중 혼잡도 점수(congestion_score)가 가장 낮은 것
        
        global_min_time = min(r.total_duration for r in unique_routes)
        global_min_walk = min(r.total_walking_time for r in unique_routes)
        
        selected_routes = []
        
        # (1) 최단 시간 경로 찾기
        p1 = next((r for r in unique_routes if r.total_duration == global_min_time), unique_routes[0])
        selected_routes.append(p1)
        
        # (2) 최소 도보 경로 찾기 (p1과 다르면 추가)
        p2 = next((r for r in unique_routes if r.total_walking_time == global_min_walk), None)
        if p2 and p2 not in selected_routes:
            selected_routes.append(p2)
            
        # (3) 나머지 중 혼잡도 낮은 순으로 채우기
        remaining = [r for r in unique_routes if r not in selected_routes]
        remaining.sort(key=lambda x: (x.congestion_score or 9999, x.total_duration))
        
        while len(selected_routes) < 3 and remaining:
            selected_routes.append(remaining.pop(0))
            
        # 5. 태그(뱃지) 부여 및 Detail 변환
        final_details = []
        
        # 선정된 경로들 중에서의 최소값들 (다시 계산)
        # (전체가 아니라 보여지는 것들 중에서 '최단', '최소도보'라고 붙여야 의미가 있음... 
        #  하지만 사용자는 '전체' 중에서 최단인걸 기대하므로 global 값을 써야 함.
        #  만약 global min time 경로가 selected에 없다면? (그럴 리 없음, p1에서 넣었으니))
        
        # 덜 붐빔은 selected 중에서 가장 점수가 낮은 것? 아니면 global?
        # 보통 3개 중에 "이게 젤 덜 붐벼" 라고 알려주는 게 좋음.
        min_cong_score_in_selected = min((r.congestion_score or 9999) for r in selected_routes)
        
        for r in selected_routes:
            detail = map_route_to_detail(r, fast_transfer_service)
            tags = []
            
            # 태그 조건
            is_min_time = (r.total_duration == global_min_time)
            is_min_walk = (r.total_walking_time == global_min_walk)
            is_min_crowd = ((r.congestion_score or 9999) == min_cong_score_in_selected)
            
            if is_min_time:
                tags.append("min_time")
            if is_min_walk:
                tags.append("min_walking")
            if is_min_crowd:
                # 만약 최단시간인데 덜 붐비기까지 하면 둘 다.
                # 하지만, 모든 경로가 동일하면(하나만 나오면) 다 붙으면 좀 이상할 수 있음.
                # 경로가 1개뿐이면 태그를 다 붙일까? -> OK. "완벽한 경로" 느낌.
                tags.append("min_crowding")
                
            # 중복 태그 제거 (List set)
            tags = list(set(tags))
            detail.tags = tags
            
            # [요청사항 반영] 덜 붐빔 태그가 있으면 혼잡도 레벨 한 단계 낮추기 (UI용)
            if "min_crowding" in tags:
                current_level = detail.congestion_status
                new_level = current_level
                if "매우 혼잡" in current_level:
                    new_level = "혼잡 🟠"
                elif "혼잡" in current_level and "매우" not in current_level:
                    new_level = "보통 🟡"
                elif "보통" in current_level:
                    new_level = "여유 🟢"
                
                if new_level != current_level:
                    print(f"[API] 덜 붐빔 보정: {current_level} -> {new_level}")
                    detail.congestion_status = new_level

            final_details.append(detail)
            
        return SearchResponse(
            search_group_id=search_group_id,
            routes=final_details,
            # Legacy fields - Optional이므로 None이어도 되지만, 호환성을 위해 첫번째 것 등등 넣어줌
            min_time=final_details[0] if final_details else None,
            min_crowding=final_details[0] if final_details else None,
            min_walking=final_details[0] if final_details else None,
            alternatives=[]
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

