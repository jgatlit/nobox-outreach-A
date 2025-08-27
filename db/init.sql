-- PostgreSQL initialization script for nobox-outreach
-- Creates database, enables extensions, and sets up initial configuration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search optimization

-- Create enum types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status_enum') THEN
        CREATE TYPE lead_status_enum AS ENUM ('pending', 'enriching', 'enriched', 'contacted', 'responded', 'closed');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_type_enum') THEN
        CREATE TYPE campaign_type_enum AS ENUM ('email', 'linkedin', 'facebook', 'google', 'manual');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status_enum') THEN
        CREATE TYPE job_status_enum AS ENUM ('queued', 'processing', 'completed', 'failed', 'retrying');
    END IF;
END
$$;

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create leads table (will be managed by SQLAlchemy, but this ensures proper setup)
-- This is a reference - actual table creation happens via SQLAlchemy migrations

-- Create indexes for performance (these will be created after tables exist)
-- Note: These will be created by the database.py init_database function, but documented here

/*
-- Performance indexes to be created:
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_email ON leads (email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_company_status ON leads (company, status) WHERE company IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_source_created ON leads (lead_source, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_status_score ON leads (status, lead_score);

-- Lead context indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_context_lead_id ON lead_context (lead_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_context_url ON lead_context (url);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_context_scraped_at ON lead_context (scraped_at);

-- Vector similarity index (HNSW for production performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_context_embedding_hnsw 
ON lead_context USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- Lead enrichments indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_enrichments_lead_id ON lead_enrichments (lead_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_enrichments_status ON lead_enrichments (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_enrichments_enriched_at ON lead_enrichments (enriched_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_enrichments_score ON lead_enrichments (personalization_score);

-- Job logs indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_logs_job_id ON job_logs (job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_logs_type_status ON job_logs (job_type, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_logs_started_at ON job_logs (started_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_logs_lead_id ON job_logs (lead_id) WHERE lead_id IS NOT NULL;

-- Campaign indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_status ON campaigns (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_type ON campaigns (campaign_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_created_at ON campaigns (created_at);

-- Email template indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_templates_active ON email_templates (is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_templates_type ON email_templates (template_type);
*/

-- PostgreSQL configuration optimizations for AI workloads
-- These settings optimize for vector operations and large JSON documents

-- Note: These should be set in postgresql.conf, but documented here for reference:
/*
-- Memory settings for AI workloads
shared_buffers = '25% of RAM'          -- e.g., 2GB for 8GB RAM
work_mem = '64MB'                      -- For vector operations
maintenance_work_mem = '1GB'           -- For index building
effective_cache_size = '75% of RAM'    -- e.g., 6GB for 8GB RAM

-- Vector-specific optimizations
max_parallel_workers_per_gather = 4    -- For parallel vector operations
max_parallel_workers = 8               -- Overall parallel workers
max_parallel_maintenance_workers = 4   -- For index building

-- Connection settings
max_connections = 200                   -- Adjust based on workload
shared_preload_libraries = 'pg_stat_statements,vector'

-- Logging for monitoring
log_statement = 'mod'                   -- Log data modifications
log_min_duration_statement = 1000      -- Log slow queries (>1s)
log_checkpoints = on
log_connections = on
log_disconnections = on
*/

-- Create a monitoring view for lead processing statistics
CREATE OR REPLACE VIEW lead_processing_stats AS
SELECT 
    l.lead_source,
    l.status,
    COUNT(*) as lead_count,
    AVG(le.personalization_score) as avg_personalization_score,
    COUNT(le.id) as enriched_count,
    COUNT(le.id)::float / COUNT(l.id) as enrichment_rate,
    AVG(EXTRACT(EPOCH FROM (le.enriched_at - l.created_at))) as avg_processing_time_seconds
FROM leads l
LEFT JOIN lead_enrichments le ON l.id = le.lead_id
GROUP BY l.lead_source, l.status
ORDER BY l.lead_source, l.status;

-- Create a view for campaign performance
CREATE OR REPLACE VIEW campaign_performance AS
SELECT 
    c.id,
    c.name,
    c.campaign_type,
    c.status,
    c.total_leads,
    c.sent_count,
    c.opened_count,
    c.replied_count,
    CASE 
        WHEN c.sent_count > 0 THEN (c.opened_count::float / c.sent_count * 100)
        ELSE 0 
    END as open_rate_percent,
    CASE 
        WHEN c.sent_count > 0 THEN (c.replied_count::float / c.sent_count * 100)
        ELSE 0 
    END as reply_rate_percent,
    c.created_at,
    c.launched_at
FROM campaigns c
ORDER BY c.created_at DESC;

-- Create a function for vector similarity search
CREATE OR REPLACE FUNCTION find_similar_leads(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.8,
    max_results int DEFAULT 10
)
RETURNS TABLE (
    lead_id int,
    email varchar,
    company varchar,
    similarity_score float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.email,
        l.company,
        (lc.embedding <=> query_embedding) as similarity
    FROM leads l
    JOIN lead_context lc ON l.id = lc.lead_id
    WHERE lc.embedding IS NOT NULL
    AND (lc.embedding <=> query_embedding) < (1 - similarity_threshold)
    ORDER BY similarity
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get lead enrichment summary
CREATE OR REPLACE FUNCTION get_lead_enrichment_summary(lead_email varchar)
RETURNS TABLE (
    lead_info json,
    enrichment_data json,
    context_data json
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        row_to_json(l.*) as lead_info,
        row_to_json(le.*) as enrichment_data,
        json_agg(row_to_json(lc.*)) as context_data
    FROM leads l
    LEFT JOIN lead_enrichments le ON l.id = le.lead_id
    LEFT JOIN lead_context lc ON l.id = lc.lead_id
    WHERE l.email = lead_email
    GROUP BY l.id, le.id;
END;
$$ LANGUAGE plpgsql;

-- Create notification function for real-time updates (if using LISTEN/NOTIFY)
CREATE OR REPLACE FUNCTION notify_lead_update()
RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('lead_updates', json_build_object(
        'action', TG_OP,
        'lead_id', COALESCE(NEW.id, OLD.id),
        'email', COALESCE(NEW.email, OLD.email),
        'status', COALESCE(NEW.status, OLD.status),
        'timestamp', EXTRACT(EPOCH FROM NOW())
    )::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Performance monitoring queries (for debugging and optimization)
-- These can be run manually to check performance:

/*
-- Check index usage
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename IN ('leads', 'lead_context', 'lead_enrichments')
ORDER BY tablename, attname;

-- Check vector index performance
SELECT 
    indexrelname as index_name,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
WHERE indexrelname LIKE '%embedding%';

-- Monitor query performance
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE query ILIKE '%lead%' 
ORDER BY total_time DESC 
LIMIT 10;
*/

-- Grant permissions for application user (adjust username as needed)
-- GRANT USAGE ON SCHEMA public TO automation_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO automation_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO automation_user;

-- Set up row-level security policies (if needed for multi-tenancy)
-- This is optional and depends on your security requirements

/*
-- Example RLS for multi-tenant setup (if needed):
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_enrichments ENABLE ROW LEVEL SECURITY;

-- Example policy (adjust based on your authentication system)
CREATE POLICY tenant_leads_policy ON leads
    FOR ALL TO automation_user
    USING (true);  -- Adjust based on your tenant identification logic
*/

-- Final setup message
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL initialization completed successfully';
    RAISE NOTICE 'Database is ready for nobox-outreach automation service';
    RAISE NOTICE 'Vector extension enabled for AI embeddings';
    RAISE NOTICE 'Performance indexes will be created by the application';
END
$$;