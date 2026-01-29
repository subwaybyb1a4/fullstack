"""
⭐ route_api.py (최종 수정본)
시간 인식 버그 해결 + 데이터 기반 정밀 조회
"""

import pandas as pd
import numpy as np
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
from pathlib import Path
import traceback
from openai import AzureOpenAI
from dotenv import load_dotenv

env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

# Azure OpenAI 설정 (기존 유지)
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-35-turbo")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

if AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT:
    try:
        openai_client = AzureOpenAI(
            api_key=AZURE_OPENAI_API_KEY,
            api_version=AZURE_OPENAI_API_VERSION,
            azure_endpoint=AZURE_OPENAI_ENDPOINT
        )
    except: openai_client = None
else: openai_client = None

app = FastAPI(title="Route Congestion API")

# CSV 로드
def load_congestion_data():
    try:
        candidates = [
            Path(__file__).parent / "app" / "data" / "result.csv",
            Path(__file__).parent / "data" / "result.csv",
            Path("result.csv")
        ]
        csv_path = next((p for p in candidates if p.exists()), None)
        if not csv_path: return None

        df = pd.read_csv(csv_path, encoding="utf-8")
        df["출발역"] = df["출발역"].astype(str).str.replace("역", "").str.strip().str.lower()
        df["호선"] = df["호선"].astype(str).str.strip().str.lower()
        df["상하구분"] = df["상하구분"].astype(str).str.strip().str.lower()
        df["time_str"] = df["time_str"].astype(str).str.strip()
        return df
    except: return None

congestion_df = load_congestion_data()

# ✅ [수정] 시간 파싱 로직 강화 (ISO 문자열 대응)
def normalize_time_slot(time_str):
    try:
        if not time_str: return "09:00"
        # ISO 형태 (T 포함) 처리: "2026-02-12T14:30:00..."
        if "T" in time_str:
            time_part = time_str.split("T")[1]
            h, m = map(int, time_part.split(":")[:2])
        else:
            h, m = map(int, time_str.split(":")[:2])
            
        # 30분 단위 데이터에 맞춤
        m = 0 if m < 30 else 30
        return f"{h:02d}:{m:02d}"
    except:
        return "09:00"

def normalize_station(name: str) -> str: return name.replace("역", "")

def get_segment_congestion(df, day, line, station, direction, time_str):
    if df is None: return 0.0
    
    time_norm = normalize_time_slot(time_str)
    station_norm = normalize_station(station).lower()
    line_norm = line.lower()
    
    # 정밀 필터링
    row = df[
        (df["출발역"] == station_norm) &
        (df["호선"].str.contains(line_norm)) &
        (df["time_str"] == time_norm)
    ]
    
    if row.empty:
        # 데이터가 아예 없으면 0.0 리턴 (가짜 데이터 방지)
        return 0.0
    return float(row.iloc[0]["weighted_congestion"])

# 모델 및 API 로직 (기존 유지하되 시간 전달 수정)
class Segment(BaseModel):
    line: str
    station: str
    direction: str
    time_str: str
    travel_time: float
    is_transfer: bool = False

class Route(BaseModel):
    route_id: str
    total_time: float
    segments: List[Segment]

class RouteAnalysisRequest(BaseModel):
    route: Route
    day: str = "평일"
    time_str: Optional[str] = None

class RouteAnalysisResponse(BaseModel):
    route_id: str
    total_time: float
    congestion_score: float
    congestion_level: str
    num_transfers: int
    llm_description: str
    detailed_segments: List[Dict[str, Any]]

def get_congestion_level(score):
    if score <= 0: return "정보 없음 ⚫"
    if score < 35: return "여유 🟢"
    if score < 55: return "보통 🟡"
    if score < 80: return "혼잡 🟠"
    return "매우 혼잡 🔴"

@app.post("/api/routes/analyze", response_model=RouteAnalysisResponse)
async def analyze_single_route(request: RouteAnalysisRequest):
    try:
        score = 0.0
        details = []
        
        # ✅ 요청으로 들어온 시간 우선 사용
        base_time = request.time_str if request.time_str else request.route.segments[0].time_str
        
        for seg in request.route.segments:
            # 개별 구간 시간도 base_time 기준으로 보정
            congestion = get_segment_congestion(
                congestion_df, request.day, seg.line, seg.station, seg.direction, base_time
            )
            score += congestion * (seg.travel_time / 10) # 가중치 계산
            
            details.append({
                "line": seg.line,
                "station": seg.station,
                "congestion": round(congestion, 2)
            })

        level = get_congestion_level(score / len(details) if details else 0)
        
        return RouteAnalysisResponse(
            route_id=request.route.route_id,
            total_time=request.route.total_time,
            congestion_score=score,
            congestion_level=level,
            num_transfers=sum(1 for s in request.route.segments if s.is_transfer),
            llm_description=f"데이터 기반 분석 결과, 해당 시간대는 {level} 상태입니다.",
            detailed_segments=details
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)