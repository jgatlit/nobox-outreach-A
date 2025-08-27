"""
NoBox Outreach Orchestrator - Main Entry Point
Integration layer between LangGraph workflow and existing Express.js system.
"""

import os
import asyncio
import logging
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager

from .workflows.outreach_workflow import create_outreach_orchestrator
from .state.outreach_state import OutreachState, WorkflowStatus

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global orchestrator instance
orchestrator: Optional[Any] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup orchestrator."""
    global orchestrator
    
    # Initialize orchestrator
    openai_api_key = os.getenv('OPENAI_API_KEY')
    database_url = os.getenv('DATABASE_URL')
    
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY environment variable required")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable required")
    
    try:
        orchestrator = create_outreach_orchestrator(openai_api_key, database_url)
        logger.info("Orchestrator initialized successfully")
        yield
    except Exception as e:
        logger.error(f"Failed to initialize orchestrator: {str(e)}")
        raise
    finally:
        orchestrator = None
        logger.info("Orchestrator cleanup completed")


# FastAPI app with lifespan management
app = FastAPI(
    title="NoBox Outreach Orchestrator",
    description="LangGraph workflow orchestration for intelligent email campaigns",
    version="1.0.0",
    lifespan=lifespan
)


# Request/Response Models
class CampaignExecutionRequest(BaseModel):
    campaign_id: str = Field(..., description="Unique campaign identifier")
    prospect_ids: List[str] = Field(..., description="List of prospect IDs to process")
    options: Dict[str, Any] = Field(default_factory=dict, description="Additional campaign options")


class ProspectRequest(BaseModel):
    prospect_id: str = Field(..., description="Unique prospect identifier")
    campaign_id: str = Field(..., description="Associated campaign ID")
    options: Dict[str, Any] = Field(default_factory=dict, description="Processing options")


class WorkflowStatusResponse(BaseModel):
    thread_id: str
    status: str
    current_step: str
    progress: float
    errors: List[Dict[str, Any]]
    created_at: str
    updated_at: str


class CampaignResultResponse(BaseModel):
    campaign_id: str
    total_prospects: int
    completed: int
    errors: int
    success_rate: float
    results: List[Dict[str, Any]]


# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "orchestrator_ready": orchestrator is not None,
        "timestamp": asyncio.get_event_loop().time()
    }


@app.post("/campaigns/execute", response_model=CampaignResultResponse)
async def execute_campaign(
    request: CampaignExecutionRequest,
    background_tasks: BackgroundTasks
):
    """
    Execute outreach campaign for given prospects.
    This is the main entry point from existing Express.js system.
    """
    
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")
    
    logger.info(f"Executing campaign {request.campaign_id} for {len(request.prospect_ids)} prospects")
    
    try:
        # Execute campaign workflow
        result = await orchestrator.execute_campaign(
            request.campaign_id,
            request.prospect_ids
        )
        
        # Calculate success rate
        success_rate = result['completed'] / result['total_prospects'] if result['total_prospects'] > 0 else 0
        
        return CampaignResultResponse(
            campaign_id=result['campaign_id'],
            total_prospects=result['total_prospects'],
            completed=result['completed'],
            errors=result['errors'],
            success_rate=success_rate,
            results=result['results']
        )
        
    except Exception as e:
        logger.error(f"Campaign execution failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Campaign execution failed: {str(e)}")


@app.post("/prospects/process")
async def process_single_prospect(request: ProspectRequest):
    """
    Process single prospect through workflow.
    Useful for testing and individual prospect processing.
    """
    
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")
    
    logger.info(f"Processing single prospect {request.prospect_id} for campaign {request.campaign_id}")
    
    try:
        # Execute workflow for single prospect
        result = await orchestrator.execute_campaign(
            request.campaign_id,
            [request.prospect_id]
        )
        
        if result['results']:
            return result['results'][0]
        else:
            raise HTTPException(status_code=404, detail="No results generated")
            
    except Exception as e:
        logger.error(f"Prospect processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prospect processing failed: {str(e)}")


@app.get("/workflows/{thread_id}/status", response_model=WorkflowStatusResponse)
async def get_workflow_status(thread_id: str):
    """
    Get current status of workflow execution.
    Useful for monitoring long-running campaigns.
    """
    
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")
    
    try:
        # Get workflow state from checkpointer
        # This would retrieve state from PostgreSQL via LangGraph checkpointer
        
        # Mock response for Phase 1
        return WorkflowStatusResponse(
            thread_id=thread_id,
            status="running",
            current_step="message_composition",
            progress=0.6,
            errors=[],
            created_at="2025-01-01T00:00:00Z",
            updated_at="2025-01-01T00:00:00Z"
        )
        
    except Exception as e:
        logger.error(f"Failed to get workflow status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status retrieval failed: {str(e)}")


@app.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(campaign_id: str):
    """Pause campaign execution."""
    
    # Phase 2+ feature - workflow control
    logger.info(f"Pausing campaign {campaign_id}")
    
    return {"message": f"Campaign {campaign_id} paused", "status": "paused"}


@app.post("/campaigns/{campaign_id}/resume")
async def resume_campaign(campaign_id: str):
    """Resume paused campaign execution."""
    
    # Phase 2+ feature - workflow control
    logger.info(f"Resuming campaign {campaign_id}")
    
    return {"message": f"Campaign {campaign_id} resumed", "status": "running"}


@app.get("/strategies/performance")
async def get_strategy_performance():
    """
    Get performance metrics for psychological strategies.
    Phase 2+ feature for strategy optimization.
    """
    
    # Mock data for Phase 1
    return {
        "strategies": [
            {
                "name": "pattern_disruption",
                "messages_sent": 150,
                "replies_received": 12,
                "reply_rate": 0.08,
                "effectiveness_score": 0.75
            },
            {
                "name": "ego_relevance", 
                "messages_sent": 100,
                "replies_received": 15,
                "reply_rate": 0.15,
                "effectiveness_score": 0.85
            }
        ],
        "top_performer": "ego_relevance",
        "overall_improvement": 0.23
    }


# Development endpoints
@app.get("/debug/state/{thread_id}")
async def debug_workflow_state(thread_id: str):
    """Debug endpoint to inspect workflow state."""
    
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")
    
    # This would retrieve and return the full workflow state
    # Useful for debugging and development
    
    return {
        "thread_id": thread_id,
        "debug_info": "Workflow state debugging - Phase 1 implementation",
        "note": "Full state inspection will be available in Phase 1 completion"
    }


if __name__ == "__main__":
    import uvicorn
    
    # Development server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8054,  # Dedicated port for orchestrator service
        log_level="info",
        reload=True
    )