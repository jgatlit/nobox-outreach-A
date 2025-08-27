# NoBox Outreach - Implementation Scaffold
## Project Structure & Boilerplate Code

### Directory Structure

```
nobox-outreach/
├── docker-compose.yml
├── .env.example
├── README.md
├── Makefile
│
├── services/
│   ├── orchestrator/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py
│   │   │   ├── workflows/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── outreach_workflow.py
│   │   │   │   ├── nodes/
│   │   │   │   │   ├── context_gathering.py
│   │   │   │   │   ├── enrichment.py
│   │   │   │   │   ├── strategy_selection.py
│   │   │   │   │   ├── message_generation.py
│   │   │   │   │   └── sequence_orchestration.py
│   │   │   │   └── edges/
│   │   │   │       ├── conditional_routing.py
│   │   │   │       └── self_correction.py
│   │   │   ├── state/
│   │   │   │   ├── __init__.py
│   │   │   │   └── outreach_state.py
│   │   │   └── checkpointing/
│   │   │       └── postgres_saver.py
│   │
│   ├── api/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py
│   │   │   ├── routers/
│   │   │   │   ├── campaigns.py
│   │   │   │   ├── prospects.py
│   │   │   │   ├── messages.py
│   │   │   │   └── analytics.py
│   │   │   ├── models/
│   │   │   │   ├── campaign.py
│   │   │   │   ├── prospect.py
│   │   │   │   └── message.py
│   │   │   ├── schemas/
│   │   │   │   └── requests.py
│   │   │   └── dependencies/
│   │   │       ├── auth.py
│   │   │       └── database.py
│   │
│   ├── worker/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── tasks.py
│   │   │   ├── enrichment/
│   │   │   │   ├── apollo.py
│   │   │   │   ├── clay.py
│   │   │   │   └── browser.py
│   │   │   ├── generation/
│   │   │   │   ├── psychology.py
│   │   │   │   ├── hooks.py
│   │   │   │   └── composer.py
│   │   │   └── sending/
│   │   │       ├── email.py
│   │   │       ├── linkedin.py
│   │   │       └── scheduler.py
│   │
│   └── mcp-gateway/
│       ├── Dockerfile
│       ├── package.json
│       ├── src/
│       │   ├── index.js
│       │   └── servers/
│       │       ├── apollo.js
│       │       ├── clay.js
│       │       └── browser.js
│
├── infrastructure/
│   ├── terraform/
│   ├── kubernetes/
│   └── monitoring/
│       ├── prometheus/
│       └── grafana/
│
├── database/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_vectors.sql
│   │   └── 003_add_analytics.sql
│   └── seeds/
│       └── psychological_strategies.sql
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── scripts/
    ├── setup.sh
    ├── deploy.sh
    └── test.sh
```

## Core Implementation Files

### 1. Orchestrator Main Workflow

`services/orchestrator/app/workflows/outreach_workflow.py`

```python
from langgraph.graph import StateGraph, END
from typing import Dict, Any
import logging
from ..state.outreach_state import OutreachState
from ..nodes import (
    context_gathering,
    enrichment,
    strategy_selection,
    message_generation,
    sequence_orchestration
)
from ..edges import conditional_routing

logger = logging.getLogger(__name__)

class NoBoxOutreachWorkflow:
    """Main workflow orchestrating the 12-step outreach process."""
    
    def __init__(self, checkpointer=None):
        self.checkpointer = checkpointer
        self.graph = self._build_graph()
        self.app = self.graph.compile(checkpointer=checkpointer)
    
    def _build_graph(self) -> StateGraph:
        """Constructs the state machine for outreach orchestration."""
        
        workflow = StateGraph(OutreachState)
        
        # Step 1-3: Context and Analysis
        workflow.add_node("gather_context", context_gathering.gather_context_node)
        workflow.add_node("analyze_audience", context_gathering.analyze_audience_node)
        workflow.add_node("define_objectives", context_gathering.define_objectives_node)
        
        # Step 4-5: Data Enrichment
        workflow.add_node("enrich_prospect", enrichment.enrich_prospect_node)
        workflow.add_node("detect_triggers", enrichment.detect_triggers_node)
        
        # Step 6-7: Strategy Selection
        workflow.add_node("select_strategy", strategy_selection.select_strategy_node)
        workflow.add_node("generate_hooks", strategy_selection.generate_hooks_node)
        
        # Step 8-9: Message Creation
        workflow.add_node("compose_message", message_generation.compose_message_node)
        workflow.add_node("check_compliance", message_generation.compliance_check_node)
        
        # Step 10-11: Execution
        workflow.add_node("create_variants", message_generation.create_ab_variants_node)
        workflow.add_node("orchestrate_sequence", sequence_orchestration.orchestrate_node)
        
        # Step 12: Optimization
        workflow.add_node("track_performance", sequence_orchestration.track_performance_node)
        workflow.add_node("self_correct", conditional_routing.self_correction_node)
        
        # Define edges
        workflow.add_edge("gather_context", "analyze_audience")
        workflow.add_edge("analyze_audience", "define_objectives")
        workflow.add_edge("define_objectives", "enrich_prospect")
        workflow.add_edge("enrich_prospect", "detect_triggers")
        workflow.add_edge("detect_triggers", "select_strategy")
        
        # Conditional routing based on strategy
        workflow.add_conditional_edges(
            "select_strategy",
            conditional_routing.route_by_strategy,
            {
                "deep_research": "enrich_prospect",
                "standard": "generate_hooks",
                "quick": "compose_message"
            }
        )
        
        workflow.add_edge("generate_hooks", "compose_message")
        workflow.add_edge("compose_message", "check_compliance")
        
        # Compliance check routing
        workflow.add_conditional_edges(
            "check_compliance",
            conditional_routing.compliance_router,
            {
                "pass": "create_variants",
                "revise": "compose_message",
                "reject": END
            }
        )
        
        workflow.add_edge("create_variants", "orchestrate_sequence")
        workflow.add_edge("orchestrate_sequence", "track_performance")
        
        # Self-correction loop
        workflow.add_conditional_edges(
            "track_performance",
            conditional_routing.performance_router,
            {
                "optimize": "self_correct",
                "continue": "orchestrate_sequence",
                "complete": END
            }
        )
        
        workflow.add_edge("self_correct", "select_strategy")
        
        # Set entry point
        workflow.set_entry_point("gather_context")
        
        return workflow
    
    async def run(self, initial_state: Dict[str, Any], config: Dict[str, Any] = None):
        """Executes the workflow with given initial state."""
        
        try:
            logger.info(f"Starting outreach workflow for campaign: {initial_state.get('campaign_id')}")
            
            # Execute workflow
            result = await self.app.ainvoke(initial_state, config=config)
            
            logger.info(f"Workflow completed successfully for campaign: {result.get('campaign_id')}")
            return result
            
        except Exception as e:
            logger.error(f"Workflow failed: {str(e)}")
            raise
```

### 2. State Definition

`services/orchestrator/app/state/outreach_state.py`

```python
from typing import TypedDict, List, Dict, Any, Optional, Literal
from datetime import datetime
from pydantic import BaseModel

class ProspectProfile(BaseModel):
    """Enriched prospect information."""
    id: str
    email: str
    full_name: str
    title: str
    company: str
    linkedin_url: Optional[str]
    enrichment_data: Dict[str, Any]
    trigger_events: List[Dict[str, Any]]
    intent_signals: Dict[str, float]
    tier: int  # 1-3, with 1 being highest priority

class PsychologicalProfile(BaseModel):
    """Psychological strategy configuration."""
    primary_strategy: str
    secondary_strategy: str
    effectiveness_score: float
    personalization_hooks: List[str]
    rationale: str

class MessageVariant(BaseModel):
    """A/B test message variant."""
    variant_id: str
    label: Literal['A', 'B', 'C']
    subject_line: str
    body: str
    psychological_strategy: str
    personalization_level: int  # 1-10
    spam_score: float
    predicted_reply_rate: float

class OutreachState(TypedDict):
    """Complete state for outreach workflow."""
    
    # Campaign Context
    campaign_id: str
    campaign_name: str
    created_by: str
    created_at: datetime
    
    # Offer Details
    offer_type: str  # 'executive_retreat', 'coaching', 'training'
    value_proposition: str
    pricing_tier: str  # 'premium', 'enterprise', 'custom'
    key_benefits: List[str]
    
    # Target Audience
    target_personas: List[str]
    target_companies: List[str]
    target_industries: List[str]
    target_seniority: List[str]
    
    # Objectives
    primary_objective: str  # 'book_meeting', 'generate_interest', 'nurture'
    success_metrics: Dict[str, float]
    constraints: Dict[str, Any]
    
    # Prospect Data
    prospect: Optional[ProspectProfile]
    prospect_list: List[str]  # List of prospect IDs
    current_prospect_index: int
    
    # Psychological Strategy
    psychological_profile: Optional[PsychologicalProfile]
    available_strategies: List[str]
    strategy_history: List[Dict[str, Any]]
    
    # Message Generation
    message_variants: List[MessageVariant]
    selected_variant: Optional[str]
    message_templates: Dict[str, str]
    
    # Sequence State
    sequence_step: int
    sequence_status: Literal['active', 'paused', 'completed', 'failed']
    last_touchpoint: Optional[datetime]
    next_touchpoint: Optional[datetime]
    channel_states: Dict[str, str]  # {'email': 'sent', 'linkedin': 'pending'}
    
    # Performance Tracking
    messages_sent: int
    emails_opened: int
    emails_replied: int
    meetings_booked: int
    current_reply_rate: float
    ab_test_results: Dict[str, Dict[str, float]]
    
    # Self-Correction
    optimization_attempts: int
    optimization_history: List[Dict[str, Any]]
    performance_threshold: float
    requires_optimization: bool
    
    # Error Handling
    errors: List[Dict[str, Any]]
    warnings: List[str]
    retry_count: int
    max_retries: int
```

### 3. Enrichment Node

`services/orchestrator/app/nodes/enrichment.py`

```python
from typing import Dict, Any
import asyncio
import logging
from ..state.outreach_state import OutreachState, ProspectProfile
from ..integrations import apollo_client, clay_client, browser_client

logger = logging.getLogger(__name__)

async def enrich_prospect_node(state: OutreachState) -> Dict[str, Any]:
    """Enriches prospect data from multiple sources."""
    
    prospect_id = state['prospect_list'][state['current_prospect_index']]
    logger.info(f"Enriching prospect: {prospect_id}")
    
    try:
        # Parallel enrichment from multiple sources
        apollo_task = asyncio.create_task(
            apollo_client.enrich_person(prospect_id)
        )
        clay_task = asyncio.create_task(
            clay_client.waterfall_enrichment(prospect_id)
        )
        
        # Wait for baseline enrichment
        apollo_data, clay_data = await asyncio.gather(
            apollo_task, clay_task
        )
        
        # Determine if deep research is needed
        prospect_tier = _calculate_prospect_tier(apollo_data, state)
        
        browser_data = {}
        if prospect_tier == 1:
            # High-value prospect - do real-time research
            browser_data = await browser_client.research_prospect(
                linkedin_url=apollo_data.get('linkedin_url'),
                company_website=apollo_data.get('company_domain')
            )
        
        # Merge and score enrichment data
        enriched_profile = ProspectProfile(
            id=prospect_id,
            email=apollo_data.get('email'),
            full_name=apollo_data.get('name'),
            title=apollo_data.get('title'),
            company=apollo_data.get('company_name'),
            linkedin_url=apollo_data.get('linkedin_url'),
            enrichment_data={
                'apollo': apollo_data,
                'clay': clay_data,
                'browser': browser_data
            },
            trigger_events=[],
            intent_signals={},
            tier=prospect_tier
        )
        
        return {
            'prospect': enriched_profile,
            'enrichment_complete': True
        }
        
    except Exception as e:
        logger.error(f"Enrichment failed for {prospect_id}: {str(e)}")
        return {
            'errors': state.get('errors', []) + [{
                'step': 'enrichment',
                'prospect_id': prospect_id,
                'error': str(e)
            }],
            'retry_count': state.get('retry_count', 0) + 1
        }

async def detect_triggers_node(state: OutreachState) -> Dict[str, Any]:
    """Detects trigger events and intent signals."""
    
    prospect = state['prospect']
    company = prospect.company
    
    triggers = []
    
    # Check for M&A activity
    ma_check = await _check_ma_activity(company)
    if ma_check:
        triggers.append({
            'type': 'merger_acquisition',
            'date': ma_check['date'],
            'details': ma_check['details'],
            'urgency': 'high'
        })
    
    # Check for leadership changes
    leadership_check = await _check_leadership_changes(company)
    if leadership_check:
        triggers.append({
            'type': 'leadership_change',
            'role': leadership_check['role'],
            'date': leadership_check['date'],
            'urgency': 'medium'
        })
    
    # Check for funding events
    funding_check = await _check_funding(company)
    if funding_check:
        triggers.append({
            'type': 'funding',
            'amount': funding_check['amount'],
            'date': funding_check['date'],
            'urgency': 'high'
        })
    
    # Calculate intent signals
    intent_signals = await _calculate_intent_signals(prospect, triggers)
    
    # Update prospect profile
    prospect.trigger_events = triggers
    prospect.intent_signals = intent_signals
    
    return {
        'prospect': prospect,
        'triggers_detected': len(triggers) > 0,
        'highest_urgency': max(
            (t['urgency'] for t in triggers), 
            default='low'
        )
    }

def _calculate_prospect_tier(apollo_data: Dict, state: OutreachState) -> int:
    """Determines prospect priority tier (1-3)."""
    
    score = 0
    
    # Seniority scoring
    title = apollo_data.get('title', '').lower()
    if any(exec in title for exec in ['ceo', 'cto', 'cfo', 'chro', 'cpo']):
        score += 3
    elif any(vp in title for vp in ['vp', 'vice president', 'head of']):
        score += 2
    elif 'director' in title:
        score += 1
    
    # Company size scoring
    employees = apollo_data.get('organization_num_employees', 0)
    if employees > 1000:
        score += 2
    elif employees > 100:
        score += 1
    
    # Target match scoring
    if apollo_data.get('organization_industry') in state['target_industries']:
        score += 2
    
    # Convert score to tier
    if score >= 6:
        return 1  # Highest priority
    elif score >= 3:
        return 2  # Medium priority
    else:
        return 3  # Low priority

async def _check_ma_activity(company: str) -> Optional[Dict]:
    """Checks for recent M&A activity."""
    # Implementation would query news APIs, company databases
    pass

async def _check_leadership_changes(company: str) -> Optional[Dict]:
    """Checks for recent leadership changes."""
    # Implementation would query LinkedIn, news sources
    pass

async def _check_funding(company: str) -> Optional[Dict]:
    """Checks for recent funding rounds."""
    # Implementation would query Crunchbase, news sources
    pass

async def _calculate_intent_signals(prospect: ProspectProfile, triggers: List) -> Dict[str, float]:
    """Calculates intent signals from various data points."""
    
    signals = {
        'trigger_urgency': 0.0,
        'content_engagement': 0.0,
        'website_activity': 0.0,
        'competitive_research': 0.0,
        'overall_intent': 0.0
    }
    
    # Trigger-based intent
    if triggers:
        urgency_scores = {'high': 1.0, 'medium': 0.6, 'low': 0.3}
        signals['trigger_urgency'] = max(
            urgency_scores.get(t['urgency'], 0) for t in triggers
        )
    
    # Would integrate with intent data providers like ZoomInfo, 6sense
    # For now, return calculated signals
    
    # Calculate overall intent
    signals['overall_intent'] = sum(signals.values()) / len(signals)
    
    return signals
```

### 4. API Gateway

`services/api/app/main.py`

```python
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import logging

from .routers import campaigns, prospects, messages, analytics
from .dependencies.auth import get_current_user
from .schemas.requests import CampaignCreateRequest, CampaignResponse
from ..orchestrator_client import OrchestratorClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="NoBox Outreach API",
    description="AI-powered cold email orchestration system",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["campaigns"])
app.include_router(prospects.router, prefix="/api/prospects", tags=["prospects"])
app.include_router(messages.router, prefix="/api/messages", tags=["messages"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])

# Initialize orchestrator client
orchestrator = OrchestratorClient()

@app.on_event("startup")
async def startup_event():
    """Initialize connections on startup."""
    logger.info("Starting NoBox Outreach API")
    await orchestrator.connect()

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up connections on shutdown."""
    logger.info("Shutting down NoBox Outreach API")
    await orchestrator.disconnect()

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "NoBox Outreach API",
        "version": "1.0.0",
        "status": "operational"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    checks = {
        "api": "healthy",
        "database": await check_database_health(),
        "orchestrator": await orchestrator.health_check(),
        "redis": await check_redis_health()
    }
    
    overall_status = "healthy" if all(
        v == "healthy" for v in checks.values()
    ) else "degraded"
    
    return {
        "status": overall_status,
        "checks": checks
    }

@app.post("/api/campaigns/quick-start", response_model=CampaignResponse)
async def quick_start_campaign(
    request: CampaignCreateRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user)
):
    """Quick start a new outreach campaign with minimal configuration."""
    
    try:
        # Create campaign in database
        campaign = await create_campaign_record(request, current_user)
        
        # Initialize orchestrator workflow
        background_tasks.add_task(
            orchestrator.start_campaign,
            campaign_id=campaign.id,
            config={
                "offer_details": request.offer_details,
                "target_audience": request.target_audience,
                "objectives": request.objectives,
                "user_id": current_user.id
            }
        )
        
        return CampaignResponse(
            id=campaign.id,
            name=campaign.name,
            status="initializing",
            created_at=campaign.created_at
        )
        
    except Exception as e:
        logger.error(f"Failed to create campaign: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create campaign")
```

### 5. Worker Tasks

`services/worker/app/tasks.py`

```python
import dramatiq
from dramatiq.brokers.redis import RedisBroker
from typing import Dict, Any
import logging

from .enrichment import apollo, clay, browser
from .generation import psychology, hooks, composer
from .sending import email, linkedin, scheduler

# Configure Dramatiq
redis_broker = RedisBroker(url="redis://redis:6379")
dramatiq.set_broker(redis_broker)

logger = logging.getLogger(__name__)

# Enrichment Tasks

@dramatiq.actor(queue_name="enrichment", max_retries=3, time_limit=60000)
def enrich_prospect_task(prospect_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
    """Background task for prospect enrichment."""
    
    logger.info(f"Starting enrichment for prospect: {prospect_id}")
    
    try:
        # Apollo baseline enrichment
        apollo_data = apollo.enrich_person(prospect_id)
        
        # Clay waterfall enrichment
        clay_data = clay.waterfall_enrich(
            email=apollo_data.get('email'),
            linkedin=apollo_data.get('linkedin_url')
        )
        
        # Browser research for tier 1 prospects
        browser_data = {}
        if config.get('tier') == 1:
            browser_data = browser.deep_research(
                linkedin_url=apollo_data.get('linkedin_url'),
                company_url=apollo_data.get('company_domain')
            )
        
        # Store enriched data
        enrichment_result = {
            'prospect_id': prospect_id,
            'apollo': apollo_data,
            'clay': clay_data,
            'browser': browser_data,
            'enriched_at': datetime.utcnow().isoformat()
        }
        
        store_enrichment(enrichment_result)
        
        logger.info(f"Enrichment completed for prospect: {prospect_id}")
        return enrichment_result
        
    except Exception as e:
        logger.error(f"Enrichment failed for {prospect_id}: {str(e)}")
        raise

# Message Generation Tasks

@dramatiq.actor(queue_name="generation", max_retries=2, time_limit=30000)
def generate_message_task(
    prospect_id: str,
    strategy: str,
    variant: str,
    template_type: str
) -> Dict[str, Any]:
    """Generates personalized message with psychological framework."""
    
    logger.info(f"Generating {variant} message for {prospect_id} using {strategy}")
    
    try:
        # Load prospect data
        prospect_data = load_enrichment(prospect_id)
        
        # Select psychological framework
        framework = psychology.select_framework(strategy, prospect_data)
        
        # Generate personalization hooks
        personalization_hooks = hooks.generate_hooks(
            prospect_data=prospect_data,
            framework=framework,
            num_hooks=5
        )
        
        # Compose message
        message = composer.compose_message(
            template_type=template_type,
            framework=framework,
            hooks=personalization_hooks,
            prospect_data=prospect_data,
            variant=variant
        )
        
        # Check compliance and spam score
        compliance_result = check_compliance(message)
        
        if compliance_result['spam_score'] > 3:
            message = composer.optimize_for_deliverability(message)
        
        # Store generated message
        message_record = {
            'prospect_id': prospect_id,
            'strategy': strategy,
            'variant': variant,
            'subject_line': message['subject'],
            'body': message['body'],
            'spam_score': compliance_result['spam_score'],
            'generated_at': datetime.utcnow().isoformat()
        }
        
        store_message(message_record)
        
        logger.info(f"Message generated for {prospect_id}")
        return message_record
        
    except Exception as e:
        logger.error(f"Message generation failed for {prospect_id}: {str(e)}")
        raise

# Sending Tasks

@dramatiq.actor(queue_name="sending", max_retries=1, time_limit=10000)
def send_email_task(
    message_id: str,
    prospect_email: str,
    scheduled_time: Optional[datetime] = None
) -> Dict[str, Any]:
    """Sends email through configured provider."""
    
    logger.info(f"Sending email {message_id} to {prospect_email}")
    
    try:
        # Load message
        message = load_message(message_id)
        
        # Check suppression list
        if is_suppressed(prospect_email):
            logger.warning(f"Email {prospect_email} is suppressed")
            return {'status': 'suppressed', 'message_id': message_id}
        
        # Schedule or send immediately
        if scheduled_time and scheduled_time > datetime.utcnow():
            scheduler.schedule_send(
                message_id=message_id,
                channel='email',
                send_time=scheduled_time
            )
            return {'status': 'scheduled', 'message_id': message_id}
        
        # Send email
        result = email.send(
            to=prospect_email,
            subject=message['subject_line'],
            body=message['body'],
            tracking_enabled=True
        )
        
        # Record send event
        record_event({
            'message_id': message_id,
            'event_type': 'sent',
            'channel': 'email',
            'metadata': result
        })
        
        logger.info(f"Email sent successfully: {message_id}")
        return {'status': 'sent', 'message_id': message_id, 'result': result}
        
    except Exception as e:
        logger.error(f"Failed to send email {message_id}: {str(e)}")
        raise

@dramatiq.actor(queue_name="sending", max_retries=2, time_limit=20000)
def send_linkedin_message_task(
    message_id: str,
    prospect_linkedin: str,
    message_type: str = 'message'  # 'connect' or 'message'
) -> Dict[str, Any]:
    """Sends LinkedIn outreach."""
    
    logger.info(f"Sending LinkedIn {message_type} to {prospect_linkedin}")
    
    try:
        # Load message
        message = load_message(message_id)
        
        # Send based on type
        if message_type == 'connect':
            result = linkedin.send_connection_request(
                profile_url=prospect_linkedin,
                note=message.get('connection_note', '')
            )
        else:
            result = linkedin.send_message(
                profile_url=prospect_linkedin,
                message=message['body']
            )
        
        # Record event
        record_event({
            'message_id': message_id,
            'event_type': f'linkedin_{message_type}_sent',
            'channel': 'linkedin',
            'metadata': result
        })
        
        return {'status': 'sent', 'message_id': message_id, 'result': result}
        
    except Exception as e:
        logger.error(f"Failed to send LinkedIn message {message_id}: {str(e)}")
        raise

# Orchestration Tasks

@dramatiq.actor(queue_name="orchestration", time_limit=60000)
def orchestrate_sequence_task(
    prospect_id: str,
    sequence_config: Dict[str, Any]
) -> None:
    """Orchestrates multi-touch sequence for a prospect."""
    
    logger.info(f"Starting sequence orchestration for {prospect_id}")
    
    sequence = sequence_config.get('steps', DEFAULT_SEQUENCE)
    
    for step in sequence:
        # Check if prospect has responded
        if has_responded(prospect_id):
            logger.info(f"Prospect {prospect_id} responded, pausing sequence")
            pause_sequence(prospect_id)
            trigger_response_workflow(prospect_id)
            break
        
        # Calculate send time
        send_time = calculate_optimal_send_time(
            prospect_id=prospect_id,
            day_offset=step['day'],
            channel=step['channel']
        )
        
        # Schedule touchpoint
        if step['channel'] == 'email':
            send_email_task.send_with_options(
                args=(step['message_id'], step['recipient']),
                eta=send_time
            )
        elif step['channel'] == 'linkedin':
            send_linkedin_message_task.send_with_options(
                args=(step['message_id'], step['linkedin_url']),
                eta=send_time
            )
        
        logger.info(f"Scheduled {step['channel']} for {prospect_id} at {send_time}")

# Helper functions
def store_enrichment(data: Dict[str, Any]):
    """Stores enrichment data in database."""
    # Implementation
    pass

def load_enrichment(prospect_id: str) -> Dict[str, Any]:
    """Loads enrichment data from database."""
    # Implementation
    pass

def store_message(message: Dict[str, Any]):
    """Stores generated message in database."""
    # Implementation
    pass

def load_message(message_id: str) -> Dict[str, Any]:
    """Loads message from database."""
    # Implementation
    pass

def record_event(event: Dict[str, Any]):
    """Records engagement event."""
    # Implementation
    pass

def has_responded(prospect_id: str) -> bool:
    """Checks if prospect has responded."""
    # Implementation
    pass

def calculate_optimal_send_time(
    prospect_id: str,
    day_offset: int,
    channel: str
) -> datetime:
    """Calculates optimal send time for message."""
    # Implementation
    pass
```

### 6. Docker Configuration

`docker-compose.yml`

```yaml
version: '3.8'

networks:
  nobox-network:
    driver: bridge

volumes:
  postgres_data:
  neo4j_data:
  redis_data:

services:
  # Database Services
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_DB: nobox
      POSTGRES_USER: ${DB_USER:-nobox}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-secure_password}
      POSTGRES_INIT_SCRIPTS: /docker-entrypoint-initdb.d
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    networks:
      - nobox-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-nobox}"]
      interval: 10s
      timeout: 5s
      retries: 5

  neo4j:
    image: neo4j:5.17-community
    environment:
      NEO4J_AUTH: ${NEO4J_USER:-neo4j}/${NEO4J_PASSWORD:-secure_password}
      NEO4J_PLUGINS: '["apoc", "graph-data-science", "genai"]'
      NEO4J_dbms_memory_pagecache_size: 1G
      NEO4J_dbms_memory_heap_max__size: 2G
    volumes:
      - neo4j_data:/data
    ports:
      - "7474:7474"
      - "7687:7687"
    networks:
      - nobox-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-secure_password}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - nobox-network

  # Application Services
  orchestrator:
    build:
      context: ./services/orchestrator
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://${DB_USER:-nobox}:${DB_PASSWORD:-secure_password}@postgres:5432/nobox
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USER: ${NEO4J_USER:-neo4j}
      NEO4J_PASSWORD: ${NEO4J_PASSWORD:-secure_password}
      REDIS_URL: redis://:${REDIS_PASSWORD:-secure_password}@redis:6379/0
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
    depends_on:
      postgres:
        condition: service_healthy
      neo4j:
        condition: service_started
      redis:
        condition: service_started
    networks:
      - nobox-network
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 4G

  api:
    build:
      context: ./services/api
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://${DB_USER:-nobox}:${DB_PASSWORD:-secure_password}@postgres:5432/nobox
      REDIS_URL: redis://:${REDIS_PASSWORD:-secure_password}@redis:6379/1
      JWT_SECRET: ${JWT_SECRET:-change_me_in_production}
      ORCHESTRATOR_URL: http://orchestrator:8080
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
    depends_on:
      - orchestrator
    networks:
      - nobox-network
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 2G

  worker_enrichment:
    build:
      context: ./services/worker
      dockerfile: Dockerfile
    command: dramatiq app.tasks --queues enrichment --processes 2 --threads 4
    environment:
      WORKER_QUEUE: enrichment
      DATABASE_URL: postgresql://${DB_USER:-nobox}:${DB_PASSWORD:-secure_password}@postgres:5432/nobox
      REDIS_URL: redis://:${REDIS_PASSWORD:-secure_password}@redis:6379/2
      APOLLO_API_KEY: ${APOLLO_API_KEY}
      CLAY_API_KEY: ${CLAY_API_KEY}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
    depends_on:
      - redis
      - postgres
    networks:
      - nobox-network
    deploy:
      replicas: 4
      resources:
        limits:
          cpus: '1'
          memory: 2G

  worker_generation:
    build:
      context: ./services/worker
      dockerfile: Dockerfile
    command: dramatiq app.tasks --queues generation --processes 2 --threads 2
    environment:
      WORKER_QUEUE: generation
      DATABASE_URL: postgresql://${DB_USER:-nobox}:${DB_PASSWORD:-secure_password}@postgres:5432/nobox
      REDIS_URL: redis://:${REDIS_PASSWORD:-secure_password}@redis:6379/3
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
    depends_on:
      - redis
      - postgres
    networks:
      - nobox-network
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 4G

  worker_sending:
    build:
      context: ./services/worker
      dockerfile: Dockerfile
    command: dramatiq app.tasks --queues sending --processes 1 --threads 8
    environment:
      WORKER_QUEUE: sending
      DATABASE_URL: postgresql://${DB_USER:-nobox}:${DB_PASSWORD:-secure_password}@postgres:5432/nobox
      REDIS_URL: redis://:${REDIS_PASSWORD:-secure_password}@redis:6379/4
      SENDGRID_API_KEY: ${SENDGRID_API_KEY}
      LINKEDIN_COOKIES: ${LINKEDIN_COOKIES}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
    depends_on:
      - redis
      - postgres
    networks:
      - nobox-network
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 2G

  # MCP Gateway
  mcp-gateway:
    build:
      context: ./services/mcp-gateway
      dockerfile: Dockerfile
    environment:
      MCP_SERVERS: apollo,clay,browser,database
      APOLLO_API_KEY: ${APOLLO_API_KEY}
      CLAY_API_KEY: ${CLAY_API_KEY}
    ports:
      - "3000:3000"
    networks:
      - nobox-network

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./infrastructure/monitoring/prometheus:/etc/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
    ports:
      - "9090:9090"
    networks:
      - nobox-network

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}
    volumes:
      - ./infrastructure/monitoring/grafana:/etc/grafana/provisioning
    ports:
      - "3001:3000"
    networks:
      - nobox-network
```

### 7. Environment Configuration

`.env.example`

```bash
# Database
DB_USER=nobox
DB_PASSWORD=secure_password_change_me
NEO4J_USER=neo4j
NEO4J_PASSWORD=secure_password_change_me
REDIS_PASSWORD=secure_password_change_me

# API Keys
OPENAI_API_KEY=sk-...
APOLLO_API_KEY=apollo_api_key_here
CLAY_API_KEY=clay_api_key_here
SENDGRID_API_KEY=sg_api_key_here

# Authentication
JWT_SECRET=change_me_in_production_use_long_random_string

# LinkedIn (for automation)
LINKEDIN_COOKIES=linkedin_cookies_here

# Monitoring
GRAFANA_PASSWORD=admin

# Application
LOG_LEVEL=INFO
ENVIRONMENT=development
```

### 8. Makefile for Development

`Makefile`

```makefile
.PHONY: help setup build up down logs test clean

help:
	@echo "NoBox Outreach Development Commands"
	@echo "  make setup    - Initial project setup"
	@echo "  make build    - Build all Docker images"
	@echo "  make up       - Start all services"
	@echo "  make down     - Stop all services"
	@echo "  make logs     - View logs"
	@echo "  make test     - Run tests"
	@echo "  make clean    - Clean up volumes and images"

setup:
	@echo "Setting up NoBox Outreach..."
	cp .env.example .env
	@echo "Please edit .env with your configuration"
	docker-compose build
	docker-compose run --rm api python -m app.database.init

build:
	docker-compose build

up:
	docker-compose up -d
	@echo "Services starting..."
	@echo "API: http://localhost:8000"
	@echo "Neo4j: http://localhost:7474"
	@echo "Grafana: http://localhost:3001"

down:
	docker-compose down

logs:
	docker-compose logs -f

test:
	./scripts/test.sh

clean:
	docker-compose down -v
	docker system prune -af

# Development helpers
shell-api:
	docker-compose exec api bash

shell-orchestrator:
	docker-compose exec orchestrator bash

db-migrate:
	docker-compose exec api python -m app.database.migrate

db-seed:
	docker-compose exec api python -m app.database.seed

# Monitoring
metrics:
	open http://localhost:9090

dashboard:
	open http://localhost:3001
```