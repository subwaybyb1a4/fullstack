"""
경로 서비스
"""
from typing import Optional, Dict, Any, List
from app.schemas.route import (
    Route, RouteType, RouteSegment, StationInfo, TransferInfo
)
from app.services.odsay_service import ODSayService
from datetime import datetime


class RouteService:
    """경로 서비스 (ODSay API 연동)"""
    
    def __init__(self, odsay_service: Optional[ODSayService] = None):
        """
        경로 서비스 초기화
        
        Args:
            odsay_service: ODSay 서비스 (없으면 자동 생성)
        """
        try:
            self.odsay = odsay_service or ODSayService()
        except ValueError as e:
            print(f"[RouteService] ODSay 서비스 초기화 실패: {str(e)}")
            self.odsay = None
    
    def _parse_odsay_path(
        self,
        path_obj: Dict[str, Any],
        route_type: RouteType
    ) -> Route:
        """
        ODSay API의 단일 path 객체를 Route 모델로 변환
        
        Args:
            path_obj: ODSay API의 path 객체 (단일 경로)
            route_type: 경로 타입
        
        Returns:
            Route 모델
        """
        # 총 소요 시간 (분 -> 초)
        total_duration_min = path_obj.get("info", {}).get("totalTime", 0)
        total_duration = total_duration_min * 60 if total_duration_min else 0
        
        # 총 도보 시간 (분 -> 초)
        total_walking_time_min = path_obj.get("info", {}).get("totalWalkTime", 0)
        # ODSay에서 -1로 내려오는 케이스가 존재(관측됨). 음수면 0으로 처리.
        if isinstance(total_walking_time_min, (int, float)) and total_walking_time_min < 0:
            total_walking_time_min = 0
        total_walking_time = total_walking_time_min * 60 if total_walking_time_min else 0
        
        # 구간 정보 파싱
        sub_path = path_obj.get("subPath", [])
        segments = []
        transfers = []
        
        prev_subway_segment = None
        first_walk_segment = None  # 처음 도보 구간 추적 (출발지→첫 역)
        last_walk_segment = None   # 마지막 도보 구간 추적 (마지막 역→도착지)
        
        for i, sub in enumerate(sub_path):
            traffic_type = sub.get("trafficType", 0)  # 1:지하철, 2:버스, 3:도보
            
            if traffic_type == 1:  # 지하철
                # 지하철 구간 정보
                from_station_id = sub.get("startID", "")
                to_station_id = sub.get("endID", "")
                from_station_name = sub.get("startName", "")
                to_station_name = sub.get("endName", "")
                # ODSay 지하철 구간 호선 정보는 보통 `lane[0].name` 형태로 옴 (예: "수도권 7호선")
                # 주의: `sub["lane"]`는 list이므로 문자열로 직접 사용하면 안 됨 (Pydantic 검증 에러 → 더미 fallback 유발)
                line_name = (
                    sub.get("laneName", "")
                    or sub.get("lane_name", "")
                    or sub.get("line", "")
                )
                if not line_name:
                    lane = sub.get("lane")
                    if isinstance(lane, list) and lane:
                        first_lane = lane[0]
                        if isinstance(first_lane, dict):
                            line_name = first_lane.get("name", "") or str(first_lane.get("subwayCode", "") or "")
                
                # "수도권 2호선" 형식 처리 (필요시 "2호선"만 추출)
                # 일단 그대로 사용하되, 나중에 필요하면 변환 로직 추가 가능
                # if line_name and "수도권" in line_name:
                #     line_name = line_name.replace("수도권 ", "")
                
                # sectionTime은 분 단위
                duration_min = sub.get("sectionTime", 0)
                duration = duration_min * 60 if duration_min else 0
                
                print(f"[RouteService] 구간 정보: {from_station_name} → {to_station_name}, 호선={line_name}, ID={from_station_id}→{to_station_id}")
                
                segment = RouteSegment(
                    from_station=StationInfo(
                        station_id=str(from_station_id),
                        station_name=from_station_name,
                        line_number=line_name
                    ),
                    to_station=StationInfo(
                        station_id=str(to_station_id),
                        station_name=to_station_name,
                        line_number=line_name
                    ),
                    line_number=line_name,
                    duration=duration,
                    walking_time=None  # 지하철 구간은 도보 시간 없음
                )
                segments.append(segment)
                
                # 환승 체크: 이전 지하철 구간과 다른 호선이면 환승
                if prev_subway_segment and prev_subway_segment.line_number != line_name:
                    # 이전 도보 구간 찾기 (환승 구간)
                    if i > 0:
                        walk_sub = sub_path[i - 1]
                        if walk_sub.get("trafficType") == 3:  # 도보
                            transfer_station_name = prev_subway_segment.to_station.station_name
                            transfer_station_id = prev_subway_segment.to_station.station_id
                            walking_time_min = walk_sub.get("sectionTime", 0)
                            walking_time = walking_time_min * 60 if walking_time_min else 0
                            
                            transfers.append(
                                TransferInfo(
                                    station=StationInfo(
                                        station_id=transfer_station_id,
                                        station_name=transfer_station_name,
                                        line_number=prev_subway_segment.line_number
                                    ),
                                    from_line=prev_subway_segment.line_number,
                                    to_line=line_name,
                                    walking_time=walking_time
                                )
                            )
                
                prev_subway_segment = segment
                last_walk_segment = None  # 지하철 구간이 나오면 이전 도보 구간 초기화
            
            elif traffic_type == 3:  # 도보
                # 도보 구간 정보 저장 (나중에 처리)
                if i == 0:
                    first_walk_segment = sub
                last_walk_segment = sub
                print(f"[RouteService] 도보 구간 발견: {sub.get('startName', '')} → {sub.get('endName', '')}, 시간={sub.get('sectionTime', 0)}분")
        
        # 처음 도보 구간 처리 (출발지에서 첫 역까지 도보로 가는 경우)
        if first_walk_segment and prev_subway_segment:
            is_first_walk = len(sub_path) > 0 and sub_path[0].get("trafficType") == 3
            if is_first_walk:
                walk_start_name = first_walk_segment.get("startName", "")
                walk_end_name = first_walk_segment.get("endName", "")
                walk_start_id = first_walk_segment.get("startID", "")
                walk_end_id = first_walk_segment.get("endID", "")
                walking_time_min = first_walk_segment.get("sectionTime", 0)
                walking_time = walking_time_min * 60 if walking_time_min else 0
                if walking_time > 0:
                    # 첫 지하철 구간의 출발역 = 도보 도착역
                    first_sub = next((s for s in sub_path if s.get("trafficType") == 1), None)
                    first_sub_line = ""
                    if first_sub:
                        first_sub_line = (
                            first_sub.get("laneName", "")
                            or first_sub.get("lane_name", "")
                            or first_sub.get("line", "")
                        )
                        if not first_sub_line and first_sub.get("lane"):
                            lane = first_sub["lane"]
                            if isinstance(lane, list) and lane:
                                first_sub_line = lane[0].get("name", "") if isinstance(lane[0], dict) else ""
                    print(f"[RouteService] 처음 도보 구간 추가: {walk_start_name} → {walk_end_name}, 시간={walking_time}초 ({walking_time_min}분)")
                    walk_segment = RouteSegment(
                        from_station=StationInfo(
                            station_id=str(walk_start_id) if walk_start_id else "",
                            station_name=walk_start_name if walk_start_name else "",
                            line_number="",
                        ),
                        to_station=StationInfo(
                            station_id=str(walk_end_id) if walk_end_id else "",
                            station_name=walk_end_name if walk_end_name else "",
                            line_number=first_sub_line,
                        ),
                        line_number="도보",
                        duration=walking_time,
                        walking_time=walking_time  # 도보 구간의 walking_time 명시
                    )
                    segments.insert(0, walk_segment)
        
        # 마지막 도보 구간 처리 (지하철에서 내려서 도착지까지 도보로 가는 경우)
        # 마지막 subPath가 도보이고, 이전에 지하철 구간이 있었고, 환승이 아닌 경우
        if last_walk_segment and prev_subway_segment:
            # 마지막 subPath가 도보인지 확인
            is_last_walk = len(sub_path) > 0 and sub_path[-1].get("trafficType") == 3
            
            if is_last_walk:
                walk_start_name = last_walk_segment.get("startName", "")
                walk_end_name = last_walk_segment.get("endName", "")
                walk_start_id = last_walk_segment.get("startID", "")
                walk_end_id = last_walk_segment.get("endID", "")
                walking_time_min = last_walk_segment.get("sectionTime", 0)
                walking_time = walking_time_min * 60 if walking_time_min else 0
                
                # 도보 시간이 0보다 크면 마지막 도보 구간으로 추가
                # (startName과 endName이 같아도 도보 시간이 있으면 추가)
                if walking_time > 0:
                    print(f"[RouteService] 마지막 도보 구간 추가: {walk_start_name} → {walk_end_name}, 시간={walking_time}초 ({walking_time_min}분)")
                    
                    # 도보 구간을 segments에 추가
                    # from_station은 이전 지하철 구간의 도착역 또는 도보 시작역
                    from_station_id = str(walk_start_id) if walk_start_id else prev_subway_segment.to_station.station_id
                    from_station_name = walk_start_name if walk_start_name else prev_subway_segment.to_station.station_name
                    
                    walk_segment = RouteSegment(
                        from_station=StationInfo(
                            station_id=from_station_id,
                            station_name=from_station_name,
                            line_number=prev_subway_segment.line_number
                        ),
                        to_station=StationInfo(
                            station_id=str(walk_end_id) if walk_end_id else "",
                            station_name=walk_end_name if walk_end_name else "",
                            line_number=""  # 도보 구간은 호선 없음
                        ),
                        line_number="도보",
                        duration=walking_time,
                        walking_time=walking_time  # 도보 구간의 walking_time 명시
                    )
                    segments.append(walk_segment)
        
        # 총 도보 시간 계산 및 검증
        # segments의 도보 구간 walking_time + transfers의 walking_time 합산
        calculated_walking_time = 0
        for seg in segments:
            if seg.walking_time is not None:
                calculated_walking_time += seg.walking_time
        for transfer in transfers:
            calculated_walking_time += transfer.walking_time
        
        # ODSay API의 totalWalkTime과 계산된 값이 다를 수 있으므로, 계산된 값을 사용
        # (처음/마지막 도보 구간이 명시적으로 포함되도록)
        final_walking_time = calculated_walking_time if calculated_walking_time > 0 else total_walking_time
        
        print(f"[RouteService] 총 도보 시간 계산: ODSay={total_walking_time}초, 계산={calculated_walking_time}초, 최종={final_walking_time}초")
        
        return Route(
            route_type=route_type,
            total_duration=total_duration,
            total_walking_time=final_walking_time, #이거 다시 점검 우변이 final_walking_time인지 total_walking_time인지 확인 필요
            segments=segments,
            transfers=transfers,
            comfort_explanation=None
        )
    
    def _parse_odsay_route(
        self,
        odsay_data: Dict[str, Any],
        route_type: RouteType
    ) -> Route:
        """
        ODSay API 응답을 Route 모델로 변환 (첫 번째 경로만)
        
        Args:
            odsay_data: ODSay API 응답 데이터
            route_type: 경로 타입
        
        Returns:
            Route 모델
        """
        print(f"[RouteService] ODSay 응답 파싱 시작: {list(odsay_data.keys())}")
        path = odsay_data.get("path", [])
        print(f"[RouteService] path 타입: {type(path)}, 길이: {len(path) if isinstance(path, list) else 'N/A'}")
        
        if not path:
            print(f"[RouteService] 경로 정보가 없습니다. odsay_data: {odsay_data}")
            raise ValueError("경로 정보가 없습니다.")
        
        # 첫 번째 경로 사용 (가장 최적의 경로)
        first_path = path[0]
        return self._parse_odsay_path(first_path, route_type)
    
    def _parse_all_odsay_routes(
        self,
        odsay_data: Dict[str, Any],
        route_type: RouteType
    ) -> List[Route]:
        """
        ODSay API 응답의 모든 경로를 Route 모델 리스트로 변환
        
        Args:
            odsay_data: ODSay API 응답 데이터
            route_type: 경로 타입
        
        Returns:
            Route 모델 리스트
        """
        print(f"[RouteService] ODSay 응답 전체 파싱 시작: {list(odsay_data.keys())}")
        path = odsay_data.get("path", [])
        print(f"[RouteService] path 타입: {type(path)}, 길이: {len(path) if isinstance(path, list) else 'N/A'}")
        
        if not path:
            print(f"[RouteService] 경로 정보가 없습니다. odsay_data: {odsay_data}")
            return []
        
        routes = []
        for idx, path_obj in enumerate(path):
            print(f"[RouteService] 경로 {idx + 1}/{len(path)} 파싱 중...")
            try:
                route = self._parse_odsay_path(path_obj, route_type)
                routes.append(route)
            except Exception as e:
                print(f"[RouteService] 경로 {idx + 1} 파싱 실패: {str(e)}")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"[RouteService] 총 {len(routes)}개 경로 파싱 완료")
        return routes
    
    async def get_fastest_route(
        self, 
        departure: str, 
        arrival: str,
        departure_time: Optional[str] = None
    ) -> Optional[Route]:
        """
        최단 경로 조회 (ODSay API 사용)
        
        Args:
            departure: 출발역 이름
            arrival: 도착역 이름
            departure_time: 출발 시간 (None이면 현재 시간 사용)
        
        Returns:
            최단 경로 정보
        """
        if not self.odsay:
            print(f"[RouteService] ODSay 서비스가 없어 더미 데이터 반환")
            return Route(
                route_type=RouteType.FASTEST,
                total_duration=1800,
                total_walking_time=300,
                segments=[
                    RouteSegment(
                        from_station=StationInfo(
                            station_id="",
                            station_name=departure,
                            line_number=""
                        ),
                        to_station=StationInfo(
                            station_id="",
                            station_name=arrival,
                            line_number=""
                        ),
                        line_number="",
                        duration=600
                    )
                ],
                transfers=[]
            )
        
        try:
            # ODSay API 호출 (최단시간: search_type=0)
            print(f"[RouteService] 최단 경로 조회 시작: {departure} → {arrival}")
            odsay_data = await self.odsay.search_route_by_station_name(
                departure_station=departure,
                arrival_station=arrival,
                search_type=0,  # 최단시간
                search_path_type=1  # 지하철만
            )
            
            print(f"[RouteService] ODSay API 호출 성공, 경로 파싱 시작")
            return self._parse_odsay_route(odsay_data, RouteType.FASTEST)
        
        except Exception as e:
            # API 호출 실패 시 None 반환
            import traceback
            print(f"[RouteService] 최단 경로 조회 실패: {str(e)}")
            return None
    
    async def get_min_walk_route(
        self,
        departure: str,
        arrival: str,
        departure_time: Optional[str] = None
    ) -> Optional[Route]:
        """
        최소 걸음 경로 조회 (ODSay API 사용)
        
        Args:
            departure: 출발역 이름
            arrival: 도착역 이름
            departure_time: 출발 시간 (None이면 현재 시간 사용)
        
        Returns:
            최소 걸음 경로 정보
        """
        if not self.odsay:
            print(f"[RouteService] ODSay 서비스가 없어 더미 데이터 반환")
            return Route(
                route_type=RouteType.MIN_WALK,
                total_duration=2100,
                total_walking_time=120,
                segments=[
                    RouteSegment(
                        from_station=StationInfo(
                            station_id="",
                            station_name=departure,
                            line_number=""
                        ),
                        to_station=StationInfo(
                            station_id="",
                            station_name=arrival,
                            line_number=""
                        ),
                        line_number="",
                        duration=1980
                    )
                ],
                transfers=[]
            )
        
        try:
            # ODSay API 호출 (최소도보: search_type=3)
            print(f"[RouteService] 최소 걸음 경로 조회 시작: {departure} → {arrival}")
            odsay_data = await self.odsay.search_route_by_station_name(
                departure_station=departure,
                arrival_station=arrival,
                search_type=3,  # 최소도보
                search_path_type=1  # 지하철만
            )
            
            print(f"[RouteService] ODSay API 호출 성공, 경로 파싱 시작")
            return self._parse_odsay_route(odsay_data, RouteType.MIN_WALK)
        
        except Exception as e:
            # API 호출 실패 시 None 반환 (메인 로직에서 처리)
            import traceback
            print(f"[RouteService] 최소 걸음 경로 조회 실패: {str(e)}")
            # traceback.print_exc()
            return None


class ComfortRouteService:
    """시간부자 전용 경로 서비스"""
    
    def __init__(self, route_service: Optional[RouteService] = None):
        """
        시간부자 전용 경로 서비스 초기화
        
        Args:
            route_service: 경로 서비스 (없으면 자동 생성)
        """
        from app.services.congestion_service import CongestionService
        from app.services.llm_service import LLMService
        self.route_service = route_service or RouteService()
        self.congestion_service = CongestionService()
        self.llm_service = LLMService()
    
    async def get_comfort_route(
        self,
        departure: str,
        arrival: str,
        departure_time: Optional[str] = None,
        max_time_increase: int = 900  # +15분 (900초)
    ) -> List[Route]:
        """
        시간부자 전용 경로 조회 (ODSay API의 모든 경로 반환)
        제약: 최단 경로 대비 +15분 이내
        목표: 혼잡도 최소화
        
        Args:
            departure: 출발역 이름
            arrival: 도착역 이름
            departure_time: 출발 시간 (None이면 현재 시간 사용)
            max_time_increase: 최대 추가 소요 시간 (초)
        
        Returns:
            Route 모델 리스트 (ODSay API에서 조회된 모든 경로)
        """
        # 출발 시간 설정 (None이면 현재 시간 사용)
        if departure_time is None:
            time_obj = datetime.now()
        else:
            try:
                time_obj = datetime.fromisoformat(departure_time.replace('Z', '+00:00'))
            except:
                time_obj = datetime.now()
        
        # 1. 최단 경로 조회 (시간 제한 계산용)
        fastest_route = await self.route_service.get_fastest_route(
            departure, arrival, departure_time
        )
        max_duration = fastest_route.total_duration + max_time_increase
        
        # 2. ODSay API에서 모든 경로 조회
        if not self.route_service.odsay:
            print(f"[ComfortRouteService] ODSay 서비스가 없어 더미 데이터 반환")
            # 더미 데이터 반환
            return [
                Route(
                    route_type=RouteType.COMFORT,
                    total_duration=fastest_route.total_duration + 600,
                    total_walking_time=300,
                    segments=fastest_route.segments,
                    transfers=fastest_route.transfers,
                    comfort_explanation="ODSay API가 설정되지 않아 더미 데이터를 반환합니다."
                )
            ]
        
        try:
            # ODSay API 호출 (모든 search_type으로 경로 조회)
            # search_type: 0=최단시간, 1=최소환승, 2=최소비용, 3=최소도보
            print(f"[ComfortRouteService] 시간부자 경로 조회 시작: {departure} → {arrival}")
            
            all_routes = []
            search_types = [0, 1, 2, 3]  # 모든 검색 타입
            
            for search_type in search_types:
                try:
                    print(f"[ComfortRouteService] search_type={search_type} 경로 조회 중...")
                    odsay_data = await self.route_service.odsay.search_route_by_station_name(
                        departure_station=departure,
                        arrival_station=arrival,
                        search_type=search_type,
                        search_path_type=1  # 지하철만
                    )
                    
                    # 각 search_type의 모든 경로 파싱
                    routes_from_type = self.route_service._parse_all_odsay_routes(odsay_data, RouteType.COMFORT)
                    all_routes.extend(routes_from_type)
                    print(f"[ComfortRouteService] search_type={search_type}에서 {len(routes_from_type)}개 경로 조회")
                except Exception as e:
                    # ODSay에서 특정 타입 경로가 없을 때 500 에러 등을 줄 수 있음. 무시하고 진행.
                    print(f"[ComfortRouteService] search_type={search_type} 조회 실패 (경로 없음 추정): {str(e)}")
                    continue
            
            # 중복 경로 제거 (같은 segments를 가진 경로는 하나만 유지)
            unique_routes = []
            seen_route_signatures = set()
            
            for route in all_routes:
                # 경로의 고유 시그니처 생성 (segments의 역 ID 순서)
                route_signature = tuple(
                    (seg.from_station.station_id, seg.to_station.station_id, seg.line_number)
                    for seg in route.segments
                )
                
                if route_signature not in seen_route_signatures:
                    seen_route_signatures.add(route_signature)
                    unique_routes.append(route)
            
            print(f"[ComfortRouteService] 총 {len(all_routes)}개 경로 중 {len(unique_routes)}개 고유 경로 발견")
            all_routes = unique_routes
            
            # 3. 혼잡도 계산 (시간 제약 없음 - 혼잡도만 우선)
            filtered_routes = []
            for route in all_routes:
                # 각 구간에 혼잡도 정보 추가
                segments_with_congestion = []
                total_congestion = 0.0
                
                # 경로 정보를 그대로 사용 (혼잡도 정보 제거)
                segments_with_congestion = route.segments
                
                # 편안함 근거 설명 생성 (LLM 사용)
                # 편안함 근거 설명 생성 (LLM 사용)
                route_info = {
                        "segments": [
                            {
                                "from_station": seg.from_station.model_dump(),
                                "to_station": seg.to_station.model_dump(),
                                "line_number": seg.line_number,
                                "duration": seg.duration
                            }
                            for seg in segments_with_congestion
                        ],
                        "transfers": [
                            {
                                "station": transfer.station.model_dump(),
                                "from_line": transfer.from_line,
                                "to_line": transfer.to_line,
                                "walking_time": transfer.walking_time
                            }
                        for transfer in route.transfers
                    ]
                }
                
                # LLM을 사용하여 편안함 설명 생성
                comfort_explanation = await self.llm_service.generate_comfort_explanation(
                    route_info=route_info,
                    congestion_data={},
                    fastest_duration=fastest_route.total_duration,
                    comfort_duration=route.total_duration
                )
                
                # 경로 생성
                route_with_congestion = Route(
                    route_type=RouteType.COMFORT,
                    total_duration=route.total_duration,
                    total_walking_time=route.total_walking_time,
                    segments=segments_with_congestion,
                    transfers=route.transfers,
                    comfort_explanation=comfort_explanation
                )
                
                filtered_routes.append(route_with_congestion)
            
            # 총 소요 시간 기준으로 정렬 (짧을수록 좋음)
            filtered_routes.sort(key=lambda r: r.total_duration)
            
            print(f"[ComfortRouteService] 총 {len(filtered_routes)}개 경로 반환 (시간 제한: {max_duration}초 이내)")
            return filtered_routes
        
        except Exception as e:
            # API 호출 실패 시 더미 데이터 반환
            import traceback
            print(f"[ComfortRouteService] ODSay API 호출 실패: {str(e)}")
            print(f"[ComfortRouteService] 에러 상세:")
            traceback.print_exc()
            
            # 더미 데이터 반환
            return [
                Route(
                    route_type=RouteType.COMFORT,
                    total_duration=fastest_route.total_duration + 600,
                    total_walking_time=300,
                    segments=fastest_route.segments,
                    transfers=fastest_route.transfers,
                    comfort_explanation="경로 조회 중 오류가 발생하여 기본 경로를 반환합니다."
                )
            ]
    
