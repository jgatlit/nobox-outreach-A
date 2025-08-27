"""
Main FastAPI application for nobox-outreach automation service.
Replaces n8n workflow orchestration with Python-based automation.
"""

import asyncio
import os
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

import dramatiq
from dramatiq.brokers.redis import RedisBroker
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from redis import Redis
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from loguru import logger

from config import Settings
from database import init_database
from models import LeadData, EnrichmentResult
from tasks import enrich_lead_task, scrape_website_task, generate_ai_insights_task
from monitoring import setup_metrics

# Configuration
settings = Settings()

# Sentry monitoring (optional)
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration(auto_enabling=True)],
        traces_sample_rate=1.0,
    )

# Redis broker for Dramatiq
redis_broker = RedisBroker(url=settings.REDIS_URL)
dramatiq.set_broker(redis_broker)

# Database engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20
)
async_session = async_sessionmaker(engine, expire_on_commit=False)

# Redis client for caching
redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    logger.info("Starting nobox-outreach automation service")
    
    # Initialize database
    await init_database(engine)
    
    # Setup monitoring
    setup_metrics()
    
    yield
    
    logger.info("Shutting down automation service")
    await engine.dispose()

# FastAPI app
app = FastAPI(
    title="Nobox Outreach Automation API",
    description="AI-powered lead generation and enrichment automation service",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency: Database session
async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()

# === REQUEST MODELS ===

class LeadEnrichmentRequest(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    website: Optional[str] = None
    lead_source: str = "manual"

class BulkEnrichmentRequest(BaseModel):
    leads: List[LeadEnrichmentRequest]
    priority: str = "normal"

class WebhookLeadData(BaseModel):
    """Webhook data model - replaces n8n webhook trigger"""
    id: Optional[str] = None
    email: EmailStr
    company: str
    website: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    source: str = "webhook"

# === API ENDPOINTS ===

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Check Redis connection
        redis_client.ping()
        
        # Check database connection
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
            
        return {
            "status": "healthy",
            "service": "automation-api",
            "version": "1.0.0",
            "redis": "connected",
            "database": "connected"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

@app.post("/webhook/lead-enrichment")
async def webhook_lead_enrichment(lead_data: WebhookLeadData):
    """
    Webhook endpoint to trigger lead enrichment.
    Replaces n8n webhook trigger node.
    """
    try:
        logger.info(f"Received webhook for lead enrichment: {lead_data.email}")
        
        # Queue the enrichment task (replaces n8n workflow)
        message = enrich_lead_task.send(lead_data.dict())
        
        return {
            "status": "queued",
            "message_id": message.message_id,
            "lead_email": lead_data.email
        }
    except Exception as e:
        logger.error(f"Webhook processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to queue lead enrichment")

@app.post("/enrich-lead")
async def enrich_lead_endpoint(
    request: LeadEnrichmentRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Manual lead enrichment endpoint.
    Replaces n8n manual trigger functionality.
    """
    try:
        # Store lead in database first
        from database import create_lead
        lead = await create_lead(db, request.dict())
        
        # Queue enrichment task
        message = enrich_lead_task.send({
            "id": str(lead.id),
            **request.dict()
        })
        
        return {
            "status": "queued",
            "lead_id": lead.id,
            "message_id": message.message_id,
            "estimated_completion": "2-5 minutes"
        }
    except Exception as e:
        logger.error(f"Lead enrichment failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to enrich lead")

@app.post("/bulk-enrich")
async def bulk_enrich_leads(request: BulkEnrichmentRequest):
    """
    Bulk lead enrichment endpoint.
    Processes multiple leads concurrently.
    """
    try:
        message_ids = []
        
        for lead_data in request.leads:
            message = enrich_lead_task.send(lead_data.dict())
            message_ids.append({
                "email": lead_data.email,
                "message_id": message.message_id
            })
        
        return {
            "status": "queued",
            "total_leads": len(request.leads),
            "message_ids": message_ids,
            "priority": request.priority
        }
    except Exception as e:
        logger.error(f"Bulk enrichment failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to queue bulk enrichment")

@app.get("/job-status/{message_id}")
async def get_job_status(message_id: str):
    """
    Get job status by message ID.
    Replaces n8n execution status tracking.
    """
    try:
        # Get job status from Redis (Dramatiq stores job info there)
        job_key = f"dramatiq:default.DQ.msgs"
        
        # This is simplified - in production you'd implement proper job tracking
        return {
            "message_id": message_id,
            "status": "processing",
            "created_at": "2025-08-24T12:00:00Z"
        }
    except Exception as e:
        logger.error(f"Job status check failed: {str(e)}")
        raise HTTPException(status_code=404, detail="Job not found")

@app.get("/leads/{lead_id}/enrichment")
async def get_lead_enrichment(lead_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get enrichment results for a specific lead.
    """
    try:
        from database import get_lead_enrichment
        enrichment = await get_lead_enrichment(db, lead_id)
        
        if not enrichment:
            raise HTTPException(status_code=404, detail="Lead not found")
            
        return enrichment
    except Exception as e:
        logger.error(f"Get enrichment failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get lead enrichment")

@app.post("/scrape-website")
async def scrape_website_endpoint(url: str, depth: int = 1):
    """
    Manual website scraping endpoint.
    Replaces Apify node functionality.
    """
    try:
        message = scrape_website_task.send(url, depth)
        
        return {
            "status": "queued",
            "url": url,
            "message_id": message.message_id,
            "depth": depth
        }
    except Exception as e:
        logger.error(f"Website scraping failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to queue website scraping")

@app.post("/generate-insights")
async def generate_insights_endpoint(
    company_data: Dict[str, Any],
    context: Optional[str] = None
):
    """
    Generate AI insights from company data.
    Replaces n8n AI processing nodes.
    """
    try:
        message = generate_ai_insights_task.send(company_data, context)
        
        return {
            "status": "queued",
            "message_id": message.message_id,
            "company": company_data.get("company_name", "Unknown")
        }
    except Exception as e:
        logger.error(f"AI insights generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate insights")

# === METRICS AND MONITORING ===

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint."""
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    from fastapi.responses import Response
    
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )