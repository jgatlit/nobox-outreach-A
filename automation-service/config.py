"""
Configuration settings for the automation service.
"""

import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/nobox_outreach"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # FastAPI
    PORT: int = 8050
    DEBUG: bool = False
    SECRET_KEY: str = "your-secret-key-change-in-production"
    
    # AI Services
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"
    
    # Google Services
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None
    GOOGLE_SHEETS_PRIVATE_KEY: Optional[str] = None
    GOOGLE_SHEETS_CLIENT_EMAIL: Optional[str] = None
    
    # External Services
    AIRTABLE_API_KEY: Optional[str] = None
    SENDGRID_API_KEY: Optional[str] = None
    
    # Monitoring
    SENTRY_DSN: Optional[str] = None
    PROMETHEUS_PORT: int = 8051
    
    # Job Processing
    MAX_RETRIES: int = 3
    RETRY_DELAY: int = 60  # seconds
    MAX_CONCURRENT_JOBS: int = 10
    
    # Scraping Configuration
    SCRAPING_DELAY: float = 1.0  # seconds between requests
    MAX_PAGES_PER_DOMAIN: int = 10
    REQUEST_TIMEOUT: int = 30
    
    # Security
    CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:5173"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Global settings instance
settings = Settings()