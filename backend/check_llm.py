import requests 

resp = requests.get("http://localhost:8000/api/v1/routes", params={"departure": "서울역", "arrival": "강남역"})
data = resp.json()

print("=== Min Crowding Summary ===")
print(data['min_crowding']['summary'])

print("\n=== Min Time Summary ===")
print(data['min_time']['summary'])

# Rule-based descriptions typically have very specific patterns like:
# "빠른 경로, 1회 환승, 여유로운 구간. 추천 경로입니다."
# LLM descriptions are more natural and varied
