"""
Database models and operations for PostgreSQL + pgvector.
Uses modern PostgreSQL 17 features and identity columns.
"""

import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import text, String, Integer, DateTime, JSON, Boolean, Text, Float
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID, ARRAY
from pgvector.sqlalchemy import Vector
import asyncpg

class Base(DeclarativeBase):
    """Base class for all database models."""
    pass

class Lead(Base):
    """Lead model with modern PostgreSQL identity columns."""
    __tablename__ = "leads"
    
    # Use auto-incrementing primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Contact information
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Company information
    company: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    position: Mapped[Optional[str]] = mapped_column(String(255))
    website: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Lead metadata
    lead_source: Mapped[str] = mapped_column(String(50), default="manual", index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    lead_score: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    contexts = relationship("LeadContext", back_populates="lead", cascade="all, delete-orphan")
    enrichments = relationship("LeadEnrichment", back_populates="lead", cascade="all, delete-orphan")

class LeadContext(Base):
    """Lead context from web scraping with vector embeddings."""
    __tablename__ = "lead_context"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lead_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    
    # Scraped content
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[Dict[str, Any]] = mapped_column(JSON)
    tech_stack: Mapped[List[str]] = mapped_column(ARRAY(String))
    
    # Vector embedding for similarity search (1536 dimensions for OpenAI)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(1536))
    
    # Metadata
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    scrape_status: Mapped[str] = mapped_column(String(20), default="pending")
    
    # Relationship
    lead = relationship("Lead", back_populates="contexts")

class LeadEnrichment(Base):
    """AI enrichment results for leads."""
    __tablename__ = "lead_enrichments"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lead_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    
    # AI-generated insights
    ai_insights: Mapped[Dict[str, Any]] = mapped_column(JSON)
    email_hooks: Mapped[List[str]] = mapped_column(ARRAY(String))
    personalization_score: Mapped[float] = mapped_column(Float, default=0.0)
    
    # Generated content
    google_doc_url: Mapped[Optional[str]] = mapped_column(String(500))
    email_draft: Mapped[Optional[str]] = mapped_column(Text)
    
    # Processing metadata
    enriched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(20), default="completed", index=True)
    processing_time: Mapped[Optional[float]] = mapped_column(Float)  # seconds
    
    # Relationship
    lead = relationship("Lead", back_populates="enrichments")

class Campaign(Base):
    """Email campaigns and sequences."""
    __tablename__ = "campaigns"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Campaign configuration
    campaign_type: Mapped[str] = mapped_column(String(50), default="email")  # email, linkedin, etc.
    target_audience: Mapped[Dict[str, Any]] = mapped_column(JSON)
    
    # Status and metrics
    status: Mapped[str] = mapped_column(String(20), default="draft")
    total_leads: Mapped[int] = mapped_column(Integer, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    opened_count: Mapped[int] = mapped_column(Integer, default=0)
    replied_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    launched_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

class EmailTemplate(Base):
    """Email templates with versioning."""
    __tablename__ = "email_templates"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(Text)
    
    # Template metadata
    template_type: Mapped[str] = mapped_column(String(50), default="outreach")
    version: Mapped[str] = mapped_column(String(20), default="1.0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Performance metrics
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_open_rate: Mapped[float] = mapped_column(Float, default=0.0)
    avg_reply_rate: Mapped[float] = mapped_column(Float, default=0.0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class JobLog(Base):
    """Job execution logs for monitoring."""
    __tablename__ = "job_logs"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    job_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    job_type: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Job details
    lead_id: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    
    # Execution data
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    duration: Mapped[Optional[float]] = mapped_column(Float)  # seconds
    
    # Error handling
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Additional data
    job_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON)

# === DATABASE FUNCTIONS ===

async def init_database(engine: AsyncEngine):
    """Initialize database with tables and extensions."""
    async with engine.begin() as conn:
        # Enable pgvector extension
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        
        # Create tables
        await conn.run_sync(Base.metadata.create_all)
        
        # Create HNSW index for vector similarity search (production optimized)
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_lead_context_embedding_hnsw 
            ON lead_context USING hnsw (embedding vector_cosine_ops) 
            WITH (m = 16, ef_construction = 64)
        """))
        
        # Create additional indexes for performance
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_leads_company_status 
            ON leads (company, status) WHERE company IS NOT NULL
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_lead_context_lead_url 
            ON lead_context (lead_id, url)
        """))

async def create_lead(session: AsyncSession, lead_data: dict) -> Lead:
    """Create a new lead record."""
    lead = Lead(
        email=lead_data["email"],
        first_name=lead_data.get("first_name"),
        last_name=lead_data.get("last_name"),
        company=lead_data.get("company"),
        position=lead_data.get("position"),
        website=lead_data.get("website"),
        lead_source=lead_data.get("lead_source", "manual"),
        status=lead_data.get("status", "pending"),
        lead_score=lead_data.get("lead_score", 0)
    )
    
    session.add(lead)
    await session.flush()  # Get the ID
    return lead

async def get_lead_by_id(session: AsyncSession, lead_id: str) -> Optional[Lead]:
    """Get lead by ID or UUID."""
    from sqlalchemy import select
    
    # Try to get by integer ID first, then by UUID
    try:
        lead_int_id = int(lead_id)
        stmt = select(Lead).where(Lead.id == lead_int_id)
    except ValueError:
        # Not an integer, try UUID
        stmt = select(Lead).where(Lead.uuid == lead_id)
    
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

async def update_lead_enrichment(session: AsyncSession, lead_id: str, enrichment_data: dict):
    """Update or create lead enrichment data."""
    lead = await get_lead_by_id(session, lead_id)
    if not lead:
        raise ValueError(f"Lead not found: {lead_id}")
    
    # Create or update enrichment
    enrichment = LeadEnrichment(
        lead_id=lead.id,
        ai_insights=enrichment_data.get("ai_insights", {}),
        email_hooks=enrichment_data.get("email_hooks", []),
        personalization_score=enrichment_data.get("personalization_score", 0.0),
        google_doc_url=enrichment_data.get("google_doc_url"),
        email_draft=enrichment_data.get("email_draft"),
        status=enrichment_data.get("status", "completed"),
        processing_time=enrichment_data.get("processing_time")
    )
    
    session.add(enrichment)
    
    # Update lead status
    lead.status = "enriched"
    lead.updated_at = datetime.utcnow()

async def create_lead_context(session: AsyncSession, lead_id: int, context_data: dict):
    """Create lead context from scraped data."""
    context = LeadContext(
        lead_id=lead_id,
        url=context_data["url"],
        content=context_data.get("content", {}),
        tech_stack=context_data.get("tech_stack", []),
        embedding=context_data.get("embedding"),
        scrape_status=context_data.get("status", "completed")
    )
    
    session.add(context)
    return context

async def find_similar_leads(session: AsyncSession, embedding: List[float], limit: int = 5) -> List[Lead]:
    """Find similar leads using vector similarity search."""
    from sqlalchemy import select
    
    # Use cosine similarity for finding similar company contexts
    stmt = text("""
        SELECT l.*, lc.embedding <=> :embedding AS similarity
        FROM leads l
        JOIN lead_context lc ON l.id = lc.lead_id
        WHERE lc.embedding IS NOT NULL
        ORDER BY similarity
        LIMIT :limit
    """)
    
    result = await session.execute(
        stmt, 
        {"embedding": embedding, "limit": limit}
    )
    
    # This would need proper ORM mapping in production
    return result.fetchall()

async def get_lead_enrichment(session: AsyncSession, lead_id: str) -> Optional[Dict[str, Any]]:
    """Get enrichment results for a lead."""
    from sqlalchemy import select
    
    lead = await get_lead_by_id(session, lead_id)
    if not lead:
        return None
    
    # Get latest enrichment
    stmt = select(LeadEnrichment).where(
        LeadEnrichment.lead_id == lead.id
    ).order_by(LeadEnrichment.enriched_at.desc())
    
    result = await session.execute(stmt)
    enrichment = result.scalar_one_or_none()
    
    if not enrichment:
        return None
    
    return {
        "lead_id": lead.id,
        "email": lead.email,
        "company": lead.company,
        "ai_insights": enrichment.ai_insights,
        "email_hooks": enrichment.email_hooks,
        "personalization_score": enrichment.personalization_score,
        "google_doc_url": enrichment.google_doc_url,
        "enriched_at": enrichment.enriched_at.isoformat(),
        "status": enrichment.status
    }