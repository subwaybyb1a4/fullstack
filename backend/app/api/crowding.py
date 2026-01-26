"""
혼잡도 관련 API 라우터
"""
from fastapi import APIRouter, Query
from typing import Optional
from app.services.realtime_service import RealtimeService

router = APIRouter(prefix="/crowding", tags=["crowding"])


@router.get("/train")
async def get_train_congestion(
    line_number: str = Query(..., description="호선"),
    station_id: str = Query(..., description="역 ID"),
    direction: str = Query(..., description="방향")
):
    """
    현재 열차와 다음 열차의 혼잡도 조회
    
    Args:
        line_number: 호선
        station_id: 역 ID
        direction: 방향
    
    Returns:
        열차 혼잡도 정보
    """
    realtime_service = RealtimeService()
    return await realtime_service.get_train_congestion(line_number, station_id, direction)
