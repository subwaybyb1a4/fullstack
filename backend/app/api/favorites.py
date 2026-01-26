"""
즐겨찾기 관련 API 라우터
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel, Field

router = APIRouter(prefix="/favorites", tags=["favorites"])


class FavoriteRoute(BaseModel):
    """즐겨찾기 경로"""
    id: Optional[str] = Field(None, description="즐겨찾기 ID")
    name: str = Field(..., description="즐겨찾기 이름")
    departure_station: str = Field(..., description="출발역")
    arrival_station: str = Field(..., description="도착역")
    route_type: str = Field(..., description="경로 타입")


# 임시 저장소 (실제로는 DB 사용)
_favorites: List[FavoriteRoute] = []


@router.get("", response_model=List[FavoriteRoute])
async def get_favorites():
    """
    즐겨찾기 목록 조회
    
    Returns:
        즐겨찾기 목록
    """
    return _favorites


@router.post("", response_model=FavoriteRoute)
async def create_favorite(favorite: FavoriteRoute):
    """
    즐겨찾기 생성
    
    Args:
        favorite: 즐겨찾기 정보
    
    Returns:
        생성된 즐겨찾기
    """
    import uuid
    favorite.id = str(uuid.uuid4())
    _favorites.append(favorite)
    return favorite


@router.delete("/{favorite_id}")
async def delete_favorite(favorite_id: str):
    """
    즐겨찾기 삭제
    
    Args:
        favorite_id: 즐겨찾기 ID
    
    Returns:
        삭제 결과
    """
    global _favorites
    _favorites = [f for f in _favorites if f.id != favorite_id]
    return {"message": "즐겨찾기가 삭제되었습니다."}
