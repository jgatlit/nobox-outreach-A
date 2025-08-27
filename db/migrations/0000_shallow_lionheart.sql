CREATE TYPE "public"."email_status" AS ENUM('not_started', 'draft_generated', 'sent', 'opened', 'clicked', 'replied');--> statement-breakpoint
CREATE TYPE "public"."enrichment_status" AS ENUM('not_started', 'in_progress', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."lead_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('pipedrive', 'asana', 'email', 'instantly', 'cyberleads', 'linkedin', 'manual', 'airtable', 'import');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('active', 'inactive', 'contacted', 'responded', 'qualified', 'disqualified');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ad_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"segment" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ad_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"ad_campaign_id" integer NOT NULL,
	"headline" text NOT NULL,
	"body" text NOT NULL,
	"midjourney_prompt" text,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"segment_filters" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"campaign_id" integer,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"google_doc_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb,
	"status" text DEFAULT 'active',
	"last_checked" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_enrichment" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"company_info" jsonb,
	"tech_stack" jsonb,
	"recent_events" jsonb,
	"insights" text[],
	"personalization_hooks" text[],
	"sales_coaching_tips" jsonb,
	"prospect_analysis" text,
	"suggested_approach" text,
	"potential_objections" text[],
	"key_value_propositions" text[],
	"project_history" jsonb,
	"email_history" jsonb,
	"relationship_context" text[],
	"previous_proposals" jsonb,
	"use_enhanced_scraping" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text NOT NULL,
	"company" text,
	"title" text,
	"phone_number" text,
	"website" text,
	"linkedin_url" text,
	"source" "lead_source" NOT NULL,
	"status" "lead_status" DEFAULT 'active',
	"priority" "lead_priority" DEFAULT 'medium',
	"notes" text,
	"last_contact_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"enrichment_status" "enrichment_status" DEFAULT 'not_started',
	"email_status" "email_status" DEFAULT 'not_started',
	"tags" text[],
	"priority_score" integer,
	"priority_reason" text,
	"priority_updated_at" timestamp,
	CONSTRAINT "leads_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"n8n_workflow_id" text,
	"status" text DEFAULT 'active',
	"last_run" timestamp,
	"processed_count" integer DEFAULT 0,
	"total_count" integer DEFAULT 0,
	"next_scheduled_run" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ad_variants" ADD CONSTRAINT "ad_variants_ad_campaign_id_ad_campaigns_id_fk" FOREIGN KEY ("ad_campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_enrichment" ADD CONSTRAINT "lead_enrichment_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
