"""
⭐ main api server 
JSON 형식의 route를 받아서 혼잡도를 계산하고 LLM 설명을 추가해서 반환하는 API
"""

import pandas as pd
import numpy as np
import json

from app.api.routes import Route 
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
from pathlib import Path
import traceback
from openai import AzureOpenAI
from dotenv import load_dotenv

from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document



env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

# =========================
# Azure OpenAI API 클라이언트 초기화
# =========================
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-35-turbo")  # 배포 이름
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

if AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT:
    try:
        openai_client = AzureOpenAI(
            api_key=AZURE_OPENAI_API_KEY,
            api_version=AZURE_OPENAI_API_VERSION,
            azure_endpoint=AZURE_OPENAI_ENDPOINT
        )
        print("✅ Azure OpenAI API 클라이언트 초기화 완료")
        print(f"   엔드포인트: {AZURE_OPENAI_ENDPOINT}")
        print(f"   배포 이름: {AZURE_OPENAI_DEPLOYMENT}")
    except Exception as e:
        print(f"⚠️ Azure OpenAI API 초기화 실패: {e}")
        openai_client = None
else:
    print("ℹ️ Azure OpenAI 설정 없음. 규칙 기반 설명 사용")
    openai_client = None

# FastAPI 앱 생성
app = FastAPI(title="Route Congestion API")

# =========================
# 혼잡 참고 RAG 대체 (FAISS 없이)
# =========================
RAG_RULES_PATH = Path(__file__).parent / "congestion_rules.txt"

if RAG_RULES_PATH.exists():
    with open(RAG_RULES_PATH, "r", encoding="utf-8") as f:
        congestion_rules_text = f.read()
    # 규칙을 chunk 단위로 분할
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    congestion_chunks = splitter.create_documents([congestion_rules_text])
    print(f"📄 혼잡 규칙 chunk 수: {len(congestion_chunks)}")
else:
    congestion_chunks = []
    print("⚠️ congestion_rules.txt 없음. 규칙 기반만 사용")

def retrieve_congestion_rules(route: Route):
    """FAISS 없이 간단 키워드 검색으로 혼잡 참고 chunk 반환"""
    if not congestion_chunks:
        return ""

    keywords = []
    for seg in route.segments:
        if seg.is_transfer or int(seg.time_str.split(":")[0]) in [7, 8, 9, 18, 19]:
            keywords.append(f"{seg.time_str} {seg.station} {seg.line} 환승")

    keywords = list(dict.fromkeys(keywords))  # 중복 제거

    retrieved_texts = []
    for kw in keywords[:3]:  # 최대 3개만
        for chunk in congestion_chunks:
            if kw.lower() in chunk.page_content.lower():
                retrieved_texts.append(chunk.page_content)

    if not retrieved_texts and congestion_chunks:
        retrieved_texts.append(congestion_chunks[0].page_content)

    return "\n".join(retrieved_texts)



# =========================
# 혼잡도 데이터 로드
# =========================
def load_congestion_data():
    """혼잡도 데이터 로드"""
    try:
        csv_path = Path(__file__).parent / "data" / "result.csv"
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


congestion_df = load_congestion_data()

# =========================
# 데이터 모델
# =========================
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

# =========================
# 혼잡도 계산 함수
# =========================
def normalize_time_slot(time_str):
    try:
        h, m = map(int, time_str.split(":"))
        m = 0 if m < 30 else 30
        return f"{h:02d}:{m:02d}"
    except:
        return "09:00"

def normalize_station(name: str) -> str:
    return name.replace("역", "")

def normalize_day(day):
    if day in ["평일", "주중"]:
        return "평일"
    if day in ["토", "토요일"]:
        return "토요일"
    if day in ["일", "일요일", "공휴일"]:
        return "일요일"
    return day

def normalize_direction(d):
    if d.startswith("상"):
        return "상선"
    if d.startswith("하"):
        return "하선"
    return d

def time_weight(time_str):
    try:
        hour = int(time_str.split(":")[0])
        if 7 <= hour <= 9:
            return 1.25
        if 18 <= hour <= 20:
            return 1.2
        return 1.0
    except:
        return 1.0

def get_segment_congestion(df, day, line, station, direction, time_str):
    """구간별 혼잡도 조회"""
    if df is None:
        return 50.0

    day_norm = normalize_day(day)
    time_norm = normalize_time_slot(time_str)
    direction_norm = normalize_direction(direction)
    station_norm = normalize_station(station)

    row = df[
        (df["요일구분"] == day_norm) &
        (df["호선"] == line) &
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

def transfer_penalty(congestion, base=8):
    if congestion >= 35:
        return base * 1.5
    elif congestion >= 25:
        return base * 1.2
    return base

def peak_congestion_penalty(segment_details, threshold=40):
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

def max_congestion_penalty(segment_details):
    max_c = max(seg["congestion"] for seg in segment_details)
    if max_c >= 45:
        return (max_c - 40) * 20
    return 0

def short_segment_penalty(route):
    count = sum(1 for s in route.segments if s.travel_time < 3)
    return count * 15




# =========================
# 점수 계산
# =========================
def calculate_route_score(df, route: Route, day: str):
    score = 0.0
    segment_details = []
    prev_transfer = False

    for seg in route.segments:
        congestion = get_segment_congestion(
            df, day, seg.line, seg.station, seg.direction, seg.time_str
        )

        weighted_score = congestion * seg.travel_time * time_weight(seg.time_str)
        score += weighted_score

        detail = {
            "line": seg.line,
            "station": seg.station,
            "congestion": round(congestion, 2),
            "travel_time": seg.travel_time,
            "segment_score": round(weighted_score, 2),
            "is_transfer": seg.is_transfer
        }

        if seg.is_transfer:
            penalty = transfer_penalty(congestion) * (1 + congestion / 100)
            if prev_transfer:
                penalty += 10
            score += penalty
            detail["transfer_penalty"] = round(penalty, 2)

        prev_transfer = seg.is_transfer
        segment_details.append(detail)

    score += peak_congestion_penalty(segment_details)
    score += max_congestion_penalty(segment_details)
    score += short_segment_penalty(route)

    return round(score, 2), segment_details

def get_congestion_level(score):
    if score < 1000:
        return "여유 🟢"
    elif score < 1300:
        return "보통 🟡"
    elif score < 1600:
        return "혼잡 🟠"
    return "매우 혼잡 🔴"

# =========================
# LLM 설명 생성 (OpenAI GPT)
# =========================
def generate_llm_description(route, score, congestion_level, segment_details):
    """OpenAI GPT로 경로 설명 생성"""
    
    num_transfers = sum(1 for seg in route.segments if seg.is_transfer)
    avg_congestion = sum(seg['congestion'] for seg in segment_details) / len(segment_details)
    max_congestion = max(seg['congestion'] for seg in segment_details)

    # RAG에서 혼잡 참고 데이터 검색
    congestion_context = retrieve_congestion_rules(route)

    
    # API 없으면 규칙 기반
    if openai_client is None:
        return generate_rule_based_description(
            route, score, congestion_level, num_transfers, avg_congestion, max_congestion
        )
    
    # GPT 프롬프트
    prompt = f"""
너는 지하철 경로 안내 전문가이다.
아래 혼잡 참고 데이터를 반드시 참고하여,
혼잡한 환승역과 시간대는 경고하거나 우회 조언을 포함해 설명하라.

[혼잡 참고 데이터]
{congestion_context}

[이번 경로 정보]
- 총 소요시간: {route.total_time}분
- 환승 횟수: {num_transfers}회
- 혼잡도: {congestion_level}
- 평균 혼잡도: {avg_congestion:.1f}%
- 최대 혼잡도: {max_congestion:.1f}%

조건:
- 문장은 "이번 열차는 여유롭네요!"처럼 체감 위주로 시작
- 혼잡 참고 데이터에 언급된 역이 있으면 반드시 반영
- 환승역에서는 사람이 많을 수 있음을 언급
- 칸별 빠른 환승 위치 힌트 포함 가능
- 최대 100자

설명:
"""
    
    try:
        print(f"🔄 OpenAI GPT API 호출...")
        
        response = openai_client.chat.completions.create(
            model="gpt-4.1-3",  # 또는 "gpt-4o-mini" (더 저렴)
            messages=[
                {"role": "system", "content": "당신은 지하철 경로 안내 전문가입니다. 간결하고 명확하게 설명합니다."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=150,
            temperature=0.7,
        )
        
        description = response.choices[0].message.content.strip()
        
        print(f"✅ GPT 응답: {description}")
        
        # 너무 길면 자르기
        if len(description) > 100:
            description = description[:100] + "..."
        
        # 비어있으면 규칙 기반으로 fallback
        if not description or len(description) < 10:
            print("⚠️ 생성된 텍스트가 너무 짧음, 규칙 기반 사용")
            return generate_rule_based_description(
                route, score, congestion_level, num_transfers, avg_congestion, max_congestion
            )
            
        return description
        
    except Exception as e:
        print(f"❌ OpenAI API 호출 실패: {e}")
        return generate_rule_based_description(
            route, score, congestion_level, num_transfers, avg_congestion, max_congestion
        )
    
def generate_rule_based_description(route, score, congestion_level, num_transfers, avg_congestion, max_congestion):
    """규칙 기반 설명 생성 (백업용)"""
    
    description_parts = []
    
    # 시간 정보
    if route.total_time < 30:
        description_parts.append("빠른 경로")
    elif route.total_time < 45:
        description_parts.append("적당한 소요시간")
    else:
        description_parts.append("긴 이동시간")
    
    # 환승 정보
    if num_transfers == 0:
        description_parts.append("직통")
    elif num_transfers == 1:
        description_parts.append("1회 환승")
    else:
        description_parts.append(f"{num_transfers}회 환승")
    
    # 혼잡도 정보
    if max_congestion >= 40:
        description_parts.append("일부 구간 매우 혼잡")
    elif avg_congestion >= 30:
        description_parts.append("전반적으로 혼잡")
    elif avg_congestion >= 20:
        description_parts.append("보통 수준의 혼잡도")
    else:
        description_parts.append("여유로운 구간")
    
    # 추천 문구
    if score < 1000:
        tip = "추천 경로입니다."
    elif score < 1300:
        tip = "이용 가능한 경로입니다."
    elif num_transfers >= 2 and max_congestion >= 35:
        tip = "혼잡 시간대에는 피하는 것이 좋습니다."
    else:
        tip = "혼잡할 수 있으니 여유있게 출발하세요."
    
    return f"{', '.join(description_parts)}. {tip}"

# =========================
# API 엔드포인트
# =========================
@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "Route Congestion API 정상 작동",
        "llm_enabled": openai_client is not None,
        "endpoints": {
            "analyze_single": "/api/routes/analyze",
            "analyze_batch": "/api/routes/analyze-batch",
            "health": "/health"
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "congestion_data_loaded": congestion_df is not None,
        "llm_api_enabled": openai_client is not None
    }

@app.post("/api/routes/analyze", response_model=RouteAnalysisResponse)
async def analyze_single_route(request: RouteAnalysisRequest):
    try:
        score, segment_details = calculate_route_score(
            df=congestion_df,
            route=request.route,
            day=request.day
        )

        congestion_level = get_congestion_level(score)

        llm_description = generate_llm_description(
            route=request.route,
            score=score,
            congestion_level=congestion_level,
            segment_details=segment_details
        )

        num_transfers = sum(1 for seg in request.route.segments if seg.is_transfer)

        return RouteAnalysisResponse(
            route_id=request.route.route_id,
            total_time=request.route.total_time,
            congestion_score=score,
            congestion_level=congestion_level,
            num_transfers=num_transfers,
            llm_description=llm_description,
            detailed_segments=segment_details
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/routes/analyze-batch")
async def analyze_batch_routes(requests: List[RouteAnalysisRequest]):
    try:
        results = []
        for request in requests:
            score, segment_details = calculate_route_score(
                df=congestion_df,
                route=request.route,
                day=request.day
            )

            congestion_level = get_congestion_level(score)
            llm_description = generate_llm_description(
                route=request.route,
                score=score,
                congestion_level=congestion_level,
                segment_details=segment_details
            )

            num_transfers = sum(1 for seg in request.route.segments if seg.is_transfer)

            results.append({
                "route_id": request.route.route_id,
                "total_time": request.route.total_time,
                "congestion_score": score,
                "congestion_level": congestion_level,
                "num_transfers": num_transfers,
                "llm_description": llm_description,
                "detailed_segments": segment_details
            })

        results.sort(key=lambda x: x["congestion_score"])

        return {
            "total_routes": len(results),
            "routes": results,
            "recommendation": results[0]["route_id"] if results else None
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"배치 분석 실패: {str(e)}")

# =========================
# 실행
# =========================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
