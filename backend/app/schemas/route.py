"""
경로 관련 스키마 모델 정의
"""
from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum


class RouteType(str, Enum):
    """경로 타입"""
    FASTEST = "fastest"  # 최단 경로
    MIN_WALK = "min_walk"  # 최소 걸음 경로
    COMFORT = "comfort"  # 시간부자 전용 경로


class CongestionLevel(str, Enum):
    """혼잡도 레벨"""
    SPACIOUS = "여유"  # 여유
    NORMAL = "보통"  # 보통
    CROWDED = "혼잡"  # 혼잡


class StationInfo(BaseModel):
    """역 정보"""
    station_id: str = Field(..., description="역 ID")
    station_name: str = Field(..., description="역 이름")
    line_number: str = Field(..., description="호선")


class TransferInfo(BaseModel):
    """환승 정보"""
    station: StationInfo = Field(..., description="환승역")
    from_line: str = Field(..., description="출발 호선")
    to_line: str = Field(..., description="도착 호선")
    walking_time: int = Field(..., description="도보 시간 (초)")
    has_stairs: bool = Field(default=False, description="계단 유무")
    has_escalator: bool = Field(default=False, description="에스컬레이터 유무")
    has_elevator: bool = Field(default=False, description="엘리베이터 유무")


class RouteSegment(BaseModel):
    """경로 구간"""
    from_station: StationInfo = Field(..., description="출발역")
    to_station: StationInfo = Field(..., description="도착역")
    line_number: str = Field(..., description="호선")
    duration: int = Field(..., description="소요 시간 (초)")
    walking_time: Optional[int] = Field(None, description="도보 시간 (초)")
    congestion_score: Optional[float] = Field(None, description="혼잡도 점수 (0-1, 낮을수록 덜 혼잡)")
    congestion_level: Optional[CongestionLevel] = Field(None, description="혼잡도 레벨")


class Route(BaseModel):
    """경로 정보"""
    model_config = {"extra": "allow"}  # Allow dynamic fields like avg_congestion
    
    route_type: RouteType = Field(..., description="경로 타입")
    total_duration: int = Field(..., description="총 소요 시간 (초)")
    total_walking_time: int = Field(..., description="총 도보 시간 (초)")
    segments: List[RouteSegment] = Field(..., description="경로 구간 리스트")
    transfers: List[TransferInfo] = Field(default_factory=list, description="환승 정보 리스트")
    comfort_explanation: Optional[str] = Field(None, description="편안함 근거 설명 (시간부자 경로용)")
    congestion_score: Optional[float] = Field(None, description="혼잡도 점수")
    congestion_level: Optional[str] = Field(None, description="혼잡도 레벨")
    llm_description: Optional[str] = Field(None, description="LLM 생성 설명")
    num_transfers: Optional[int] = Field(None, description="환승 횟수")


class RouteRequest(BaseModel):
    """경로 조회 요청"""
#    departure_station: str = Field(..., description="출발역 이름 또는 ID")
#    arrival_station: str = Field(..., description="도착역 이름 또는 ID")
#    departure_time: Optional[str] = Field(None, description="출발 시간 (ISO 8601 형식, 선택사항)")
    from_station: str = Field(..., description="출발역 이름 또는 ID")
    to_station: str = Field(..., description="도착역 이름 또는 ID")
    searched_time: Optional[str] = Field(None, description="출발 시간 (ISO 8601 형식, 선택사항)")


class RouteResponse(BaseModel):
    """경로 조회 응답 (Legacy)"""
    departure_station: StationInfo = Field(..., description="출발역 정보")
    arrival_station: StationInfo = Field(..., description="도착역 정보")
    routes: List[Route] = Field(..., description="경로 리스트 (최단, 최소걸음, 시간부자 전용)")


# === New Schemas for Structured Response ===

class SegmentType(str, Enum):
    SUBWAY = "subway"
    WALK = "walk"
    TRANSFER = "transfer"

class SegmentResponse(BaseModel):
    type: SegmentType = Field(..., description="구간 타입 (subway, walk, transfer)")
    label: str = Field(..., description="라벨 (2호선, 환승, 8호선 등)")
    minutes: int = Field(..., description="구간 소요 시간 (분)")
    start_station_name: Optional[str] = Field(None, description="출발역 이름 (지하철 타입일 경우 필수)")
    end_station_name: Optional[str] = Field(None, description="도착역 이름 (지하철 타입일 경우 필수)")
    fast_transfer_door: Optional[str] = Field(None, description="빠른 환승 위치 (예: '5-1')")

class RouteDetail(BaseModel):
    route_id: str = Field(..., description="경로 고유 ID")
    congestion_status: str = Field(..., description="혼잡도 배지 내용 (여유, 보통, 혼잡)")
    total_time: int = Field(..., description="총 소요 시간 (분)")
    arrival_time: str = Field(..., description="도착 시각 (HH:MM)")
    total_walk_time: int = Field(..., description="총 도보 시간 (분)")
    transfer_count: int = Field(..., description="환승 횟수")
    segments: List[SegmentResponse] = Field(..., description="경로 구간 배열")
    summary: Optional[str] = Field(None, description="AI 꿀팁 한줄")

class SearchResponse(BaseModel):
    search_group_id: str = Field(..., description="검색 결과 묶음 ID")
    min_time: RouteDetail = Field(..., description="최단 시간 경로")
    min_crowding: RouteDetail = Field(..., description="덜 붐비는 경로")
    min_walking: RouteDetail = Field(..., description="최소 도보 경로")
