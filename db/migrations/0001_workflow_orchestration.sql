-- NoBox Outreach Workflow Orchestration Migration
-- Created: 2025-08-27
-- Purpose: Add workflow orchestration tables for LangGraph integration

-- Workflow step enum
CREATE TYPE "public"."workflow_step" AS ENUM(
    'context_gathering',
    'audience_analysis', 
    'objective_definition',
    'prospect_enrichment',
    'trigger_detection',
    'strategy_selection',
    'hook_generation',
    'message_composition',
    'compliance_check',
    'variant_generation',
    'sequence_orchestration',
    'performance_tracking'
);--> statement-breakpoint

-- Workflow status enum  
CREATE TYPE "public"."workflow_status" AS ENUM(
    'initializing',
    'running',
    'paused',
    'completed',
    'error'
);--> statement-breakpoint

-- Psychological strategy enum
CREATE TYPE "public"."psychological_strategy" AS ENUM(
    'pattern_disruption',
    'ego_relevance', 
    'loss_aversion',
    'curiosity_gap',
    'social_proof'
);--> statement-breakpoint

-- Communication channel enum
CREATE TYPE "public"."communication_channel" AS ENUM(
    'email',
    'linkedin',
    'phone'
);--> statement-breakpoint

-- Sequence status enum
CREATE TYPE "public"."sequence_status" AS ENUM(
    'pending',
    'active',
    'paused',
    'completed'
);--> statement-breakpoint

-- Main workflow states table - tracks campaign progress
CREATE TABLE IF NOT EXISTS "workflow_states" (
    "id" serial PRIMARY KEY NOT NULL,
    "campaign_id" integer NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
    "lead_id" integer NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
    "thread_id" varchar(255) NOT NULL,
    "checkpoint_id" varchar(255) NOT NULL,
    "current_step" "workflow_step" NOT NULL,
    "workflow_status" "workflow_status" NOT NULL DEFAULT 'initializing',
    "psychological_strategy" "psychological_strategy",
    "sequence_position" integer DEFAULT 0,
    "state_data" jsonb NOT NULL DEFAULT '{}',
    "error_details" text,
    "retry_count" integer DEFAULT 0,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Multi-channel touchpoints table - tracks sequence execution
CREATE TABLE IF NOT EXISTS "touchpoints" (
    "id" serial PRIMARY KEY NOT NULL,
    "workflow_state_id" integer NOT NULL REFERENCES "workflow_states"("id") ON DELETE CASCADE,
    "lead_id" integer NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
    "campaign_id" integer NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
    "sequence_step" integer NOT NULL,
    "channel" "communication_channel" NOT NULL,
    "action" varchar(50) NOT NULL,
    "scheduled_for" timestamp,
    "executed_at" timestamp,
    "response_detected" boolean DEFAULT false,
    "response_detected_at" timestamp,
    "message_id" integer REFERENCES "email_drafts"("id"),
    "metadata" jsonb DEFAULT '{}',
    "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Psychological strategy performance tracking
CREATE TABLE IF NOT EXISTS "strategy_performance" (
    "id" serial PRIMARY KEY NOT NULL,
    "strategy_name" "psychological_strategy" NOT NULL,
    "prospect_tier" integer,
    "industry" varchar(100),
    "title_seniority" varchar(50), 
    "messages_sent" integer DEFAULT 0,
    "replies_received" integer DEFAULT 0,
    "meetings_booked" integer DEFAULT 0,
    "reply_rate" decimal(5,4) GENERATED ALWAYS AS (
        CASE WHEN messages_sent > 0 
        THEN replies_received::decimal / messages_sent::decimal
        ELSE 0 END
    ) STORED,
    "campaign_id" integer REFERENCES "campaigns"("id") ON DELETE CASCADE,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Campaign workflow metrics - aggregated performance data
CREATE TABLE IF NOT EXISTS "campaign_workflow_metrics" (
    "id" serial PRIMARY KEY NOT NULL,
    "campaign_id" integer NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
    "total_prospects" integer DEFAULT 0,
    "prospects_completed" integer DEFAULT 0,
    "prospects_in_progress" integer DEFAULT 0,
    "prospects_error" integer DEFAULT 0,
    "avg_completion_time_minutes" decimal(10,2),
    "overall_reply_rate" decimal(5,4),
    "top_performing_strategy" "psychological_strategy",
    "last_calculated" timestamp DEFAULT now() NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    UNIQUE("campaign_id")
);--> statement-breakpoint

-- Message variants table - A/B testing support
CREATE TABLE IF NOT EXISTS "message_variants" (
    "id" serial PRIMARY KEY NOT NULL,
    "workflow_state_id" integer NOT NULL REFERENCES "workflow_states"("id") ON DELETE CASCADE,
    "variant_label" varchar(10) NOT NULL, -- 'A', 'B', 'C'
    "subject_line" text NOT NULL,
    "body" text NOT NULL,
    "psychological_strategy" "psychological_strategy" NOT NULL,
    "personalization_level" integer DEFAULT 1,
    "spam_score" decimal(4,2) DEFAULT 0.0,
    "predicted_reply_rate" decimal(5,4) DEFAULT 0.05,
    "actual_reply_rate" decimal(5,4),
    "is_selected" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Performance indexes for optimization
CREATE INDEX IF NOT EXISTS "idx_workflow_states_campaign" ON "workflow_states"("campaign_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_states_thread" ON "workflow_states"("thread_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_states_status" ON "workflow_states"("workflow_status");
CREATE INDEX IF NOT EXISTS "idx_workflow_states_step" ON "workflow_states"("current_step");

CREATE INDEX IF NOT EXISTS "idx_touchpoints_lead" ON "touchpoints"("lead_id");
CREATE INDEX IF NOT EXISTS "idx_touchpoints_campaign" ON "touchpoints"("campaign_id");
CREATE INDEX IF NOT EXISTS "idx_touchpoints_scheduled" ON "touchpoints"("scheduled_for");
CREATE INDEX IF NOT EXISTS "idx_touchpoints_channel" ON "touchpoints"("channel");

CREATE INDEX IF NOT EXISTS "idx_strategy_performance_name" ON "strategy_performance"("strategy_name");
CREATE INDEX IF NOT EXISTS "idx_strategy_performance_campaign" ON "strategy_performance"("campaign_id");
CREATE INDEX IF NOT EXISTS "idx_strategy_performance_tier" ON "strategy_performance"("prospect_tier");

CREATE INDEX IF NOT EXISTS "idx_message_variants_workflow" ON "message_variants"("workflow_state_id");
CREATE INDEX IF NOT EXISTS "idx_message_variants_strategy" ON "message_variants"("psychological_strategy");

-- Trigger for updating workflow_states.updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workflow_states_updated_at 
    BEFORE UPDATE ON workflow_states 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategy_performance_updated_at 
    BEFORE UPDATE ON strategy_performance 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_workflow_metrics_updated_at 
    BEFORE UPDATE ON campaign_workflow_metrics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initial data: Add psychological strategies to strategy_performance for tracking
INSERT INTO "strategy_performance" ("strategy_name", "prospect_tier", "industry", "title_seniority") 
VALUES 
    ('pattern_disruption', 1, 'technology', 'c_suite'),
    ('pattern_disruption', 2, 'technology', 'vp_level'),
    ('ego_relevance', 1, 'technology', 'c_suite'),
    ('loss_aversion', 2, 'finance', 'director_level'),
    ('curiosity_gap', 3, 'general', 'manager_level'),
    ('social_proof', 2, 'healthcare', 'vp_level')
ON CONFLICT DO NOTHING;