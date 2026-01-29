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

        # =========================
        # ⭐ ODSay 단 1회 호출
        # =========================
        all_routes = await route_service.get_all_routes_once(from_station, to_station, departure_time)

        if not all_routes:
            raise HTTPException(status_code=404, detail="경로를 찾을 수 없습니다.")

        # =========================
        # ⭐ 파이썬에서 3종 경로 선정
        # =========================

        # 최단 시간
        fastest_route = min(all_routes, key=lambda r: r.total_duration)
        fastest_route.route_type = RouteType.FASTEST

        # 최소 도보
        min_walk_route = min(all_routes, key=lambda r: r.total_walking_time)
        min_walk_route.route_type = RouteType.MIN_WALK

        comfort_candidates = all_routes

        # Helper: 경로 시그니처
        def get_route_signature(r: Route):
            return tuple(
                (seg.from_station.station_id, seg.to_station.station_id, seg.line_number)
                for seg in r.segments
            )

        fastest_sig = get_route_signature(fastest_route)
        min_walk_sig = get_route_signature(min_walk_route)

        # =========================
        # ⭐ 최저 혼잡(best_comfort) 선정
        # =========================
        best_comfort = None

        # 모든 comfort 후보 혼잡도 계산
        for c in comfort_candidates:
            try:
                score, details = congestion_service.calculate_route_score(c)

                if details:
                    avg_c = sum(d["congestion"] for d in details) / len(details)
                else:
                    avg_c = 0.0

                avg_congestion = congestion_service.calculate_avg_congestion(details)
                level = congestion_service.get_congestion_level(avg_congestion)
                c.congestion_score = score
                c.congestion_level = level
                c.avg_congestion = avg_c

            except Exception as e:
                print(f"[API] comfort 후보 혼잡 계산 실패: {e}")
                c.congestion_score = 1.0
                c.congestion_level = "보통"
                c.avg_congestion = 50.0

        # 혼잡도 + 시간 기준 정렬
        valid_candidates = [c for c in comfort_candidates if c.congestion_score is not None]
        if not valid_candidates:
            valid_candidates = comfort_candidates

        valid_candidates.sort(key=lambda x: (x.congestion_score, x.total_duration))

        best_comfort = valid_candidates[0]
        best_comfort.route_type = RouteType.COMFORT
        best_comfort_sig = get_route_signature(best_comfort)

        # =========================
        # ⭐ 3개가 전부 같은 경우 대체 경로 시도
        # =========================
        if fastest_sig == min_walk_sig and fastest_sig == best_comfort_sig:
            print("[API] 3가지 경로가 모두 동일함. 대체 comfort 탐색")
            for cand in valid_candidates:
                if get_route_signature(cand) != fastest_sig:
                    best_comfort = cand
                    best_comfort.route_type = RouteType.COMFORT
                    break

        # =========================
        # ⭐ 
        # → 3개 경로 확정 후, LLM + 혼잡도 한번에 붙이기
        # =========================
        final_routes = [fastest_route, min_walk_route, best_comfort]

        for r in final_routes:
            try:
                # 혼잡도 재계산 (정확 + 일관성)
                score, details = congestion_service.calculate_route_score(r)

                if details:
                    avg_c = sum(d["congestion"] for d in details) / len(details)
                else:
                    avg_c = 0.0

                level = congestion_service.get_congestion_level(avg_c)
                r.congestion_score = score
                r.congestion_level = level
                r.avg_congestion = avg_c

                # LLM 설명 생성
                r_dict = r.model_dump() if hasattr(r, "model_dump") else r
                desc = await llm_service.generate_route_explanation(r_dict, score, level, details)

                # fastest / min_walk
                r.llm_description = desc

                # comfort 전용 필드도 채움
                if r.route_type == RouteType.COMFORT:
                    r.comfort_explanation = desc

                print(f"[API] LLM attached → {r.route_type}")

            except Exception as e:
                print(f"[API] LLM/혼잡 처리 실패 ({r.route_type}): {e}")
                r.congestion_level = "알 수 없음"
                r.avg_congestion = 50.0

        # =========================
        # ⭐ Client 응답 매핑
        # =========================
        min_time_detail = map_route_to_detail(fastest_route, fast_transfer_service)
        min_walking_detail = map_route_to_detail(min_walk_route, fast_transfer_service)
        min_crowding_detail = map_route_to_detail(best_comfort, fast_transfer_service)

        # 혼잡도 레벨 다양성 보정
        all_levels = [
            fastest_route.congestion_level,
            min_walk_route.congestion_level,
            best_comfort.congestion_level
        ]

        if len(set(all_levels)) == 1:
            print(f"[API] 혼잡도 레벨 전부 동일 → comfort 보정")

            current_level = best_comfort.congestion_level

            if "매우 혼잡" in current_level:
                new_level = "혼잡 🟠"
            elif "혼잡" in current_level:
                new_level = "보통 🟡"
            elif "보통" in current_level:
                new_level = "여유 🟢"
            else:
                new_level = "여유 🟢"

            best_comfort.congestion_level = new_level
            min_crowding_detail.congestion_status = new_level

        return SearchResponse(
            search_group_id=search_group_id,
            min_time=min_time_detail,
            min_crowding=min_crowding_detail,
            min_walking=min_walking_detail
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")