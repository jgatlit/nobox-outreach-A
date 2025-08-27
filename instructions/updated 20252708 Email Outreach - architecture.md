# NoBox Outreach - System Architecture
## Technical Architecture Document v1.0

### System Overview

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React Dashboard]
        API_CLIENT[API Clients]
        WEBHOOK[Webhook Receivers]
    end
    
    subgraph "Orchestration Layer"
        LANGRAPH[LangGraph State Machine]
        CHECKPOINTER[PostgreSQL Checkpointer]
        ROUTER[Strategy Router]
    end
    
    subgraph "Execution Layer"
        FASTAPI[FastAPI Gateway]
        DRAMATIQ[Dramatiq Workers]
        REDIS_QUEUE[Redis Queue]
    end
    
    subgraph "Intelligence Layer"
        ENRICHMENT[Enrichment Engine]
        PERSONALIZATION[Personalization AI]
        PSYCHOLOGY[Psychology Selector]
    end
    
    subgraph "Data Layer"
        PGVECTOR[PostgreSQL + PGVector]
        NEO4J[Neo4j Knowledge Graph]
        REDIS_CACHE[Redis Cache]
    end
    
    subgraph "Integration Layer"
        MCP[MCP Gateway]
        APOLLO[Apollo.io API]
        CLAY[Clay API]
        CRM[CRM Connectors]
    end
    
    UI --> FASTAPI
    API_CLIENT --> FASTAPI
    FASTAPI --> LANGRAPH
    LANGRAPH --> ROUTER
    ROUTER --> PSYCHOLOGY
    LANGRAPH --> CHECKPOINTER
    CHECKPOINTER --> PGVECTOR
    
    LANGRAPH --> DRAMATIQ
    DRAMATIQ --> REDIS_QUEUE
    DRAMATIQ --> ENRICHMENT
    ENRICHMENT --> MCP
    MCP --> APOLLO
    MCP --> CLAY
    
    PERSONALIZATION --> PGVECTOR
    PERSONALIZATION --> NEO4J
    PSYCHOLOGY --> NEO4J
    
    FASTAPI --> REDIS_CACHE
    DRAMATIQ --> CRM
```

## Core Components

### 1. Orchestration Layer (LangGraph)

The brain of the system, managing stateful workflows and decision-making logic.

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, Literal
from langgraph.graph.message import add_messages

class OutreachState(TypedDict):
    # Campaign context
    campaign_id: str
    offer_details: dict
    target_audience: dict
    objectives: dict
    
    # Prospect data
    prospect_id: str
    enrichment_data: dict
    trigger_events: list
    intent_signals: dict
    
    # Strategy selection
    psychological_strategy: str
    personalization_hooks: list
    message_variants: dict
    
    # Execution state
    current_step: int
    messages: Annotated[list, add_messages]
    sequence_position: int
    channel_states: dict
    
    # Performance tracking
    engagement_metrics: dict
    ab_test_results: dict
    optimization_flags: list

class NoBoxOrchestrator:
    def __init__(self):
        self.workflow = StateGraph(OutreachState)
        self._build_workflow()
    
    def _build_workflow(self):
        # Define the 12-step process
        self.workflow.add_node("context_gathering", self.gather_context)
        self.workflow.add_node("audience_analysis", self.analyze_audience)
        self.workflow.add_node("enrichment", self.enrich_prospect_data)
        self.workflow.add_node("trigger_detection", self.detect_triggers)
        self.workflow.add_node("strategy_selection", self.select_strategy)
        self.workflow.add_node("hook_generation", self.generate_hooks)
        self.workflow.add_node("message_creation", self.create_messages)
        self.workflow.add_node("compliance_check", self.check_compliance)
        self.workflow.add_node("ab_variant_generation", self.generate_variants)
        self.workflow.add_node("sequence_orchestration", self.orchestrate_sequence)
        self.workflow.add_node("performance_tracking", self.track_performance)
        self.workflow.add_node("self_correction", self.self_correct)
        
        # Add conditional edges for adaptive flow
        self.workflow.add_conditional_edges(
            "strategy_selection",
            self.route_by_strategy,
            {
                "pattern_disruption": "hook_generation",
                "ego_relevance": "enrichment",
                "loss_aversion": "trigger_detection",
                "social_proof": "message_creation"
            }
        )
        
        # Self-correction loop
        self.workflow.add_conditional_edges(
            "performance_tracking",
            self.should_optimize,
            {
                "optimize": "self_correction",
                "continue": "sequence_orchestration",
                "complete": END
            }
        )
```

### 2. Execution Layer (FastAPI + Dramatiq)

High-performance async API gateway with distributed task processing.

```python
from fastapi import FastAPI, BackgroundTasks, Depends
from pydantic import BaseModel, validator
import dramatiq
from dramatiq.brokers.redis import RedisBroker

# API Gateway
app = FastAPI(title="NoBox Outreach API")

class OutreachRequest(BaseModel):
    campaign_name: str
    target_list: list[str]  # Prospect IDs
    offer_details: dict
    psychological_strategies: list[str] = ["auto"]
    channels: list[Literal["email", "linkedin", "phone"]] = ["email"]
    
    @validator('target_list')
    def validate_list_size(cls, v):
        if len(v) > 10000:
            raise ValueError('Maximum 10,000 prospects per campaign')
        return v

@app.post("/campaigns/create")
async def create_campaign(
    request: OutreachRequest,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user)
):
    campaign_id = generate_campaign_id()
    
    # Queue campaign initialization
    initialize_campaign.send(
        campaign_id=campaign_id,
        request=request.dict(),
        user_id=user.id
    )
    
    return {"campaign_id": campaign_id, "status": "initializing"}

# Dramatiq Workers
redis_broker = RedisBroker(url="redis://redis:6379")
dramatiq.set_broker(redis_broker)

@dramatiq.actor(queue_name="enrichment", max_retries=3)
def enrich_prospect(prospect_id: str, enrichment_config: dict):
    """Deep enrichment worker with multi-source aggregation."""
    
    # Apollo.io baseline
    apollo_data = apollo_client.enrich_person(prospect_id)
    
    # Clay deep enrichment
    clay_data = clay_client.waterfall_enrichment(
        email=apollo_data.get('email'),
        linkedin=apollo_data.get('linkedin_url'),
        company_domain=apollo_data.get('company_domain')
    )
    
    # Real-time browser scraping for high-value targets
    if enrichment_config.get('tier') == 1:
        browser_data = scrape_latest_activity(
            linkedin_url=apollo_data.get('linkedin_url'),
            company_website=apollo_data.get('company_domain')
        )
        
    # Trigger event detection
    triggers = detect_trigger_events(
        company=apollo_data.get('company_name'),
        person=apollo_data.get('full_name')
    )
    
    # Store enriched data
    store_enrichment(prospect_id, {
        'apollo': apollo_data,
        'clay': clay_data,
        'browser': browser_data,
        'triggers': triggers,
        'enriched_at': datetime.utcnow()
    })
    
    return prospect_id

@dramatiq.actor(queue_name="message_generation", time_limit=30000)
def generate_personalized_message(
    prospect_id: str,
    strategy: str,
    template_type: str
):
    """AI-powered message generation with psychological frameworks."""
    
    # Load enriched data
    prospect_data = load_enrichment(prospect_id)
    
    # Generate personalization hooks
    hooks = generate_hooks(prospect_data, strategy)
    
    # Create message variants
    message = compose_message(
        hooks=hooks,
        strategy=strategy,
        template_type=template_type,
        prospect_data=prospect_data
    )
    
    # Compliance checks
    spam_score = check_spam_score(message)
    if spam_score > 3:
        message = optimize_for_deliverability(message)
    
    return message
```

### 3. Data Layer Architecture

Multi-database design optimizing for different data access patterns.

```sql
-- PostgreSQL + PGVector for semantic search and campaign data
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    title VARCHAR(255),
    company VARCHAR(255),
    enrichment_data JSONB,
    personalization_hooks JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID REFERENCES prospects(id),
    campaign_id UUID NOT NULL,
    message_type VARCHAR(50), -- 'email', 'linkedin', 'voicemail'
    subject_line TEXT,
    body_content TEXT,
    psychological_strategy VARCHAR(50),
    variant_label VARCHAR(10), -- 'A', 'B', 'C'
    embedding vector(1536), -- For semantic similarity
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE engagement_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id),
    event_type VARCHAR(50), -- 'sent', 'opened', 'clicked', 'replied'
    occurred_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX idx_messages_embedding ON messages 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_prospects_campaign ON prospects(campaign_id);
CREATE INDEX idx_enrichment_data ON prospects USING GIN(enrichment_data);
```

```cypher
// Neo4j Knowledge Graph for relationship mapping and pattern recognition

// Prospect and company relationships
CREATE (p:Prospect {id: $prospect_id, name: $name, title: $title})
CREATE (c:Company {domain: $domain, name: $company_name, industry: $industry})
CREATE (p)-[:WORKS_AT {since: $start_date}]->(c)

// Psychological strategy effectiveness tracking
CREATE (s:Strategy {name: $strategy_name, framework: $framework})
CREATE (m:Message {id: $message_id, variant: $variant})
CREATE (m)-[:USES_STRATEGY]->(s)
CREATE (m)-[:SENT_TO]->(p)
CREATE (e:Engagement {type: $type, timestamp: $timestamp})
CREATE (m)-[:RESULTED_IN]->(e)

// Pattern discovery queries
MATCH (s:Strategy)<-[:USES_STRATEGY]-(m:Message)-[:RESULTED_IN]->(e:Engagement)
WHERE e.type = 'reply'
WITH s, count(e) as reply_count
MATCH (s)<-[:USES_STRATEGY]-(total:Message)
RETURN s.name, reply_count * 100.0 / count(total) as reply_rate
ORDER BY reply_rate DESC
```

### 4. Intelligence Layer

Advanced AI-powered personalization and psychological strategy selection.

```python
class PsychologyEngine:
    """Selects optimal psychological strategies based on prospect profile."""
    
    STRATEGIES = {
        'pattern_disruption': {
            'triggers': ['high_seniority', 'saturated_industry', 'technical_role'],
            'frameworks': ['unexpected_opening', 'cognitive_surprise', 'anti_pitch'],
            'effectiveness': 0.78
        },
        'ego_relevance': {
            'triggers': ['recent_achievement', 'thought_leader', 'founder'],
            'frameworks': ['specific_praise', 'expertise_recognition', 'peer_positioning'],
            'effectiveness': 0.72
        },
        'loss_aversion': {
            'triggers': ['competitor_activity', 'market_pressure', 'performance_gap'],
            'frameworks': ['missed_opportunity', 'competitive_disadvantage', 'status_quo_cost'],
            'effectiveness': 0.81
        },
        'curiosity_gap': {
            'triggers': ['innovative_company', 'early_adopter', 'growth_phase'],
            'frameworks': ['insider_knowledge', 'pattern_observation', 'unnamed_insight'],
            'effectiveness': 0.69
        },
        'social_proof': {
            'triggers': ['risk_averse', 'enterprise', 'regulated_industry'],
            'frameworks': ['peer_success', 'industry_leader', 'measurable_results'],
            'effectiveness': 0.65
        }
    }
    
    def select_strategy(self, prospect_profile: dict, campaign_context: dict) -> tuple:
        """Returns primary and secondary strategies based on profile analysis."""
        
        # Score each strategy based on trigger matches
        strategy_scores = {}
        
        for strategy_name, config in self.STRATEGIES.items():
            score = 0
            
            # Check trigger matches
            for trigger in config['triggers']:
                if self._check_trigger(trigger, prospect_profile):
                    score += config['effectiveness']
            
            # Adjust for campaign context
            if campaign_context.get('industry') in ['finance', 'healthcare']:
                if strategy_name == 'social_proof':
                    score *= 1.3
            
            # Penalize overused strategies
            if self._is_saturated(strategy_name, prospect_profile):
                score *= 0.7
                
            strategy_scores[strategy_name] = score
        
        # Return top 2 strategies
        sorted_strategies = sorted(
            strategy_scores.items(), 
            key=lambda x: x[1], 
            reverse=True
        )
        
        return sorted_strategies[0][0], sorted_strategies[1][0]
    
    def generate_hook(self, strategy: str, personalization_data: dict) -> str:
        """Generates attention hook based on selected strategy."""
        
        framework = random.choice(self.STRATEGIES[strategy]['frameworks'])
        
        hook_templates = {
            'unexpected_opening': [
                "This email has nothing to do with {pain_point}",
                "Delete this email if {positive_assumption}",
                "I promise this isn't about {obvious_solution}"
            ],
            'cognitive_surprise': [
                "{unexpected_statistic} of {industry} companies don't know {insight}",
                "Your {achievement} made me realize something counterintuitive",
                "Most {title}s think {common_belief}. They're wrong."
            ],
            'specific_praise': [
                "Your {specific_action} on {date} was brilliant because {reason}",
                "Unlike 99% of {title}s, you actually {unique_action}",
                "Studied your approach to {challenge} - {specific_observation}"
            ]
        }
        
        template = random.choice(hook_templates.get(framework, []))
        return template.format(**personalization_data)
```

### 5. Multi-Channel Orchestration

Sophisticated sequencing across email, LinkedIn, and phone touchpoints.

```python
class SequenceOrchestrator:
    """Manages multi-channel outreach sequences with intelligent spacing."""
    
    # Fibonacci-based spacing for natural cadence
    DEFAULT_SEQUENCE = [
        {'day': 0, 'channel': 'linkedin', 'action': 'connect'},
        {'day': 1, 'channel': 'email', 'action': 'initial_outreach'},
        {'day': 3, 'channel': 'email', 'action': 'follow_up_value'},
        {'day': 5, 'channel': 'linkedin', 'action': 'message'},
        {'day': 8, 'channel': 'phone', 'action': 'call_attempt'},
        {'day': 8, 'channel': 'email', 'action': 'voicemail_follow_up'},
        {'day': 13, 'channel': 'email', 'action': 'case_study'},
        {'day': 21, 'channel': 'email', 'action': 'break_up'}
    ]
    
    def orchestrate(self, prospect_id: str, sequence_config: dict):
        """Executes multi-channel sequence with response detection."""
        
        sequence = sequence_config.get('sequence', self.DEFAULT_SEQUENCE)
        
        for step in sequence:
            # Check if prospect has responded
            if self.has_responded(prospect_id):
                self.pause_sequence(prospect_id)
                self.trigger_response_workflow(prospect_id)
                break
            
            # Schedule next touchpoint
            scheduled_time = self.calculate_send_time(
                prospect_id=prospect_id,
                day_offset=step['day'],
                channel=step['channel']
            )
            
            schedule_touchpoint.send_with_options(
                args=(prospect_id, step),
                eta=scheduled_time
            )
    
    def calculate_send_time(self, prospect_id: str, day_offset: int, channel: str):
        """Calculates optimal send time based on timezone and channel."""
        
        prospect_timezone = get_prospect_timezone(prospect_id)
        
        optimal_windows = {
            'email': [(7.5, 9.5), (16, 17.5)],  # 7:30-9:30am, 4-5:30pm
            'linkedin': [(11, 12), (14, 16)],    # 11am-12pm, 2-4pm
            'phone': [(10, 11.5), (14, 16)]      # 10-11:30am, 2-4pm
        }
        
        window = random.choice(optimal_windows[channel])
        hour = random.uniform(window[0], window[1])
        
        # Adjust for timezone
        send_time = datetime.now() + timedelta(days=day_offset)
        send_time = send_time.replace(
            hour=int(hour),
            minute=int((hour % 1) * 60)
        )
        
        return convert_to_utc(send_time, prospect_timezone)
```

## Infrastructure & Deployment

### Docker Compose Configuration

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_DB: nobox_outreach
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - ./init-scripts:/docker-entrypoint-initdb.d
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  neo4j:
    image: neo4j:5.17
    environment:
      NEO4J_AUTH: ${NEO4J_USER}/${NEO4J_PASSWORD}
      NEO4J_PLUGINS: '["apoc", "graph-data-science", "genai"]'
    volumes:
      - neo4j_data:/data
    ports:
      - "7474:7474"
      - "7687:7687"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  orchestrator:
    build: ./services/orchestrator
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/nobox_outreach
      NEO4J_URI: bolt://neo4j:7687
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - postgres
      - neo4j
      - redis
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 4G

  api:
    build: ./services/api
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/nobox_outreach
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
    depends_on:
      - orchestrator
    deploy:
      replicas: 3

  worker_enrichment:
    build: ./services/worker
    command: dramatiq app.tasks --queues enrichment --processes 2 --threads 4
    environment:
      QUEUE: enrichment
      APOLLO_API_KEY: ${APOLLO_API_KEY}
      CLAY_API_KEY: ${CLAY_API_KEY}
    deploy:
      replicas: 4

  worker_generation:
    build: ./services/worker
    command: dramatiq app.tasks --queues message_generation --processes 2 --threads 2
    environment:
      QUEUE: message_generation
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    deploy:
      replicas: 2

  worker_sending:
    build: ./services/worker
    command: dramatiq app.tasks --queues sending --processes 1 --threads 8
    environment:
      QUEUE: sending
      SENDGRID_API_KEY: ${SENDGRID_API_KEY}
    deploy:
      replicas: 2

  mcp_gateway:
    image: docker/mcp-gateway:latest
    environment:
      MCP_SERVERS: github,filesystem,postgres,neo4j,browser
    volumes:
      - ./mcp-config:/config

volumes:
  postgres_data:
  neo4j_data:
  redis_data:
```

### Monitoring & Observability

```python
# Prometheus metrics
from prometheus_client import Counter, Histogram, Gauge

# Core business metrics
messages_generated = Counter(
    'nobox_messages_generated_total',
    'Total messages generated',
    ['campaign_id', 'strategy', 'variant']
)

reply_rate = Gauge(
    'nobox_reply_rate',
    'Current reply rate percentage',
    ['campaign_id', 'strategy']
)

message_generation_duration = Histogram(
    'nobox_message_generation_seconds',
    'Time to generate personalized message',
    ['strategy', 'template_type']
)

enrichment_accuracy = Gauge(
    'nobox_enrichment_accuracy',
    'Accuracy of data enrichment',
    ['source', 'data_type']
)

# Grafana dashboard configuration
dashboards = {
    'campaign_performance': {
        'panels': [
            {
                'title': 'Reply Rate by Strategy',
                'query': 'avg(nobox_reply_rate) by (strategy)',
                'type': 'graph'
            },
            {
                'title': 'Message Generation Speed',
                'query': 'histogram_quantile(0.95, nobox_message_generation_seconds)',
                'type': 'gauge'
            },
            {
                'title': 'Campaign Funnel',
                'query': 'funnel metrics for sent -> opened -> replied -> booked',
                'type': 'funnel'
            }
        ]
    }
}
```

## Security Architecture

### Authentication & Authorization

```python
from fastapi_users import FastAPIUsers
from fastapi_users.authentication import JWTAuthentication

# Multi-tenant isolation
class TenantIsolation:
    def get_tenant_id(self, request):
        token = request.headers.get("Authorization")
        claims = decode_jwt(token)
        return claims.get("tenant_id")
    
    def apply_tenant_filter(self, query, tenant_id):
        return query.filter(Model.tenant_id == tenant_id)

# Role-based access control
ROLES = {
    'admin': ['*'],
    'manager': ['campaigns:*', 'analytics:read', 'users:read'],
    'user': ['campaigns:create', 'campaigns:read:own', 'analytics:read:own']
}

# API rate limiting
from slowapi import Limiter
limiter = Limiter(key_func=lambda: get_current_user().id)

@app.post("/api/messages/generate")
@limiter.limit("100/hour")
async def generate_message(request: MessageRequest):
    # Rate limited endpoint
    pass
```

### Data Privacy & Compliance

```python
class ComplianceManager:
    """Ensures GDPR, CAN-SPAM, and other regulatory compliance."""
    
    def apply_suppression_list(self, prospects: list) -> list:
        """Removes opted-out and suppressed contacts."""
        suppressed = self.get_suppression_list()
        return [p for p in prospects if p.email not in suppressed]
    
    def add_unsubscribe_link(self, message: str, prospect_id: str) -> str:
        """Adds compliant unsubscribe link to messages."""
        unsubscribe_url = self.generate_unsubscribe_url(prospect_id)
        footer = f"\n\nTo unsubscribe: {unsubscribe_url}"
        return message + footer
    
    def audit_log_action(self, action: str, user_id: str, data: dict):
        """Creates audit trail for compliance."""
        AuditLog.create(
            action=action,
            user_id=user_id,
            data=encrypt(json.dumps(data)),
            timestamp=datetime.utcnow()
        )
```

## Performance Optimization

### Caching Strategy

```python
# Multi-layer caching
class CacheManager:
    def __init__(self):
        self.redis = Redis()
        self.local = TTLCache(maxsize=1000, ttl=300)
    
    async def get_or_compute(self, key: str, compute_func, ttl: int = 3600):
        # Check local cache first
        if key in self.local:
            return self.local[key]
        
        # Check Redis
        cached = await self.redis.get(key)
        if cached:
            value = json.loads(cached)
            self.local[key] = value
            return value
        
        # Compute and cache
        value = await compute_func()
        await self.redis.setex(key, ttl, json.dumps(value))
        self.local[key] = value
        return value
```

### Database Query Optimization

```sql
-- Materialized view for campaign analytics
CREATE MATERIALIZED VIEW campaign_performance AS
SELECT 
    c.id as campaign_id,
    c.name as campaign_name,
    COUNT(DISTINCT m.prospect_id) as prospects_messaged,
    COUNT(DISTINCT CASE WHEN e.event_type = 'opened' THEN m.prospect_id END) as opens,
    COUNT(DISTINCT CASE WHEN e.event_type = 'replied' THEN m.prospect_id END) as replies,
    COUNT(DISTINCT CASE WHEN e.event_type = 'replied' THEN m.prospect_id END)::float / 
        NULLIF(COUNT(DISTINCT m.prospect_id), 0) * 100 as reply_rate,
    AVG(EXTRACT(EPOCH FROM (e.occurred_at - m.created_at))/3600) as avg_time_to_reply_hours
FROM campaigns c
LEFT JOIN messages m ON c.id = m.campaign_id
LEFT JOIN engagement_events e ON m.id = e.message_id
GROUP BY c.id, c.name;

-- Refresh every hour
CREATE EXTENSION pg_cron;
SELECT cron.schedule('refresh-campaign-performance', '0 * * * *', 
    'REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_performance;');
```

## Scalability Patterns

### Horizontal Scaling

```python
# Partition prospects across multiple workers
class WorkerPartitioner:
    def partition_prospects(self, prospects: list, num_workers: int):
        """Distributes prospects across workers using consistent hashing."""
        partitions = defaultdict(list)
        
        for prospect in prospects:
            # Consistent hash based on prospect_id
            hash_value = int(hashlib.md5(
                prospect.id.encode()
            ).hexdigest(), 16)
            partition = hash_value % num_workers
            partitions[partition].append(prospect)
        
        return partitions
    
    def scale_workers(self, current_load: float, target_sla: float):
        """Auto-scales workers based on load."""
        if current_load > target_sla * 0.8:
            return int(current_load / target_sla) + 1
        elif current_load < target_sla * 0.3:
            return max(1, int(current_load / target_sla))
        return None  # No scaling needed
```

### Rate Limiting & Throttling

```python
class RateLimiter:
    """Manages API rate limits across multiple providers."""
    
    LIMITS = {
        'apollo': {'requests': 100, 'window': 60},
        'clay': {'requests': 50, 'window': 60},
        'sendgrid': {'requests': 100, 'window': 1}
    }
    
    async def acquire(self, provider: str):
        """Acquires rate limit token or waits."""
        key = f"rate_limit:{provider}:{int(time.time() / self.LIMITS[provider]['window'])}"
        
        current = await redis.incr(key)
        if current == 1:
            await redis.expire(key, self.LIMITS[provider]['window'])
        
        if current > self.LIMITS[provider]['requests']:
            wait_time = self.LIMITS[provider]['window'] - (time.time() % self.LIMITS[provider]['window'])
            await asyncio.sleep(wait_time)
            return await self.acquire(provider)  # Retry
        
        return True
```

## High Availability

### Circuit Breaker Pattern

```python
from aiobreaker import CircuitBreaker

# Configure circuit breakers for external services
apollo_breaker = CircuitBreaker(
    fail_max=5,
    reset_timeout=60,
    exclude=[ApolloRateLimitError]
)

@apollo_breaker
async def call_apollo_api(endpoint: str, params: dict):
    """Protected API call with circuit breaker."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.apollo.io/v1/{endpoint}",
            params=params,
            headers={'api_key': APOLLO_API_KEY}
        )
        response.raise_for_status()
        return response.json()
```

### Health Checks

```python
@app.get("/health")
async def health_check():
    """Comprehensive health check endpoint."""
    checks = {
        'database': await check_database(),
        'redis': await check_redis(),
        'neo4j': await check_neo4j(),
        'apollo_api': await check_apollo_api(),
        'worker_queues': await check_worker_queues()
    }
    
    status = 'healthy' if all(checks.values()) else 'degraded'
    return {
        'status': status,
        'checks': checks,
        'timestamp': datetime.utcnow().isoformat()
    }
```