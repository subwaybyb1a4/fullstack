"""
🚀 Route Congestion API 테스트 스크립트
- 헬스 체크
- 단일 경로 분석 
- 배치 경로 분석
"""

import requests
import json

BASE_URL = "http://localhost:8000"

# =========================
# 헬스 체크
# =========================
def test_health_check():
    print("="*50)
    print("🔍 헬스 체크 테스트")
    print("="*50)
    
    response = requests.get(f"{BASE_URL}/health")
    print(f"상태 코드: {response.status_code}")
    try:
        print(f"응답: {json.dumps(response.json(), ensure_ascii=False, indent=2)}\n")
    except Exception as e:
        print(f"응답 JSON 파싱 실패: {e}\n")


# =========================
# 단일 경로 분석
# =========================
def test_analyze_single_route():
    print("="*50)
    print("📍 단일 경로 분석 테스트")
    print("="*50)

    request_data = {
        "route": {
            "route_id": "route_peak_sindorim",
            "total_time": 42.0,
            "segments": [
                {"line": "1호선", "station": "신도림역", "direction": "상행", "time_str": "07:55", "travel_time": 10.0, "is_transfer": False},
                {"line": "2호선", "station": "신도림역", "direction": "하행", "time_str": "08:00", "travel_time": 5.0, "is_transfer": True},
                {"line": "2호선", "station": "강남역", "direction": "하행", "time_str": "08:20", "travel_time": 27.0, "is_transfer": False}
            ]
        },
        "day": "평일",
        "time_str": "07:55"
    }

    response = requests.post(
        f"{BASE_URL}/api/routes/analyze",
        json=request_data,
        headers={"Content-Type": "application/json"}
    )

    print(f"상태 코드: {response.status_code}")
    try:
        result = response.json()
        print(f"응답:\n{json.dumps(result, ensure_ascii=False, indent=2)}\n")
    except Exception as e:
        print(f"응답 JSON 파싱 실패: {e}\n")


# =========================
# 배치 경로 분석
# =========================
def test_analyze_batch_routes():
    print("="*50)
    print("📊 배치 경로 분석 테스트")
    print("="*50)

    request_data = [
        {
            "route": {
                "route_id": "route_terminal_peak",
                "total_time": 38.0,
                "segments": [
                    {"line": "3호선", "station": "고속터미널역", "direction": "상행", "time_str": "08:15", "travel_time": 8.0, "is_transfer": False},
                    {"line": "7호선", "station": "고속터미널역", "direction": "하행", "time_str": "08:20", "travel_time": 6.0, "is_transfer": True},
                    {"line": "7호선", "station": "논현역", "direction": "하행", "time_str": "08:30", "travel_time": 24.0, "is_transfer": False}
                ]
            },
            "day": "평일"
        },
        {
            "route": {
                "route_id": "route_gangnam_normal",
                "total_time": 30.0,
                "segments": [
                    {"line": "2호선", "station": "강남역", "direction": "상행", "time_str": "08:20", "travel_time": 30.0, "is_transfer": False}
                ]
            },
            "day": "평일"
        },
        {
            "route": {
                "route_id": "route_gasan_peak",
                "total_time": 45.0,
                "segments": [
                    {"line": "1호선", "station": "가산디지털단지역", "direction": "상행", "time_str": "08:40", "travel_time": 15.0, "is_transfer": False},
                    {"line": "7호선", "station": "가산디지털단지역", "direction": "하행", "time_str": "08:45", "travel_time": 5.0, "is_transfer": True},
                    {"line": "7호선", "station": "철산역", "direction": "하행", "time_str": "08:55", "travel_time": 25.0, "is_transfer": False}
                ]
            },
            "day": "평일"
        }
    ]

    response = requests.post(
        f"{BASE_URL}/api/routes/analyze-batch",
        json=request_data,
        headers={"Content-Type": "application/json"}
    )

    print(f"상태 코드: {response.status_code}")
    try:
        result = response.json()
        if response.status_code == 200:
            print(f"\n총 분석된 경로: {result['total_routes']}")
            print(f"추천 경로: {result['recommendation']}\n")
            for route in result["routes"]:
                print(f"🚇 {route['route_id']}")
                print(f"  - 총 소요시간: {route['total_time']}분")
                print(f"  - 혼잡도 점수: {route['congestion_score']}")
                print(f"  - 혼잡도 레벨: {route['congestion_level']}")
                print(f"  - 환승 횟수: {route['num_transfers']}")
                print(f"  - LLM 설명: {route['llm_description']}")
                print()
        else:
            print(f"❌ 오류 발생: {result}")
    except Exception as e:
        print(f"응답 JSON 파싱 실패: {e}\n")


# =========================
# 메인 실행
# =========================
if __name__ == "__main__":
    print("\n🚀 Route Congestion API 테스트 시작\n")

    # 서버 연결 확인
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✅ API 서버 연결 성공\n")
        else:
            print(f"❌ 서버 응답 이상: 상태 코드 {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ 서버 연결 실패: {e}")
        exit(1)

    # 테스트 실행
    test_health_check()
    test_analyze_single_route()
    test_analyze_batch_routes()

    print("\n✅ 테스트 완료\n")
