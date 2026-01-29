"""
안끼길 - 지하철 내비게이션 API 메인 애플리케이션
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import routes

app = FastAPI(
    title=settings.APP_NAME,
    description="퇴근길 편안한 지하철 경로 추천 서비스",
    version=settings.APP_VERSION
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(routes.router, prefix="/api")


@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "안끼길 API에 오신 것을 환영합니다",
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)