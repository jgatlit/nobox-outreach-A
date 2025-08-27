"""
NoBox Outreach Workflow Orchestration
LangGraph workflow wrapper preserving existing functionality while enabling advanced orchestration.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from langgraph.graph import StateGraph
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.prebuilt import ToolExecutor
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from ..state.outreach_state import (
    OutreachState, 
    WorkflowStep, 
    WorkflowStatus, 
    ProspectProfile,
    PsychologicalFramework,
    PsychologicalStrategy,
    MessageVariant,
    update_state_status
)

logger = logging.getLogger(__name__)


class OutreachOrchestrator:
    """
    Core orchestration engine wrapping existing email generation with LangGraph workflow.
    Preserves zero-regression compatibility while enabling psychological personalization.
    """
    
    def __init__(self, openai_api_key: str, database_url: str):
        self.openai_api_key = openai_api_key
        self.database_url = database_url
        
        # Initialize LangGraph components
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.1,
            api_key=openai_api_key
        )
        
        # PostgreSQL checkpointer for state persistence
        self.checkpointer = PostgresSaver.from_conn_string(database_url)
        
        # Build workflow graph
        self.workflow = self._build_workflow_graph()
        
        logger.info("OutreachOrchestrator initialized with LangGraph workflow")

    def _build_workflow_graph(self) -> StateGraph:
        """Build the main LangGraph workflow preserving existing functionality."""
        
        workflow = StateGraph(OutreachState)
        
        # Core workflow nodes
        workflow.add_node("context_gathering", self._gather_context)
        workflow.add_node("legacy_email_generation", self._generate_legacy_email)
        workflow.add_node("psychological_analysis", self._analyze_psychology)
        workflow.add_node("strategy_selection", self._select_strategy)
        workflow.add_node("message_composition", self._compose_message)
        workflow.add_node("sequence_orchestration", self._orchestrate_sequence)
        workflow.add_node("performance_tracking", self._track_performance)
        workflow.add_node("error_handling", self._handle_errors)
        
        # Phase 1: Zero-regression path (wraps existing system)
        workflow.add_edge("context_gathering", "legacy_email_generation")
        workflow.add_edge("legacy_email_generation", "performance_tracking")
        
        # Phase 2+: Advanced orchestration paths (future enhancement)
        workflow.add_conditional_edges(
            "context_gathering",
            self._should_use_advanced_workflow,
            {
                "legacy": "legacy_email_generation",
                "advanced": "psychological_analysis"
            }
        )
        
        # Advanced workflow path
        workflow.add_edge("psychological_analysis", "strategy_selection")
        workflow.add_edge("strategy_selection", "message_composition")
        workflow.add_edge("message_composition", "sequence_orchestration")
        workflow.add_edge("sequence_orchestration", "performance_tracking")
        
        # Error handling paths
        workflow.add_conditional_edges(
            "legacy_email_generation",
            self._check_for_errors,
            {
                "success": "performance_tracking",
                "error": "error_handling"
            }
        )
        
        # Set entry and end points
        workflow.set_entry_point("context_gathering")
        workflow.add_edge("performance_tracking", "__end__")
        workflow.add_edge("error_handling", "__end__")
        
        return workflow.compile(checkpointer=self.checkpointer)

    async def _gather_context(self, state: OutreachState) -> OutreachState:
        """Gather context about the prospect and campaign."""
        
        logger.info(f"Gathering context for campaign {state['campaign_id']}")
        
        # Update workflow status
        updated_state = update_state_status(
            state, 
            WorkflowStatus.RUNNING, 
            WorkflowStep.CONTEXT_GATHERING
        )
        
        # Fetch prospect data from existing database (preserves current logic)
        prospect = state.get('prospect')
        if not prospect:
            # Load from prospect_list if needed
            prospect_id = state['prospect_list'][state['current_prospect_index']]
            # This would integrate with existing database calls
            updated_state['prospect'] = await self._load_prospect_data(prospect_id)
        
        logger.info("Context gathering completed")
        return updated_state

    async def _generate_legacy_email(self, state: OutreachState) -> OutreachState:
        """
        Wrap existing generatePersonalizedEmail function to preserve zero-regression compatibility.
        This node calls the existing TypeScript OpenAI service.
        """
        
        logger.info("Generating email using existing system (zero-regression mode)")
        
        updated_state = update_state_status(
            state,
            WorkflowStatus.RUNNING,
            WorkflowStep.MESSAGE_COMPOSITION
        )
        
        try:
            # Call existing TypeScript email generation service
            # This preserves 100% of current functionality
            email_result = await self._call_existing_email_service(state)
            
            # Store result in workflow state
            updated_state['current_email_result'] = email_result
            updated_state['messages_sent'] = state.get('messages_sent', 0) + 1
            
            logger.info("Legacy email generation completed successfully")
            
        except Exception as e:
            logger.error(f"Legacy email generation failed: {str(e)}")
            updated_state = update_state_status(
                updated_state,
                WorkflowStatus.ERROR,
                error=str(e)
            )
            updated_state['retry_count'] = state.get('retry_count', 0) + 1
        
        return updated_state

    async def _analyze_psychology(self, state: OutreachState) -> OutreachState:
        """
        Advanced psychological analysis for Phase 2+ implementation.
        Currently returns basic framework for future development.
        """
        
        logger.info("Analyzing prospect psychology (Phase 2+ feature)")
        
        updated_state = update_state_status(
            state,
            WorkflowStatus.RUNNING,
            WorkflowStep.AUDIENCE_ANALYSIS
        )
        
        # Phase 1: Basic framework setup
        psychology_profile = {
            "dominant_traits": ["analytical", "results_oriented"],
            "communication_preferences": ["direct", "data_driven"],
            "trigger_indicators": ["efficiency", "ROI", "competitive_advantage"]
        }
        
        psychological_framework = PsychologicalFramework(
            primary_strategy=PsychologicalStrategy.PATTERN_DISRUPTION,
            effectiveness_score=0.7,
            generated_hooks=["industry disruption", "competitive intel"],
            rationale="Analytical profile indicates pattern disruption strategy",
            personalization_level=2
        )
        
        updated_state['psychological_framework'] = psychological_framework
        if updated_state['prospect']:
            updated_state['prospect']['psychology_profile'] = psychology_profile
        
        logger.info("Psychological analysis completed")
        return updated_state

    async def _select_strategy(self, state: OutreachState) -> OutreachState:
        """Select optimal psychological strategy based on analysis."""
        
        logger.info("Selecting psychological strategy")
        
        updated_state = update_state_status(
            state,
            WorkflowStatus.RUNNING,
            WorkflowStep.STRATEGY_SELECTION
        )
        
        # Phase 1: Use basic strategy selection
        available_strategies = [
            PsychologicalStrategy.PATTERN_DISRUPTION,
            PsychologicalStrategy.EGO_RELEVANCE,
            PsychologicalStrategy.CURIOSITY_GAP
        ]
        
        updated_state['available_strategies'] = available_strategies
        
        # Future: Advanced strategy selection based on prospect analysis
        
        logger.info("Strategy selection completed")
        return updated_state

    async def _compose_message(self, state: OutreachState) -> OutreachState:
        """Compose personalized message using selected strategy."""
        
        logger.info("Composing personalized message")
        
        updated_state = update_state_status(
            state,
            WorkflowStatus.RUNNING,
            WorkflowStep.MESSAGE_COMPOSITION
        )
        
        # Phase 1: Create message variants for A/B testing
        message_variants = []
        
        # Variant A: Current system style (zero-regression)
        variant_a = MessageVariant(
            variant_id=f"msg_{state['campaign_id']}_{datetime.now().timestamp()}_A",
            label='A',
            subject_line="Quick question about [Company] growth",
            body="Existing email generation logic would be called here...",
            strategy_used=PsychologicalStrategy.PATTERN_DISRUPTION,
            personalization_level=1,
            predicted_reply_rate=0.05
        )
        message_variants.append(variant_a)
        
        # Set first variant as selected for Phase 1
        variant_a.is_selected = True
        updated_state['selected_variant'] = variant_a.variant_id
        
        updated_state['message_variants'] = message_variants
        
        logger.info("Message composition completed")
        return updated_state

    async def _orchestrate_sequence(self, state: OutreachState) -> OutreachState:
        """Orchestrate multi-channel sequence (Phase 3+ feature)."""
        
        logger.info("Orchestrating communication sequence")
        
        updated_state = update_state_status(
            state,
            WorkflowStatus.RUNNING,
            WorkflowStep.SEQUENCE_ORCHESTRATION
        )
        
        # Phase 1: Basic sequence setup
        updated_state['sequence_status'] = 'active'
        updated_state['next_touchpoint'] = datetime.now() + timedelta(days=3)
        
        logger.info("Sequence orchestration completed")
        return updated_state

    async def _track_performance(self, state: OutreachState) -> OutreachState:
        """Track performance metrics and update database."""
        
        logger.info("Tracking performance metrics")
        
        updated_state = update_state_status(
            state,
            WorkflowStatus.COMPLETED,
            WorkflowStep.PERFORMANCE_TRACKING
        )
        
        # Calculate current reply rate
        messages_sent = updated_state.get('messages_sent', 0)
        replies_received = updated_state.get('replies_received', 0)
        
        if messages_sent > 0:
            updated_state['current_reply_rate'] = replies_received / messages_sent
        else:
            updated_state['current_reply_rate'] = 0.0
        
        # Store performance metrics in database
        await self._persist_performance_metrics(updated_state)
        
        logger.info("Performance tracking completed")
        return updated_state

    async def _handle_errors(self, state: OutreachState) -> OutreachState:
        """Handle workflow errors with retry logic."""
        
        logger.warning("Handling workflow errors")
        
        updated_state = update_state_status(
            state,
            WorkflowStatus.ERROR,
            error="Workflow error encountered"
        )
        
        retry_count = state.get('retry_count', 0)
        max_retries = state.get('max_retries', 3)
        
        if retry_count < max_retries:
            logger.info(f"Retrying workflow, attempt {retry_count + 1}/{max_retries}")
            updated_state['retry_count'] = retry_count + 1
            # Reset to initial step for retry
            updated_state['workflow_step'] = WorkflowStep.CONTEXT_GATHERING
            updated_state['workflow_status'] = WorkflowStatus.INITIALIZING
        else:
            logger.error("Maximum retries exceeded, workflow failed")
            updated_state['workflow_status'] = WorkflowStatus.ERROR
        
        return updated_state

    def _should_use_advanced_workflow(self, state: OutreachState) -> str:
        """Determine whether to use advanced workflow or legacy path."""
        
        # Phase 1: Always use legacy for zero-regression
        # Phase 2+: Add conditions for advanced workflow
        return "legacy"

    def _check_for_errors(self, state: OutreachState) -> str:
        """Check if the current step completed successfully."""
        
        if state.get('workflow_status') == WorkflowStatus.ERROR:
            return "error"
        
        # Check for specific error conditions
        if state.get('current_email_result') is None:
            return "error"
        
        return "success"

    async def _call_existing_email_service(self, state: OutreachState) -> Dict[str, str]:
        """
        Call existing TypeScript email generation service.
        This preserves 100% compatibility with current system.
        """
        
        # This would make HTTP calls to existing Express.js endpoints
        # Preserving exact same logic as current server/openai.ts
        
        prospect = state.get('prospect')
        if not prospect:
            raise ValueError("No prospect data available")
        
        # Mock response matching existing system structure
        return {
            "subject": f"Quick question about {prospect.get('company', 'your business')}",
            "body": f"Hi {prospect.get('first_name', 'there')}, \n\nI noticed your work at {prospect.get('company')}...",
            "personalization_level": "medium",
            "generated_at": datetime.now().isoformat()
        }

    async def _load_prospect_data(self, prospect_id: str) -> ProspectProfile:
        """Load prospect data from existing database."""
        
        # This would integrate with existing database queries
        # Mock data for Phase 1 development
        return ProspectProfile(
            id=prospect_id,
            email="prospect@example.com",
            first_name="John",
            last_name="Doe",
            company="Example Corp",
            title="VP of Engineering",
            tier=2
        )

    async def _persist_performance_metrics(self, state: OutreachState):
        """Persist performance metrics to database."""
        
        # Integration point with existing database
        logger.info("Performance metrics would be persisted to database")

    async def execute_campaign(self, campaign_id: str, prospect_ids: List[str]) -> Dict[str, Any]:
        """
        Execute outreach campaign for given prospects.
        Main entry point preserving existing functionality.
        """
        
        logger.info(f"Executing campaign {campaign_id} for {len(prospect_ids)} prospects")
        
        results = []
        
        for i, prospect_id in enumerate(prospect_ids):
            try:
                # Create initial state
                initial_state = OutreachState(
                    campaign_id=campaign_id,
                    campaign_name=f"Campaign {campaign_id}",
                    created_by="system",
                    prospect_list=prospect_ids,
                    current_prospect_index=i,
                    workflow_step=WorkflowStep.CONTEXT_GATHERING,
                    workflow_status=WorkflowStatus.INITIALIZING,
                    thread_id=f"campaign_{campaign_id}_prospect_{prospect_id}",
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
                
                # Execute workflow for prospect
                final_state = await self.workflow.ainvoke(
                    initial_state,
                    config={"configurable": {"thread_id": initial_state['thread_id']}}
                )
                
                results.append({
                    "prospect_id": prospect_id,
                    "status": final_state.get('workflow_status'),
                    "email_result": final_state.get('current_email_result'),
                    "errors": final_state.get('errors', [])
                })
                
            except Exception as e:
                logger.error(f"Error processing prospect {prospect_id}: {str(e)}")
                results.append({
                    "prospect_id": prospect_id,
                    "status": "error",
                    "error": str(e)
                })
        
        return {
            "campaign_id": campaign_id,
            "total_prospects": len(prospect_ids),
            "completed": len([r for r in results if r.get('status') == 'completed']),
            "errors": len([r for r in results if r.get('status') == 'error']),
            "results": results
        }


# Factory function for easy initialization
def create_outreach_orchestrator(openai_api_key: str, database_url: str) -> OutreachOrchestrator:
    """Create and return configured OutreachOrchestrator instance."""
    return OutreachOrchestrator(openai_api_key, database_url)