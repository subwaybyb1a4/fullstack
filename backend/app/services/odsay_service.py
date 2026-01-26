"""
ODSay API 서비스
"""
import httpx
from typing import Optional, Dict, Any, List
from app.core.config import settings


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
        
        if not self.api_key:
            raise ValueError("ODSay API 키가 필요합니다. 환경변수 ODSAY_API_KEY를 설정하세요.")
    
    async def search_station(
        self,
        station_name: str,
        lang: int = 0
    ) -> List[Dict[str, Any]]:
        """
        대중교통 정류장 검색
        
        Args:
            station_name: 역 이름
            lang: 언어 (0:국문, 1:영문, 2:일문, 3:중문간체, 4:중문번체, 5:베트남어)
        
        Returns:
            검색된 역 정보 리스트
        """
        url = f"{self.base_url}/searchStation"
        params = {
            "apiKey": self.api_key,
            "stationName": station_name,
            "lang": lang,
            "output": "json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            # ODSay API 응답 구조 확인 및 파싱
            # 실제 응답 구조 확인을 위한 디버깅
            print(f"[ODSay] 역 검색 API 호출: {station_name}")
            print(f"[ODSay] 응답 데이터 타입: {type(data)}")
            print(f"[ODSay] 응답 데이터 키: {list(data.keys()) if isinstance(data, dict) else 'not dict'}")
            
            # 실제 관측된 ODSay 응답 구조:
            # - 성공: {"result": { "totalCount": ..., "station": [...] }}
            # - 실패: {"error": {...}} (형태는 상황에 따라 달라질 수 있음)
            result = data.get("result")

            # 성공 케이스 (result가 dict)
            if isinstance(result, dict):
                stations = result.get("station", [])
                print(f"[ODSay] result(dict) 키: {list(result.keys())}")
                print(f"[ODSay] stations 타입: {type(stations)}, 길이: {len(stations) if isinstance(stations, (list, dict)) else 'N/A'}")

                if isinstance(stations, list) and stations:
                    print(f"[ODSay] 역 검색 성공: {len(stations)}개 결과")
                    if stations[0]:
                        print(f"[ODSay] 첫 번째 결과 키: {list(stations[0].keys()) if isinstance(stations[0], dict) else 'not dict'}")
                        print(f"[ODSay] 첫 번째 결과 전체: {stations[0]}")
                    return stations
                if isinstance(stations, dict):
                    print("[ODSay] 역 검색 성공: 단일 결과")
                    return [stations]

                print("[ODSay] 역 검색 결과 없음 (station 비어있음)")
                return []

            # 레거시/문서형: {"result": "OK", "result": {...}} 같은 형태가 올 수 있다는 가정
            # (현재는 관측되지 않았지만, 안전하게 처리)
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
            print(f"[ODSay] 역 검색 실패 (result={result}): {error_msg}")
            raise Exception(f"역 검색 실패: {error_msg}")
    
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
        
        Args:
            sx: 출발지 X 좌표 (경도)
            sy: 출발지 Y 좌표 (위도)
            ex: 도착지 X 좌표 (경도)
            ey: 도착지 Y 좌표 (위도)
            search_type: 검색 타입 (0:최단시간, 1:최소환승, 2:최소비용, 3:최소도보)
            search_path_type: 경로 타입 (0:지하철+버스, 1:지하철만, 2:버스만)
            lang: 언어
        
        Returns:
            경로 정보
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
        
        async with httpx.AsyncClient() as client:
            print(f"[ODSay] 경로 검색 API 호출: {url}")
            print(f"[ODSay] 파라미터: {params}")
            response = await client.get(url, params=params)
            print(f"[ODSay] 응답 상태 코드: {response.status_code}")
            response.raise_for_status()
            data = response.json()
            print(f"[ODSay] 경로 검색 응답 키: {list(data.keys()) if isinstance(data, dict) else 'not dict'}")
            
            # 실제 관측된 ODSay 응답 구조:
            # - 성공: {"result": { "path": [...], ... }}
            # - 실패: {"error": {...}}
            result = data.get("result")

            if isinstance(result, dict):
                print(f"[ODSay] 경로 검색 성공, result(dict) 키: {list(result.keys())}")
                path = result.get("path", [])
                print(f"[ODSay] path 타입: {type(path)}, 길이: {len(path) if isinstance(path, list) else 'N/A'}")
                return result

            # 레거시/문서형 OK 처리 (방어적으로 유지)
            if result == "OK":
                result_data = data.get("result", {})
                return result_data if isinstance(result_data, dict) else {}

            error_info = data.get("error", {})
            error_msg = error_info.get("msg", "Unknown error") if isinstance(error_info, dict) else str(error_info)
            print(f"[ODSay] 경로 검색 실패 (result={result}): {error_msg}")
            raise Exception(f"경로 검색 실패: {error_msg}")
    
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
        
        Args:
            departure_station: 출발역 이름
            arrival_station: 도착역 이름
            search_type: 검색 타입 (0:최단시간, 1:최소환승, 2:최소비용, 3:최소도보)
            search_path_type: 경로 타입 (0:지하철+버스, 1:지하철만, 2:버스만)
            lang: 언어
        
        Returns:
            경로 정보
        """
        # 1. 출발역 검색
        print(f"[ODSay] 출발역 검색: {departure_station}")
        departure_stations = await self.search_station(departure_station, lang)
        if not departure_stations:
            raise ValueError(f"출발역 '{departure_station}'을 찾을 수 없습니다.")
        
        # 첫 번째 결과 사용 (정확도가 높은 결과)
        dep_station = departure_stations[0]
        print(f"[ODSay] 출발역 검색 결과: {dep_station}")
        sx = float(dep_station.get("x", 0))
        sy = float(dep_station.get("y", 0))
        
        if sx == 0 or sy == 0:
            raise ValueError(f"출발역 '{departure_station}'의 좌표를 찾을 수 없습니다.")
        
        # 2. 도착역 검색
        print(f"[ODSay] 도착역 검색: {arrival_station}")
        arrival_stations = await self.search_station(arrival_station, lang)
        if not arrival_stations:
            raise ValueError(f"도착역 '{arrival_station}'을 찾을 수 없습니다.")
        
        # 첫 번째 결과 사용
        arr_station = arrival_stations[0]
        print(f"[ODSay] 도착역 검색 결과: {arr_station}")
        ex = float(arr_station.get("x", 0))
        ey = float(arr_station.get("y", 0))
        
        if ex == 0 or ey == 0:
            raise ValueError(f"도착역 '{arrival_station}'의 좌표를 찾을 수 없습니다.")
        
        # 3. 경로 검색
        print(f"[ODSay] 경로 검색 시작: ({sx}, {sy}) → ({ex}, {ey})")
        route_data = await self.search_route(sx, sy, ex, ey, search_type, search_path_type, lang)
        print(f"[ODSay] 경로 검색 완료")
        return route_data
