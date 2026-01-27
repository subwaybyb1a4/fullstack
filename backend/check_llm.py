import requests
import json
import sys

# Set encoding to utf-8 for console output
sys.stdout.reconfigure(encoding='utf-8')

url = "http://localhost:8000/api/routes/search"
payload = {
    "from_station": "서울역",
    "to_station": "강남역",
    "searched_time": "2024-01-26T09:00:00"
}
headers = {
    "Content-Type": "application/json"
}

try:
    print(f"Sending request to {url}...")
    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    
    data = response.json()
    
    print("\n=== Min Crowding Summary (LLM) ===")
    summary = data.get('min_crowding', {}).get('summary')
    print(summary)
    
    print("\n=== Min Time Summary (LLM) ===")
    summary_time = data.get('min_time', {}).get('summary')
    print(summary_time)
    
    if summary and "," in summary and "경로" in summary and len(summary) < 50:
         print("\n[Analysis] The output looks like Rule-based (Fallback).")
    else:
         print("\n[Analysis] The output looks like LLM-generated (Natural Language).")

except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'response') and e.response:
        print(f"Response text: {e.response.text}")
