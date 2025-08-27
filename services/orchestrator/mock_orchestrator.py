"""
Mock Orchestrator for Phase 1 Validation
Simple FastAPI service that demonstrates zero-regression integration
without requiring full LangGraph setup.
"""

import os
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Request/Response Models
class CampaignExecutionRequest(BaseModel):
    campaign_id: str = Field(..., description="Unique campaign identifier")
    prospect_ids: List[str] = Field(..., description="List of prospect IDs to process")
    options: Dict[str, Any] = Field(default_factory=dict, description="Additional campaign options")

class ProspectRequest(BaseModel):
    prospect_id: str = Field(..., description="Unique prospect identifier")
    campaign_id: str = Field(..., description="Associated campaign ID")
    options: Dict[str, Any] = Field(default_factory=dict, description="Processing options")

class CampaignResultResponse(BaseModel):
    campaign_id: str
    total_prospects: int
    completed: int
    errors: int
    success_rate: float
    results: List[Dict[str, Any]]

# FastAPI app
app = FastAPI(
    title="NoBox Outreach Orchestrator (Mock)",
    description="Phase 1 validation service for zero-regression testing",
    version="1.0.0-alpha"
)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "orchestrator_ready": True,
        "timestamp": datetime.now().isoformat(),
        "phase": "Phase 1 - Mock Service"
    }

@app.post("/campaigns/execute", response_model=CampaignResultResponse)
async def execute_campaign(request: CampaignExecutionRequest):
    """
    Mock campaign execution that simulates the existing email generation process.
    This demonstrates zero-regression by returning the same structure as the real system.
    """
    
    print(f"Mock: Executing campaign {request.campaign_id} for {len(request.prospect_ids)} prospects")
    
    # Simulate processing each prospect
    results = []
    for prospect_id in request.prospect_ids:
        # Mock the existing email generation result
        email_result = {
            "subject": f"Quick question about your business growth - {prospect_id}",
            "body": f"Hi there,\n\nI noticed your work and wanted to reach out about potential opportunities.\n\nBest regards,\nThe NoBox Team",
            "personalization_level": "medium",
            "generated_at": datetime.now().isoformat()
        }
        
        results.append({
            "prospect_id": prospect_id,
            "status": "completed",
            "email_result": email_result,
            "source": "mock_orchestrator"
        })
        
        # Small delay to simulate processing
        await asyncio.sleep(0.1)
    
    success_rate = 1.0  # 100% success for mock
    
    return CampaignResultResponse(
        campaign_id=request.campaign_id,
        total_prospects=len(request.prospect_ids),
        completed=len(results),
        errors=0,
        success_rate=success_rate,
        results=results
    )

@app.post("/prospects/process")
async def process_single_prospect(request: ProspectRequest):
    """
    Mock single prospect processing.
    Returns the same structure as the existing system.
    """
    
    print(f"Mock: Processing single prospect {request.prospect_id} for campaign {request.campaign_id}")
    
    # Mock email result matching existing system format
    email_result = {
        "subject": f"Quick question about your business - {request.prospect_id}",
        "body": f"Hi there,\n\nI noticed your work and wanted to reach out...\n\nBest regards",
        "personalization_level": "basic",
        "generated_at": datetime.now().isoformat()
    }
    
    return {
        "prospect_id": request.prospect_id,
        "status": "completed",
        "email_result": email_result,
        "source": "mock_orchestrator",
        "processing_time_ms": 100
    }

@app.get("/workflows/{thread_id}/status")
async def get_workflow_status(thread_id: str):
    """Mock workflow status."""
    return {
        "thread_id": thread_id,
        "status": "completed",
        "current_step": "performance_tracking",
        "progress": 1.0,
        "errors": [],
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "note": "Mock service - Phase 1 validation"
    }

@app.get("/strategies/performance")
async def get_strategy_performance():
    """Mock strategy performance data."""
    return {
        "strategies": [
            {
                "name": "existing_system_baseline",
                "messages_sent": 100,
                "replies_received": 5,
                "reply_rate": 0.05,
                "effectiveness_score": 0.5
            }
        ],
        "top_performer": "existing_system_baseline",
        "overall_improvement": 0.0,
        "note": "Phase 1 baseline - psychological strategies coming in Phase 2"
    }

if __name__ == "__main__":
    import uvicorn
    
    # Run on port 8054 for orchestrator service
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8054,
        log_level="info"
    )