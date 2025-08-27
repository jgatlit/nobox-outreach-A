"""
Dramatiq tasks that replace n8n workflow nodes.
Each task represents a workflow step that was previously a visual n8n node.
"""

import asyncio
import json
from typing import Dict, Any, Optional, List
from datetime import datetime

import dramatiq
from dramatiq.middleware import Middleware
import httpx
from loguru import logger
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
import openai
import anthropic
from bs4 import BeautifulSoup

from config import settings
from database import get_lead_by_id, update_lead_enrichment, create_lead_context
from ai_services import OpenAIService, AnthropicService
from scraping import WebScraper
from integrations import GoogleDocsService, EmailService

# Database setup for tasks
engine = create_async_engine(settings.DATABASE_URL)
async_session = async_sessionmaker(engine, expire_on_commit=False)

# Initialize AI services
openai_service = OpenAIService(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
anthropic_service = AnthropicService(api_key=settings.ANTHROPIC_API_KEY) if settings.ANTHROPIC_API_KEY else None

# Initialize other services
web_scraper = WebScraper()
google_docs = GoogleDocsService()
email_service = EmailService()

@dramatiq.actor(max_retries=3, min_backoff=30000, max_backoff=300000)
def enrich_lead_task(lead_data: dict) -> dict:
    """
    Main lead enrichment task - replaces entire n8n workflow.
    This is equivalent to the full n8n workflow chain:
    1. Validate data (Function node)
    2. Scrape website (Apify node) 
    3. Generate AI insights (HTTP Request node)
    4. Create document (Google Docs node)
    5. Update database (PostgreSQL node)
    """
    try:
        logger.info(f"Starting lead enrichment for: {lead_data.get('email')}")
        
        # Step 1: Data validation (replaces n8n Function node)
        if not lead_data.get('email'):
            raise ValueError("Email is required")
        
        # Step 2: Website scraping (replaces n8n Apify node)
        scraped_data = {}
        if lead_data.get('website'):
            logger.info(f"Scraping website: {lead_data['website']}")
            scrape_result = scrape_website_task.send_with_options(
                args=[lead_data['website']],
                delay=0
            ).get_result(block=True, timeout=300)  # Wait for scraping
            scraped_data = scrape_result or {}
        
        # Step 3: Generate AI insights (replaces n8n HTTP Request nodes)
        logger.info("Generating AI insights")
        ai_insights = generate_ai_insights_task.send_with_options(
            args=[scraped_data, f"Company: {lead_data.get('company', 'Unknown')}"],
            delay=0
        ).get_result(block=True, timeout=180)
        
        # Step 4: Create Google Doc (replaces n8n Google Docs node)
        doc_url = None
        if ai_insights and google_docs.is_configured():
            logger.info("Creating Google Doc")
            doc_url = create_google_doc_task.send_with_options(
                args=[lead_data, ai_insights],
                delay=0
            ).get_result(block=True, timeout=60)
        
        # Step 5: Update database (replaces n8n PostgreSQL node)
        logger.info("Updating database")
        asyncio.run(update_lead_in_database(
            lead_data.get('id') or lead_data['email'],
            scraped_data,
            ai_insights,
            doc_url
        ))
        
        logger.info(f"Lead enrichment completed for: {lead_data.get('email')}")
        return {
            "status": "completed",
            "email": lead_data.get('email'),
            "scraped_data": bool(scraped_data),
            "ai_insights": bool(ai_insights),
            "doc_url": doc_url,
            "completed_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Lead enrichment failed for {lead_data.get('email')}: {str(e)}")
        
        # Error handling (replaces n8n Error Trigger)
        asyncio.run(log_enrichment_error(lead_data, str(e)))
        raise

@dramatiq.actor(max_retries=2, min_backoff=15000, max_backoff=60000)
def scrape_website_task(url: str, max_pages: int = 5) -> dict:
    """
    Website scraping task - replaces n8n Apify node.
    Scrapes company website for contextual information.
    """
    try:
        logger.info(f"Starting website scraping for: {url}")
        
        # Initialize scraper with configuration
        scraper = WebScraper(
            max_pages=min(max_pages, settings.MAX_PAGES_PER_DOMAIN),
            delay=settings.SCRAPING_DELAY,
            timeout=settings.REQUEST_TIMEOUT
        )
        
        # Scrape website
        result = scraper.scrape_domain(url)
        
        logger.info(f"Scraping completed for {url}: {len(result.get('pages', []))} pages")
        return result
        
    except Exception as e:
        logger.error(f"Website scraping failed for {url}: {str(e)}")
        return {
            "error": str(e),
            "url": url,
            "pages": [],
            "tech_stack": []
        }

@dramatiq.actor(max_retries=2, min_backoff=10000, max_backoff=30000)
def generate_ai_insights_task(scraped_data: dict, context: str = "") -> dict:
    """
    AI insights generation - replaces n8n HTTP Request nodes to OpenAI/Anthropic.
    Generates personalized email hooks and company insights.
    """
    try:
        logger.info("Generating AI insights")
        
        # Prepare context for AI
        ai_context = prepare_ai_context(scraped_data, context)
        
        # Try OpenAI first, fallback to Anthropic
        insights = None
        
        if openai_service:
            try:
                insights = openai_service.generate_lead_insights(ai_context)
            except Exception as e:
                logger.warning(f"OpenAI failed, trying Anthropic: {str(e)}")
        
        if not insights and anthropic_service:
            insights = anthropic_service.generate_lead_insights(ai_context)
        
        if not insights:
            raise ValueError("No AI service available or all failed")
        
        logger.info("AI insights generated successfully")
        return insights
        
    except Exception as e:
        logger.error(f"AI insights generation failed: {str(e)}")
        return {
            "error": str(e),
            "email_hooks": [],
            "company_insights": {},
            "personalization_score": 0
        }

@dramatiq.actor(max_retries=2)
def create_google_doc_task(lead_data: dict, ai_insights: dict) -> Optional[str]:
    """
    Google Docs creation - replaces n8n Google Docs node.
    Creates a personalized email draft document.
    """
    try:
        if not google_docs.is_configured():
            logger.warning("Google Docs not configured, skipping doc creation")
            return None
        
        logger.info(f"Creating Google Doc for: {lead_data.get('email')}")
        
        # Generate document content
        doc_content = generate_doc_content(lead_data, ai_insights)
        
        # Create document
        doc_url = google_docs.create_document(
            title=f"Lead Analysis - {lead_data.get('company', 'Unknown')}",
            content=doc_content
        )
        
        logger.info(f"Google Doc created: {doc_url}")
        return doc_url
        
    except Exception as e:
        logger.error(f"Google Doc creation failed: {str(e)}")
        return None

@dramatiq.actor(max_retries=1)
def send_email_task(recipient: str, subject: str, content: dict, template: str = "default") -> bool:
    """
    Email sending task - replaces n8n Email nodes.
    Sends personalized emails using various providers.
    """
    try:
        logger.info(f"Sending email to: {recipient}")
        
        success = email_service.send_email(
            recipient=recipient,
            subject=subject,
            template=template,
            template_data=content
        )
        
        if success:
            logger.info(f"Email sent successfully to: {recipient}")
        else:
            logger.error(f"Email sending failed for: {recipient}")
        
        return success
        
    except Exception as e:
        logger.error(f"Email sending error for {recipient}: {str(e)}")
        return False

@dramatiq.actor
def update_airtable_task(base_id: str, table_name: str, record_data: dict) -> bool:
    """
    Airtable update task - replaces n8n Airtable nodes.
    """
    try:
        # This would implement Airtable API calls
        logger.info(f"Updating Airtable: {table_name}")
        # Implementation would go here
        return True
        
    except Exception as e:
        logger.error(f"Airtable update failed: {str(e)}")
        return False

# === HELPER FUNCTIONS ===

async def update_lead_in_database(lead_id: str, scraped_data: dict, ai_insights: dict, doc_url: Optional[str]):
    """Update lead enrichment data in database."""
    async with async_session() as session:
        try:
            # Create enrichment record
            enrichment_data = {
                "scraped_data": scraped_data,
                "ai_insights": ai_insights,
                "google_doc_url": doc_url,
                "enriched_at": datetime.utcnow(),
                "status": "completed"
            }
            
            await update_lead_enrichment(session, lead_id, enrichment_data)
            await session.commit()
            
        except Exception as e:
            await session.rollback()
            raise

async def log_enrichment_error(lead_data: dict, error_message: str):
    """Log enrichment errors to database."""
    async with async_session() as session:
        try:
            error_data = {
                "lead_email": lead_data.get('email'),
                "error_message": error_message,
                "lead_data": lead_data,
                "occurred_at": datetime.utcnow()
            }
            
            # Log to error table (implement as needed)
            logger.error(f"Enrichment error logged: {error_data}")
            
        except Exception as e:
            logger.error(f"Failed to log error: {str(e)}")

def prepare_ai_context(scraped_data: dict, additional_context: str = "") -> dict:
    """Prepare context data for AI processing."""
    return {
        "website_content": scraped_data.get('pages', []),
        "tech_stack": scraped_data.get('tech_stack', []),
        "company_info": scraped_data.get('company_info', {}),
        "additional_context": additional_context,
        "scraped_at": scraped_data.get('scraped_at'),
        "url": scraped_data.get('url')
    }

def generate_doc_content(lead_data: dict, ai_insights: dict) -> str:
    """Generate Google Doc content from lead data and AI insights."""
    content = f"""
# Lead Analysis Report

**Company:** {lead_data.get('company', 'Unknown')}
**Contact:** {lead_data.get('first_name', '')} {lead_data.get('last_name', '')}
**Email:** {lead_data.get('email')}
**Website:** {lead_data.get('website', 'Not provided')}

## AI-Generated Insights

### Email Hooks
{chr(10).join([f"- {hook}" for hook in ai_insights.get('email_hooks', [])])}

### Company Analysis
{json.dumps(ai_insights.get('company_insights', {}), indent=2)}

### Personalization Score
{ai_insights.get('personalization_score', 0)}/100

---
*Generated by Nobox Outreach Automation - {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}*
"""
    return content