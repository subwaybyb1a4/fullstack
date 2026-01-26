"""
실시간 정보 서비스 (열차 위치, 혼잡도 등)
"""
from typing import Optional, Dict, Any
from datetime import datetime


class RealtimeService:
    """실시간 정보 서비스"""
    
    def __init__(self):
        # TODO: 실시간 데이터 소스 연동
        pass
    
    async def get_train_congestion(
        self,
        line_number: str,
        station_id: str,
        direction: str
    ) -> Dict[str, Any]:
        """
        현재 열차와 다음 열차의 혼잡도 조회
        
        Args:
            line_number: 호선
            station_id: 역 ID
            direction: 방향
        
        Returns:
            열차 혼잡도 정보 (현재 열차, 다음 열차)
        """
        # TODO: 실제 실시간 데이터 조회
        return {
            "current_train": {
                "congestion_level": "보통",
                "arrival_time": "2분"
            },
            "next_train": {
                "congestion_level": "여유",
                "arrival_time": "5분"
            }
        }
