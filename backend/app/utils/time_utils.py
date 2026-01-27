# ⭐ 30분 슬롯 정규화
# app/utils/time_utils.py
'''역할:

모든 캐시 / 혼잡도 / ODSay 호출 전에 시간 통일

캐시 키의 핵심 재료
'''

def normalize_time_slot(time_str: str) -> str:
    """
    HH:MM → 30분 단위 슬롯으로 변환
    예: 08:12 -> 08:00, 18:47 -> 18:30
    """
    try:
        h, m = map(int, time_str.split(":"))
        m = 0 if m < 30 else 30
        return f"{h:02d}:{m:02d}"
    except:
        return "09:00"
