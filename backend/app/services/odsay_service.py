"""
ODSay API 서비스
"""
import httpx
from typing import Optional, Dict, Any, List
from app.core.config import settings
from fastapi import HTTPException   # [ADDED] FastAPI 에러 처리용
import logging                      # [ADDED] logging 사용

logger = logging.getLogger(__name__)  # [ADDED] 로거 생성


class ODSayService:
    """ODSay API 서비스"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        ODSay 서비스 초기화
        
        Args:
            api_key: ODSay API 키 (없으면 설정에서 읽음)
        """
        self.api_key = api_key or settings.ODSAY_API_KEY
        self.base_url = "https://api.odsay.com/v1/api"

        # [ADDED] AsyncClient 재사용 + 타임아웃 설정
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0)
        )
        
        if not self.api_key:
            raise ValueError("ODSay API 키가 필요합니다. 환경변수 ODSAY_API_KEY를 설정하세요.")
    
    async def search_station(
        self,
        station_name: str,
        lang: int = 0
    ) -> List[Dict[str, Any]]:
        """
        대중교통 정류장 검색
        """
        url = f"{self.base_url}/searchStation"
        params = {
            "apiKey": self.api_key,
            "stationName": station_name,
            "lang": lang,
            "output": "json"
        }
        
        try:
            # [MODIFIED] 매번 AsyncClient 생성 → 재사용 클라이언트 사용
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as e:
            logger.error(f"[ODSay] 역 검색 HTTP 오류: {e}")  # [MODIFIED] print → logging
            raise HTTPException(status_code=502, detail="ODSay 서버와 통신 중 오류 발생")  # [ADDED]

        # 디버깅 로그
        logger.info(f"[ODSay] 역 검색 API 호출: {station_name}")  # [MODIFIED]
        logger.info(f"[ODSay] 응답 데이터 키: {list(data.keys()) if isinstance(data, dict) else 'not dict'}")

        result = data.get("result")

        # 성공 케이스
        if isinstance(result, dict):
            stations = result.get("station", [])

            logger.info(f"[ODSay] stations 타입: {type(stations)}, 길이: {len(stations) if isinstance(stations, (list, dict)) else 'N/A'}")

            if isinstance(stations, list) and stations:
                logger.info(f"[ODSay] 역 검색 성공: {len(stations)}개 결과")

                # [ADDED] 지하철 역 우선 선택 (stationClass == "2")
                subway_candidates = [
                    s for s in stations if s.get("stationClass") == "2"
                ]
                if subway_candidates:
                    logger.info("[ODSay] 지하철 역 우선 선택 적용")
                    return subway_candidates

                return stations

            if isinstance(stations, dict):
                return [stations]

            logger.info("[ODSay] 역 검색 결과 없음")
            return []

        # 레거시 OK 케이스 방어
        if result == "OK":
            result_data = data.get("result", {})
            if isinstance(result_data, dict):
                stations = result_data.get("station", [])
                if isinstance(stations, list) and stations:
                    return stations
                if isinstance(stations, dict):
                    return [stations]
            if isinstance(result_data, list) and result_data:
                return result_data
            return []

        # 에러 처리
        error_info = data.get("error", {})
        error_msg = error_info.get("msg", "Unknown error") if isinstance(error_info, dict) else str(error_info)
        logger.error(f"[ODSay] 역 검색 실패: {error_msg}")
        raise HTTPException(status_code=400, detail=f"역 검색 실패: {error_msg}")  # [MODIFIED]
    
    async def search_route(
        self,
        sx: float,
        sy: float,
        ex: float,
        ey: float,
        search_type: int = 0,
        search_path_type: int = 0,
        lang: int = 0
    ) -> Dict[str, Any]:
        """
        대중교통 길찾기
        """
        url = f"{self.base_url}/searchPubTransPath"
        params = {
            "apiKey": self.api_key,
            "SX": sx,
            "SY": sy,
            "EX": ex,
            "EY": ey,
            "SearchType": search_type,
            "SearchPathType": search_path_type,
            "lang": lang,
            "output": "json"
        }

        try:
            logger.info(f"[ODSay] 경로 검색 API 호출: {url}")
            logger.info(f"[ODSay] 파라미터: {params}")

            # [MODIFIED] 재사용 클라이언트 사용
            response = await self.client.get(url, params=params)
            logger.info(f"[ODSay] 응답 상태 코드: {response.status_code}")
            response.raise_for_status()
            data = response.json()

        except httpx.HTTPError as e:
            logger.error(f"[ODSay] 경로 검색 HTTP 오류: {e}")
            raise HTTPException(status_code=502, detail="ODSay 서버와 통신 중 오류 발생")  # [ADDED]

        logger.info(f"[ODSay] 경로 검색 응답 키: {list(data.keys()) if isinstance(data, dict) else 'not dict'}")
        
        result = data.get("result")

        if isinstance(result, dict):
            logger.info(f"[ODSay] 경로 검색 성공, result(dict) 키: {list(result.keys())}")
            path = result.get("path", [])
            logger.info(f"[ODSay] path 길이: {len(path) if isinstance(path, list) else 'N/A'}")
            return result

        # 레거시 OK 처리
        if result == "OK":
            result_data = data.get("result", {})
            return result_data if isinstance(result_data, dict) else {}

        error_info = data.get("error", {})
        if not error_info and "error" in result: # result might be the error dict itself if structure varies
             error_info = result["error"]
        
        error_msg = error_info.get("msg", "Unknown error") if isinstance(error_info, dict) else str(error_info)
        # Log full data for debugging
        logger.error(f"[ODSay] 경로 검색 실패. 응답 데이터: {data}")
        # search_type이 3(최소도보)일 때, 경로가 없을 수 있음 (도보로만 가야하거나 등등)
        # 500 에러를 뱉는 것보다, 빈 결과({})를 리턴하고 상위 서비스에서 처리하게 하는게 나을 수도 있음.
        # 하지만 일단 에러 메시지를 명확히 함.
        raise HTTPException(status_code=400, detail=f"경로 검색 실패: {error_msg}")  # [MODIFIED]
    
    async def search_route_by_station_name(
        self,
        departure_station: str,
        arrival_station: str,
        search_type: int = 0,
        search_path_type: int = 1,  # 지하철만
        lang: int = 0
    ) -> Dict[str, Any]:
        """
        역 이름으로 대중교통 길찾기
        """
        # 1. 출발역 검색
        logger.info(f"[ODSay] 출발역 검색: {departure_station}")
        departure_stations = await self.search_station(departure_station, lang)
        if not departure_stations:
            raise HTTPException(status_code=404, detail=f"출발역 '{departure_station}'을 찾을 수 없습니다.")  # [MODIFIED]
        
        # [MODIFIED] 지하철 역 우선 선택
        dep_station = departure_stations[0]
        logger.info(f"[ODSay] 출발역 선택 결과: {dep_station}")

        sx = float(dep_station.get("x", 0))
        sy = float(dep_station.get("y", 0))
        
        if sx == 0 or sy == 0:
            raise HTTPException(status_code=400, detail=f"출발역 '{departure_station}'의 좌표를 찾을 수 없습니다.")  # [MODIFIED]
        
        # 2. 도착역 검색
        logger.info(f"[ODSay] 도착역 검색: {arrival_station}")
        arrival_stations = await self.search_station(arrival_station, lang)
        if not arrival_stations:
            raise HTTPException(status_code=404, detail=f"도착역 '{arrival_station}'을 찾을 수 없습니다.")  # [MODIFIED]
        
        arr_station = arrival_stations[0]
        logger.info(f"[ODSay] 도착역 선택 결과: {arr_station}")

        ex = float(arr_station.get("x", 0))
        ey = float(arr_station.get("y", 0))
        
        if ex == 0 or ey == 0:
            raise HTTPException(status_code=400, detail=f"도착역 '{arrival_station}'의 좌표를 찾을 수 없습니다.")  # [MODIFIED]
        
        # 3. 경로 검색
        logger.info(f"[ODSay] 경로 검색 시작: ({sx}, {sy}) → ({ex}, {ey})")
        route_data = await self.search_route(
            sx, sy, ex, ey,
            search_type,
            search_path_type,
            lang
        )
        logger.info(f"[ODSay] 경로 검색 완료")

        return route_data

    # [ADDED] FastAPI 종료 시 호출해서 커넥션 정리용
    async def close(self):
        await self.client.aclose()
