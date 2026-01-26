import requests
import json 

def diagnose():
    url = "http://localhost:8000/api/v1/routes"
    params = {"departure": "서울역", "arrival": "강남역"}
    
    print(f"Calling {url} with {params}...")
    resp = requests.get(url, params=params)
    data = resp.json()
    
    routes = {
        "min_time": data.get("min_time"),
        "min_walking": data.get("min_walking"),
        "min_crowding": data.get("min_crowding")
    }
    
    for key, r in routes.items():
        if r:
            print(f"\n=== {key} ===")
            print(f"Route ID: {r.get('route_id')}")
            print(f"Total Time: {r.get('total_time')} min")
            print(f"Walking Time: {r.get('total_walk_time')} min")
            # Print segment walk times for detail
            walk_details = []
            for seg in r.get('segments', []):
                if seg['type'] in ['walk', 'transfer']:
                    walk_details.append(f"{seg['label']}({seg['minutes']}m)")
            print(f"Walk Details: {', '.join(walk_details)}")

if __name__ == "__main__":
    diagnose()
