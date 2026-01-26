"""
설명 관련 API 라우터 (편안함 근거 설명 등)
"""
from fastapi import APIRouter, Query
from typing import Optional
from app.services.llm_service import LLMService

router = APIRouter(prefix="/explain", tags=["explain"])


@router.get("/comfort")
async def get_comfort_explanation(
    route_id: Optional[str] = Query(None, description="경로 ID"),
    route_info: Optional[str] = Query(None, description="경로 정보 (JSON)")
):
    """
    편안함 근거 설명 생성
    
    Args:
        route_id: 경로 ID
        route_info: 경로 정보
    
    Returns:
        편안함 근거 설명
    """
    llm_service = LLMService()
    # TODO: 실제 경로 정보 조회 및 LLM 호출
    return {
        "explanation": "이 경로는 혼잡도가 낮아 편안하게 이동할 수 있습니다."
    }
