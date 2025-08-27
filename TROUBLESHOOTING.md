# 🛠️ Troubleshooting Guide - Nobox Outreach

## 🔍 Common Issues & Solutions

### Database-Related Issues

#### **Issue**: Lead detail pages showing 500 errors
**Symptoms**: Frontend shows "Failed to load lead details" or 500 server errors
**Root Cause**: Missing database tables or foreign key constraint failures
**Solution**:
```sql
-- Check for missing tables
\dt public.*
-- Look for: lead_enrichment, email_drafts, workflows, integrations, ad_campaigns, ad_variants

-- If tables are missing, restore from schema:
-- Run the schema creation scripts from shared/schema.ts
```

#### **Issue**: Campaign API endpoints failing
**Symptoms**: Dashboard not loading, campaign statistics unavailable
**Root Cause**: Missing columns in campaigns table
**Solution**:
```sql
-- Add missing columns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS segment_filters jsonb;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
```

### CSV Import Issues

#### **Issue**: Frontend shows "Import Failed" but leads are imported
**Symptoms**: Error toast appears but lead count increases
**Root Cause**: Timeout or response parsing issue
**Solution**: 
- Check backend logs: `tail -f server/logs`
- Verify lead count: `curl http://localhost:8052/api/leads | jq 'length'`
- This is a display issue - data is actually imported successfully

#### **Issue**: JSON parsing errors during CSV import
**Symptoms**: "LLM transformation failed" in server logs
**Root Cause**: Malformed JSON responses from OpenAI API
**Solution**: Enhanced error recovery already implemented in `csv-mapper.ts:125-151`

#### **Issue**: CSV import timeout on large files
**Symptoms**: Import appears to hang or timeout
**Solution**: 
- Large files (50+ records) take 2-3 minutes - this is normal
- Frontend timeout extended to 5 minutes
- Wait for completion or check backend logs for progress

### AI/LLM Integration Issues

#### **Issue**: Lead enrichment not working
**Symptoms**: "Enrichment Required" message persists
**Root Cause**: 
1. Missing OpenAI API key
2. API rate limits
3. Missing lead_enrichment table

**Solution**:
```bash
# Check API key
echo $OPENAI_API_KEY

# Check table exists
psql -d nobox_outreach -c "\dt lead_enrichment"

# Test API manually
curl -X POST http://localhost:8052/api/leads/{id}/enrich
```

#### **Issue**: Sales coaching shows empty or errors
**Symptoms**: Coaching panel shows "Generate Sales Coaching Tips" button but no data
**Root Cause**: Lead needs enrichment first
**Solution**: Enrich the lead first, then generate coaching tips

### Frontend Issues

#### **Issue**: Lead table not refreshing after operations
**Symptoms**: New leads or changes not visible
**Solution**: React Query cache issue - refresh page or clear cache

#### **Issue**: Frontend build errors
**Symptoms**: TypeScript or build failures
**Solution**: 
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run typecheck
```

### API Endpoint Issues

#### **Issue**: CORS errors or API not accessible
**Symptoms**: Network errors, CORS policy violations
**Solution**: 
```bash
# Check backend server is running
curl http://localhost:8052/api/health

# Verify ports are correct
Backend: 8052
Frontend: 8053
```

#### **Issue**: Database connection errors
**Symptoms**: "Database connection failed" errors
**Solution**:
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Test connection
psql -h localhost -p 5432 -U postgres -d nobox_outreach
```

## 🔧 Diagnostic Commands

### System Health Check
```bash
# Check all services
curl http://localhost:8052/api/health
curl http://localhost:8053  # Frontend should be accessible

# Database connection
psql -d nobox_outreach -c "SELECT COUNT(*) FROM leads;"

# Check logs
tail -f server/logs
```

### Database Verification
```bash
# Check all tables exist
psql -d nobox_outreach -c "\dt"

# Verify lead_enrichment table structure
psql -d nobox_outreach -c "\d lead_enrichment"

# Check for foreign key constraints
psql -d nobox_outreach -c "\d+ leads"
```

### API Testing
```bash
# Test lead endpoints
curl http://localhost:8052/api/leads
curl http://localhost:8052/api/leads/207

# Test enrichment endpoints
curl http://localhost:8052/api/leads/207/sales-coaching
curl http://localhost:8052/api/leads/207/email-drafts

# Test dashboard
curl http://localhost:8052/api/dashboard/stats
```

### CSV Import Testing
```bash
# Test small CSV
curl -X POST -F "file=@test.csv" http://localhost:8052/api/leads/import/csv

# Watch processing logs
tail -f server/logs | grep -E "(CSV|LLM|transformation)"
```

## 🚨 Emergency Recovery

### Complete System Reset
If the system is completely broken:

1. **Database Reset**:
```bash
# Backup current data
pg_dump nobox_outreach > backup_$(date +%Y%m%d).sql

# Reset schema
npm run db:push
```

2. **Clear Cache**:
```bash
# Frontend
rm -rf client/node_modules client/.vite
cd client && npm install

# Backend
rm -rf server/node_modules
cd server && npm install
```

3. **Restart Services**:
```bash
# Stop all
pkill -f "npm run dev"
pkill -f "vite"

# Restart
npm run dev          # Backend
npm run dev:frontend # Frontend
```

### Data Recovery
If data is lost but you have a backup:
```bash
# Restore from backup
psql -d nobox_outreach < backup_YYYYMMDD.sql

# Verify restoration
psql -d nobox_outreach -c "SELECT COUNT(*) FROM leads;"
```

## 📞 When to Escalate

Contact system administrator if:
- Multiple database tables are missing
- OpenAI API is consistently failing
- System performance is severely degraded
- Data corruption is suspected
- Security vulnerabilities are discovered

## 📚 Reference Files

- **Database Schema**: `shared/schema.ts`
- **CSV Import Logic**: `server/services/csv-mapper.ts`
- **API Routes**: `server/routes/`
- **Frontend Components**: `client/src/components/`
- **Configuration**: `.env` files
- **Complete System Documentation**: `HANDOFF_COMPLETE_SYSTEM_FIX.md`

---

*Last Updated: August 25, 2025*  
*System Status: Fully Operational* ✅