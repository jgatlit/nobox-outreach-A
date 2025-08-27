"""
NoBox Outreach Workflow State Definition
Integrates with existing TypeScript schema and database structure.
"""

from typing import TypedDict, List, Dict, Any, Optional, Literal
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class WorkflowStep(str, Enum):
    """Workflow step enumeration matching database enum."""
    CONTEXT_GATHERING = "context_gathering"
    AUDIENCE_ANALYSIS = "audience_analysis"
    OBJECTIVE_DEFINITION = "objective_definition"
    PROSPECT_ENRICHMENT = "prospect_enrichment"
    TRIGGER_DETECTION = "trigger_detection"
    STRATEGY_SELECTION = "strategy_selection"
    HOOK_GENERATION = "hook_generation"
    MESSAGE_COMPOSITION = "message_composition"
    COMPLIANCE_CHECK = "compliance_check"
    VARIANT_GENERATION = "variant_generation"
    SEQUENCE_ORCHESTRATION = "sequence_orchestration"
    PERFORMANCE_TRACKING = "performance_tracking"


class WorkflowStatus(str, Enum):
    """Workflow status enumeration matching database enum."""
    INITIALIZING = "initializing"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"


class PsychologicalStrategy(str, Enum):
    """Psychological strategy enumeration matching database enum."""
    PATTERN_DISRUPTION = "pattern_disruption"
    EGO_RELEVANCE = "ego_relevance"
    LOSS_AVERSION = "loss_aversion"
    CURIOSITY_GAP = "curiosity_gap"
    SOCIAL_PROOF = "social_proof"


class CommunicationChannel(str, Enum):
    """Communication channel enumeration matching database enum."""
    EMAIL = "email"
    LINKEDIN = "linkedin"
    PHONE = "phone"


class ProspectProfile(BaseModel):
    """Enhanced prospect profile integrating with existing leads table."""
    
    # Core prospect data (from existing leads table)
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    linkedin_url: Optional[str] = None
    
    # Enrichment data (from existing lead_enrichment table)
    enrichment_data: Dict[str, Any] = Field(default_factory=dict)
    personalization_hooks: List[str] = Field(default_factory=list)
    
    # Workflow-specific fields
    tier: int = 2  # 1=VIP, 2=Standard, 3=Volume
    trigger_events: List[Dict[str, Any]] = Field(default_factory=list)
    intent_signals: Dict[str, float] = Field(default_factory=dict)
    psychology_profile: Dict[str, Any] = Field(default_factory=dict)
    
    @property
    def full_name(self) -> str:
        """Construct full name from first and last name."""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name or self.last_name or self.email.split('@')[0]


class PsychologicalFramework(BaseModel):
    """Strategy and hooks for outreach matching existing system."""
    
    primary_strategy: PsychologicalStrategy
    secondary_strategy: Optional[PsychologicalStrategy] = None
    effectiveness_score: float = 0.0
    generated_hooks: List[str] = Field(default_factory=list)
    rationale: str = ""
    personalization_level: int = 1


class MessageVariant(BaseModel):
    """A/B test message variants matching existing email_drafts structure."""
    
    variant_id: str
    label: Literal['A', 'B', 'C']
    subject_line: str
    body: str
    strategy_used: PsychologicalStrategy
    personalization_level: int = 1
    spam_score: float = 0.0
    predicted_reply_rate: float = 0.05
    actual_reply_rate: Optional[float] = None
    is_selected: bool = False


class TouchpointSchedule(BaseModel):
    """Multi-channel touchpoint scheduling."""
    
    sequence_step: int
    channel: CommunicationChannel
    action: str
    scheduled_for: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    response_detected: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class OutreachState(TypedDict, total=False):
    """
    Complete workflow state for LangGraph orchestration.
    Integrates with existing database schema and preserves current functionality.
    """
    
    # Campaign Context (from existing campaigns table)
    campaign_id: str
    campaign_name: str
    created_by: str
    
    # Current prospect being processed
    prospect: Optional[ProspectProfile]
    prospect_list: List[str]  # List of prospect IDs from existing leads table
    current_prospect_index: int
    
    # Workflow Control
    workflow_step: WorkflowStep
    workflow_status: WorkflowStatus
    thread_id: str  # LangGraph thread identifier
    checkpoint_id: str  # LangGraph checkpoint identifier
    
    # Psychological Intelligence
    psychological_framework: Optional[PsychologicalFramework]
    available_strategies: List[PsychologicalStrategy]
    
    # Message Generation (integrates with existing email_drafts)
    message_variants: List[MessageVariant]
    selected_variant: Optional[str]
    
    # Current System Integration
    current_email_result: Optional[Dict[str, str]]  # Result from existing generatePersonalizedEmail
    style_options: Dict[str, Any]  # Options for existing system
    
    # Sequence State
    sequence_step: int
    sequence_status: Literal['pending', 'active', 'paused', 'completed']
    touchpoint_schedule: List[TouchpointSchedule]
    last_touchpoint: Optional[datetime]
    next_touchpoint: Optional[datetime]
    
    # Performance Tracking
    messages_sent: int
    replies_received: int
    current_reply_rate: float
    
    # Error Handling
    errors: List[Dict[str, Any]]
    retry_count: int
    max_retries: int
    
    # Metadata
    created_at: datetime
    updated_at: datetime


# Helper functions for state management
def create_initial_state(
    campaign_id: str,
    campaign_name: str,
    prospect_ids: List[str],
    created_by: str = "system"
) -> OutreachState:
    """Create initial workflow state for a campaign."""
    
    return OutreachState(
        campaign_id=campaign_id,
        campaign_name=campaign_name,
        created_by=created_by,
        prospect_list=prospect_ids,
        current_prospect_index=0,
        workflow_step=WorkflowStep.CONTEXT_GATHERING,
        workflow_status=WorkflowStatus.INITIALIZING,
        thread_id=f"campaign_{campaign_id}_{datetime.now().isoformat()}",
        checkpoint_id="",
        available_strategies=[],
        message_variants=[],
        style_options={},
        sequence_step=0,
        sequence_status='pending',
        touchpoint_schedule=[],
        messages_sent=0,
        replies_received=0,
        current_reply_rate=0.0,
        errors=[],
        retry_count=0,
        max_retries=3,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )


def update_state_status(
    state: OutreachState,
    status: WorkflowStatus,
    step: Optional[WorkflowStep] = None,
    error: Optional[str] = None
) -> OutreachState:
    """Update workflow state status and step."""
    
    updated_state = state.copy()
    updated_state['workflow_status'] = status
    updated_state['updated_at'] = datetime.now()
    
    if step:
        updated_state['workflow_step'] = step
    
    if error:
        updated_state['errors'] = state.get('errors', []) + [{
            'error': error,
            'step': state.get('workflow_step'),
            'timestamp': datetime.now().isoformat()
        }]
    
    return updated_state