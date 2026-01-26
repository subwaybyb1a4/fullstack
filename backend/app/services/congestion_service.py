"""
혼잡도 서비스
"""
import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from app.schemas.route import CongestionLevel, Route, RouteSegment


class CongestionService:
    """혼잡도 서비스"""
    
    def __init__(self):
        self.congestion_df = self.load_congestion_data()
    
    def load_congestion_data(self):
        """혼잡도 데이터 로드"""
        try:
            csv_path = Path(__file__).parent.parent.parent / "data" / "result.csv"
            if not csv_path.exists():
                print(f"⚠️ 혼잡도 데이터 파일이 없습니다: {csv_path}")
                return None
                
            df = pd.read_csv(csv_path, encoding="utf-8")

            # 문자열로 강제 변환 + 전처리
            df["출발역"] = df["출발역"].astype(str).str.replace("역", "").str.strip().str.lower()
            df["호선"] = df["호선"].astype(str).str.strip().str.lower()
            df["상하구분"] = df["상하구분"].astype(str).str.strip().str.lower()
            df["요일구분"] = df["요일구분"].astype(str).str.strip()
            df["time_str"] = df["time_str"].astype(str).str.strip()
            return df
        except Exception as e:
            print(f"⚠️ 혼잡도 데이터를 로드할 수 없습니다: {e}")
            return None
    
    def normalize_time_slot(self, time_str):
        try:
            h, m = map(int, time_str.split(":"))
            m = 0 if m < 30 else 30
            return f"{h:02d}:{m:02d}"
        except:
            return "09:00"

    def normalize_station(self, name: str) -> str:
        return name.replace("역", "").strip().lower()

    def normalize_day(self, day):
        if day in ["평일", "주중"]:
            return "평일"
        if day in ["토", "토요일"]:
            return "토요일"
        if day in ["일", "일요일", "공휴일"]:
            return "일요일"
        return day

    def normalize_direction(self, d):
        if d.startswith("상"):
            return "상선"
        if d.startswith("하"):
            return "하선"
        return d

    def time_weight(self, time_str):
        try:
            hour = int(time_str.split(":")[0])
            if 7 <= hour <= 9:
                return 1.25
            if 18 <= hour <= 20:
                return 1.2
            return 1.0
        except:
            return 1.0

    def get_segment_congestion(self, df, day, line, station, direction, time_str):
        """구간별 혼잡도 조회"""
        if df is None:
            return 50.0

        day_norm = self.normalize_day(day)
        time_norm = self.normalize_time_slot(time_str)
        direction_norm = self.normalize_direction(direction)
        station_norm = self.normalize_station(station)

        row = df[
            (df["요일구분"] == day_norm) &
            (df["호선"] == line.lower()) &
            (df["출발역"].str.replace("역","") == station_norm) &
            (df["상하구분"] == direction_norm) &
            (df["time_str"] == time_norm)
        ]

        if row.empty:
            day_df = df[df["요일구분"] == day_norm]
            if not day_df.empty:
                return float(day_df["weighted_congestion"].mean())
            return float(df["weighted_congestion"].mean())

        return float(row.iloc[0]["weighted_congestion"])

    def transfer_penalty(self, congestion, base=8):
        if congestion >= 35:
            return base * 1.5
        elif congestion >= 25:
            return base * 1.2
        return base

    def peak_congestion_penalty(self, segment_details, threshold=40):
        penalty = 0
        consecutive = 0
        for seg in segment_details:
            if seg["congestion"] >= threshold:
                consecutive += 1
                if consecutive >= 2:
                    penalty += 20 * consecutive
            else:
                consecutive = 0
        return penalty

    def max_congestion_penalty(self, segment_details):
        max_c = max(seg["congestion"] for seg in segment_details)
        if max_c >= 45:
            return (max_c - 40) * 20
        return 0

    def short_segment_penalty(self, route: Route):
        count = sum(1 for s in route.segments if s.duration < 180)  # 3분 미만
        return count * 15

    def calculate_route_score(self, route: Route, day: str = "평일", time_str: Optional[str] = None):
        """경로 혼잡도 점수 계산"""
        score = 0.0
        segment_details = []
        prev_transfer = False

        for i, seg in enumerate(route.segments):
            # 방향 결정 (단순화: 첫 구간은 상선, 나머지는 하선으로 가정)
            direction = "상선" if i == 0 else "하선"
            
            # 시간 설정
            current_time = time_str or "09:00"
            
            congestion = self.get_segment_congestion(
                self.congestion_df, day, seg.line_number, 
                seg.from_station.station_name, direction, current_time
            )

            weighted_score = congestion * (seg.duration / 60) * self.time_weight(current_time)  # duration을 분으로 변환
            score += weighted_score

            detail = {
                "line": seg.line_number,
                "station": seg.from_station.station_name,
                "congestion": round(congestion, 2),
                "travel_time": seg.duration / 60,  # 초 -> 분
                "segment_score": round(weighted_score, 2),
                "is_transfer": False  # RouteSegment에 is_transfer 필드가 없으므로 False로 설정
            }

            # 환승 페널티 (transfers 정보 활용)
            if route.transfers and i < len(route.transfers):
                transfer = route.transfers[i]
                penalty = self.transfer_penalty(congestion) * (1 + congestion / 100)
                if prev_transfer:
                    penalty += 10
                score += penalty
                detail["transfer_penalty"] = round(penalty, 2)
                detail["is_transfer"] = True

            prev_transfer = detail["is_transfer"]
            segment_details.append(detail)

        score += self.peak_congestion_penalty(segment_details)
        score += self.max_congestion_penalty(segment_details)
        score += self.short_segment_penalty(route)
        
        # Calculate Average Congestion for Level Label (0-100 scale)
        if segment_details:
             avg_c = sum(s["congestion"] for s in segment_details) / len(segment_details)
        else:
             avg_c = 0.0

        # Return (Weighted Score, Details, Avg Congestion)
        # Note: Previous signature returned (score, details). 
        # I need to accommodate this change in API call or update this method to just return score, details 
        # and handle level calculation separately?
        # A cleaner way: Update 'get_congestion_level' to accept score? NO, level should be based on density.
        # Let's attach 'avg_congestion' to the details or return it.
        # But 'calculate_route_score' is used in routes.py.
        # I will attach 'avg_congestion' to details metadata?
        # Or I can just calculate avg_congestion in routes.py from details.
        # Actually, let's keep 'calculate_route_score' signature simple, but make it return score.
        # Wait, the user complaint is about 'min_crowding' LABEL.
        # routes.py calls: score, details = service.calculate_route_score(r)
        # then: level = service.get_congestion_level(score)
        # The 'score' is weighted.
        # I should change 'get_congestion_level' to take 'score' meant for level.
        # I will change 'calculate_route_score' to return (score, details, avg_congestion).
        # But that breaks signature.
        # I will modify routes.py to calculate avg from details.
        
        return round(score, 2), segment_details

    def get_congestion_level(self, score: float) -> str:
        """
        점수를 혼잡도 레벨로 변환
        Legacy: score was weighted.
        New: score should be 'average congestion' (0-100).
        """
        if score < 30:
            return "여유 🟢"
        elif score < 50:
            return "보통 🟡"
        elif score < 70:
            return "혼잡 🟠"
        return "매우 혼잡 🔴"
