"""
애플리케이션 설정
"""
import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

class Settings(BaseSettings):
    """애플리케이션 설정"""
    
    # ODSay API 설정
    ODSAY_API_KEY: str = os.getenv("ODSAY_API_KEY", "")
    
    # Azure OpenAI 설정
    AZURE_OPENAI_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT", "https://firstpai.cognitiveservices.azure.com/")
    AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    AZURE_OPENAI_API_VERSION: str = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
    AZURE_OPENAI_DEPLOYMENT_NAME: str = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1-3")
    AZURE_OPENAI_DEPLOYMENT: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1-3")
    
    # Hugging Face 설정
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")
    
    # 앱 설정
    APP_NAME: str = "안끼길 API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    model_config = {
        "env_file": ".env",
        "case_sensitive": True
    }


# 전역 설정 인스턴스
settings = Settings()
