import requests
import json
 
def verify():
    url = "http://localhost:8000/api/v1/routes"
    params = {"departure": "서울역", "arrival": "강남역"}
    
    print("Calling API twice to verify deterministic route_id...")
    
    # First call
    resp1 = requests.get(url, params=params)
    data1 = resp1.json()
    
    # Second call
    resp2 = requests.get(url, params=params)
    data2 = resp2.json()
    
    print("\n=== First Call ===")
    print(f"min_time route_id: {data1['min_time']['route_id']}")
    print(f"min_walking route_id: {data1['min_walking']['route_id']}")
    print(f"min_crowding route_id: {data1['min_crowding']['route_id']}")
    
    print("\n=== Second Call ===")
    print(f"min_time route_id: {data2['min_time']['route_id']}")
    print(f"min_walking route_id: {data2['min_walking']['route_id']}")
    print(f"min_crowding route_id: {data2['min_crowding']['route_id']}")
    
    print("\n=== Verification ===")
    if data1['min_time']['route_id'] == data2['min_time']['route_id']:
        print("✓ min_time route_id is deterministic")
    else:
        print("✗ min_time route_id is NOT deterministic")
    
    if data1['min_walking']['route_id'] == data2['min_walking']['route_id']:
        print("✓ min_walking route_id is deterministic")
    else:
        print("✗ min_walking route_id is NOT deterministic")
    
    if data1['min_crowding']['route_id'] == data2['min_crowding']['route_id']:
        print("✓ min_crowding route_id is deterministic")
    else:
        print("✗ min_crowding route_id is NOT deterministic")

if __name__ == "__main__":
    verify()
