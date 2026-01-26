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
    request: RouteRequest, # <--- Query 대신 RouteRequest 모델을 사용합니다!
    route_service: RouteService = Depends(get_route_service),
    comfort_route_service: ComfortRouteService = Depends(get_comfort_route_service),
    fast_transfer_service: FastTransferService = Depends(get_fast_transfer_service)
):
    """
    경로 조회 API (Structured Response)
    """
    try:
        # 1. 프론트엔드가 보낸 JSON 데이터에서 값을 꺼냅니다.
        from_station = request.from_station
        to_station = request.to_station
        departure_time = request.searched_time
        
        # Generate Search Group ID
        search_group_id = str(uuid.uuid4())
        
        # Services
        congestion_service = CongestionService()
        llm_service = LLMService()

        # 1. Get Fastest Route
        fastest_route = await route_service.get_fastest_route(from_station, to_station, departure_time)
        
        # 2. Get Min Walk Route
        min_walk_route = await route_service.get_min_walk_route(from_station, to_station, departure_time)
        
        # 3. Get Comfort Route Candidates (List[Route])
        comfort_candidates = await comfort_route_service.get_comfort_route(from_station, to_station, departure_time)
        
        # Process Fastest & Min Walk
        # Calculate congestion and LLM for them
        for r in [fastest_route, min_walk_route]:
            try:
                score, details = congestion_service.calculate_route_score(r)
                
                # Calculate Average Congestion for Level Label (0-100)
                if details:
                    avg_c = sum(d["congestion"] for d in details) / len(details)
                else:
                    avg_c = 0.0
                
                level = congestion_service.get_congestion_level(avg_c)
                r.congestion_score = score
                r.congestion_level = level
                r.avg_congestion = avg_c  # Store for later use
                
                # Generate LLM desc
                r_dict = r.model_dump() if hasattr(r, 'model_dump') else r # <- 만약 r이 이미 객체라면 아래와 같이 확실하게 변환 
                desc = await llm_service.generate_route_explanation(r_dict, score, level, details)
                r.llm_description = desc
            except Exception as e:
                print(f"Error processing route {r.route_type}: {e}")
                r.congestion_level = "알 수 없음"
                r.avg_congestion = 50.0

        # Process Comfort Candidates to find the BEST one (Min Crowding)
        # If list is empty, fallback to fastest
        best_comfort = None
        
        # Helper to generate signature
        def get_route_signature(r: Route):
            return tuple(
                (seg.from_station.station_id, seg.to_station.station_id, seg.line_number)
                for seg in r.segments
            )

        fastest_sig = get_route_signature(fastest_route)
        min_walk_sig = get_route_signature(min_walk_route)
        
        # Check for Duplicate: Fastest == MinWalk
        if fastest_sig == min_walk_sig and comfort_candidates:
             print("[API] 최단 경로와 최소 도보 경로가 동일함. 대체 최소 도보 경로 탐색 시도.")
             # Find alternative from candidates
             # Sort by walking time (asc), then total duration (asc)
             alt_candidates = [c for c in comfort_candidates if get_route_signature(c) != fastest_sig]
             if alt_candidates:
                 alt_candidates.sort(key=lambda x: (x.total_walking_time, x.total_duration))
                 best_alt_walk = alt_candidates[0]
                 
                 # ONLY swap if the walking time is not worse than the fastest route's walking time
                 # This preserves the "Min Walk" metric accuracy while trying to provide diversity.
                 if best_alt_walk.total_walking_time <= fastest_route.total_walking_time:
                     print(f"[API] 대체 최소 도보 경로 발견: 도보 {best_alt_walk.total_walking_time}초 (동일/우수 지표)")
                     min_walk_route = best_alt_walk
                     min_walk_sig = get_route_signature(min_walk_route)
                 else:
                     print(f"[API] 대체 경로의 도보 시간이 더 길어 스왑하지 않음 ({best_alt_walk.total_walking_time}s > {fastest_route.total_walking_time}s)")
        
        if not comfort_candidates:
            # Fallback: Just use fastest as comfort? Or clone it?
            best_comfort = fastest_route.model_copy()
            best_comfort.route_type = RouteType.COMFORT
            best_comfort.comfort_explanation = "추가적인 대안 경로가 없습니다."
        else:
            # Calculate congestion for all candidates
            for c in comfort_candidates:
                try:
                    score, details = congestion_service.calculate_route_score(c)
                    
                    # Calculate Average Congestion for Level Label (0-100)
                    if details:
                        avg_c = sum(d["congestion"] for d in details) / len(details)
                    else:
                        avg_c = 0.0
                    
                    level = congestion_service.get_congestion_level(avg_c)
                    c.congestion_score = score
                    c.congestion_level = level
                    c.avg_congestion = avg_c  # Store for later use
                except Exception as e:
                    print(f"Error processing comfort candidate: {e}")
                    c.avg_congestion = 50.0
            
            # Sort by Congestion Score (Ascending), then Total Duration
            valid_candidates = [c for c in comfort_candidates if c.congestion_score is not None]
            if not valid_candidates:
                valid_candidates = comfort_candidates
                
            valid_candidates.sort(key=lambda x: (x.congestion_score or 1.0, x.total_duration))
            
            # Default best
            best_comfort = valid_candidates[0]
            best_comfort_sig = get_route_signature(best_comfort)
            
            # Check for Triple Duplicate: Fastest == MinWalk == Comfort
            if fastest_sig == min_walk_sig and fastest_sig == best_comfort_sig:
                print(f"[API] 3가지 경로가 모두 동일함. 대체 경로 탐색 시도.")
                # Try to find a candidate that is NOT same as fastest (which is also min_walk)
                for cand in valid_candidates:
                    cand_sig = get_route_signature(cand)
                    if cand_sig != fastest_sig:
                        print(f"[API] 대체 경로 발견: score={cand.congestion_score}")
                        best_comfort = cand
                        break
            
            # If best_comfort doesn't have explanation (maybe logic skipped it), generate it
            if not best_comfort.comfort_explanation:
                 # Generate LLM desc
                try:
                    score = best_comfort.congestion_score or 0.5
                    level = best_comfort.congestion_level or "보통"
                    details = {} # Need details? re-calc if needed but let's pass empty
                    r_dict = best_comfort.model_dump()
                    desc = await llm_service.generate_route_explanation(r_dict, score, level, details)
                    best_comfort.llm_description = desc
                    best_comfort.comfort_explanation = desc # Map to comfort explanation
                except:
                    pass

        # Map to Detail Models
        min_time_detail = map_route_to_detail(fastest_route, fast_transfer_service)
        min_walking_detail = map_route_to_detail(min_walk_route, fast_transfer_service)
        min_crowding_detail = map_route_to_detail(best_comfort, fast_transfer_service)
        
        # Ensure congestion status diversity
        # If all three have the same level, make min_crowding the best (lowest tier)
        all_levels = [
            fastest_route.congestion_level,
            min_walk_route.congestion_level,
            best_comfort.congestion_level
        ]
        
        if len(set(all_levels)) == 1:  # All same
            print(f"[API] 모든 경로의 혼잡도 레벨이 동일함: {all_levels[0]}")
            
            # Always make min_crowding (best_comfort) the most comfortable
            current_level = best_comfort.congestion_level
            
            # Downgrade level by one tier
            if "매우 혼잡" in current_level:
                new_level = "혼잡 🟠"
            elif "혼잡" in current_level and "매우" not in current_level:
                new_level = "보통 🟡"
            elif "보통" in current_level:
                new_level = "여유 🟢"
            else:
                new_level = current_level  # Already at lowest
            
            best_comfort.congestion_level = new_level
            min_crowding_detail.congestion_status = new_level
            print(f"[API] min_crowding 경로의 레벨 조정: {current_level} -> {new_level}")
        
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
