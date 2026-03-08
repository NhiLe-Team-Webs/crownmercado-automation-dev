from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "One Click Video"
    APP_ENV: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "info"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@postgres:5432/postgres"
    
    # Redis / Queue
    REDIS_URL: str = "redis://redis:6379/0"
    
    # AWS / S3 (For M0.2 but defined now)
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "ocv-storage"
    S3_ENDPOINT_URL: Optional[str] = None
    
    # AI APIs
    GEMINI_API_KEY: Optional[str] = None
    ASSEMBLYAI_API_KEY: Optional[str] = None
    PEXELS_API_KEY: Optional[str] = None
    
    # Telegram Notifications
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: Optional[str] = None
    
    # Remotion Lambda (AWS)
    REMOTION_LAMBDA_SERVE_URL: Optional[str] = None
    REMOTION_LAMBDA_FUNCTION_NAME: str = "remotion-render-4-0-417-mem2048mb-disk2048mb-120sec"
    REMOTION_LAMBDA_REGION: str = "us-east-1"
    REMOTION_AWS_ACCESS_KEY_ID: Optional[str] = None
    REMOTION_AWS_SECRET_ACCESS_KEY: Optional[str] = None
    
    # Security
    SECRET_KEY: str = "yoursupersecretkeyhere"
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
