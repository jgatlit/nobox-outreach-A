"""
Pydantic models for request/response validation.
Provides type safety and API documentation.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, HttpUrl, Field, field_validator
import uuid

# === REQUEST MODELS ===

class LeadData(BaseModel):
    """Base lead data model."""
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    website: Optional[HttpUrl] = None
    lead_source: str = "manual"
    status: str = "pending"
    
    @field_validator('lead_source')
    def validate_lead_source(cls, v):
        valid_sources = ['manual', 'csv', 'api', 'webhook', 'linkedin', 'pipedrive', 'airtable']
        if v not in valid_sources:
            raise ValueError(f'Invalid lead source. Must be one of: {valid_sources}')
        return v

class EnrichmentRequest(BaseModel):
    """Lead enrichment request model."""
    lead_data: LeadData
    priority: str = Field(default="normal", pattern="^(low|normal|high|urgent)$")
    include_ai_insights: bool = True
    include_document_creation: bool = True
    max_scrape_pages: int = Field(default=5, ge=1, le=20)

class BulkEnrichmentRequest(BaseModel):
    """Bulk lead enrichment request."""
    leads: List[LeadData]
    priority: str = "normal"
    batch_size: int = Field(default=10, ge=1, le=50)
    
    @field_validator('leads')
    def validate_leads_count(cls, v):
        if len(v) > 100:
            raise ValueError('Maximum 100 leads per bulk request')
        return v

class WebScrapingRequest(BaseModel):
    """Website scraping request."""
    url: HttpUrl
    max_pages: int = Field(default=5, ge=1, le=20)
    include_tech_stack: bool = True
    include_content_analysis: bool = True
    depth_limit: int = Field(default=2, ge=1, le=3)

class AIInsightsRequest(BaseModel):
    """AI insights generation request."""
    company_data: Dict[str, Any]
    context: Optional[str] = None
    insight_types: List[str] = Field(default=["email_hooks", "company_analysis", "personalization"])
    target_audience: str = "b2b_decision_makers"

# === RESPONSE MODELS ===

class BaseResponse(BaseModel):
    """Base response model."""
    status: str
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class JobResponse(BaseResponse):
    """Job queuing response."""
    job_id: str
    estimated_completion: Optional[str] = None
    priority: str = "normal"

class LeadEnrichmentResponse(BaseModel):
    """Lead enrichment result."""
    lead_id: str
    email: EmailStr
    status: str
    ai_insights: Dict[str, Any] = Field(default_factory=dict)
    email_hooks: List[str] = Field(default_factory=list)
    personalization_score: float = 0.0
    scraped_data: Dict[str, Any] = Field(default_factory=dict)
    google_doc_url: Optional[str] = None
    processing_time: Optional[float] = None
    enriched_at: datetime

class ScrapingResult(BaseModel):
    """Website scraping result."""
    url: str
    pages_scraped: int
    tech_stack: List[str] = Field(default_factory=list)
    company_info: Dict[str, Any] = Field(default_factory=dict)
    content_summary: str = ""
    scraping_time: float
    status: str = "completed"

class AIInsightsResult(BaseModel):
    """AI-generated insights result."""
    company_name: Optional[str] = None
    email_hooks: List[str] = Field(default_factory=list)
    company_insights: Dict[str, Any] = Field(default_factory=dict)
    personalization_score: float = 0.0
    recommended_approach: str = ""
    confidence_level: str = "medium"
    generated_at: datetime = Field(default_factory=datetime.utcnow)

class EnrichmentResult(BaseModel):
    """Complete enrichment result."""
    lead: LeadEnrichmentResponse
    scraping: Optional[ScrapingResult] = None
    ai_insights: Optional[AIInsightsResult] = None
    documents_created: List[str] = Field(default_factory=list)
    total_processing_time: float
    status: str

class HealthCheckResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    version: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    dependencies: Dict[str, str] = Field(default_factory=dict)

class JobStatusResponse(BaseModel):
    """Job status response."""
    job_id: str
    status: str  # queued, processing, completed, failed
    progress: Optional[float] = None  # 0.0 to 1.0
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

# === DATABASE MODELS (Pydantic versions) ===

class LeadModel(BaseModel):
    """Lead database model."""
    id: int
    uuid: uuid.UUID
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    website: Optional[str] = None
    lead_source: str
    status: str
    lead_score: int = 0
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class LeadContextModel(BaseModel):
    """Lead context model."""
    id: int
    lead_id: int
    url: str
    content: Dict[str, Any]
    tech_stack: List[str]
    scraped_at: datetime
    scrape_status: str
    
    class Config:
        from_attributes = True

class CampaignModel(BaseModel):
    """Campaign model."""
    id: int
    uuid: uuid.UUID
    name: str
    description: Optional[str] = None
    campaign_type: str
    status: str
    total_leads: int = 0
    sent_count: int = 0
    opened_count: int = 0
    replied_count: int = 0
    created_at: datetime
    launched_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# === VALIDATION HELPERS ===

class EmailValidation(BaseModel):
    """Email validation result."""
    email: EmailStr
    is_valid: bool
    is_disposable: bool = False
    is_role_based: bool = False
    confidence: float = 1.0

class CompanyValidation(BaseModel):
    """Company validation result."""
    company_name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    confidence: float = 0.0

# === ERROR MODELS ===

class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    error_code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ValidationErrorResponse(BaseModel):
    """Validation error response."""
    error: str = "Validation failed"
    validation_errors: List[Dict[str, Any]]
    timestamp: datetime = Field(default_factory=datetime.utcnow)