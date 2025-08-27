# Nobox Outreach - Project Instructions

## Project Overview
Lead management and outreach automation system with intelligent CSV import capabilities and AI-powered lead enrichment.

## System Status: 🚀 FULLY OPERATIONAL

✅ **All Critical Issues Resolved** (August 25, 2025)
✅ **Production Ready System**  
✅ **Complete Feature Set Working**

## Key Architecture Components

### **🤖 LLM-Powered CSV Import System**
**Status**: ✅ FULLY OPERATIONAL - Enhanced with improved error recovery
**Files**: 
- `server/services/csv-mapper.ts` - Enhanced JSON parsing with error recovery
- `server/routes/csv-import.ts` - API endpoints
- `client/src/components/LeadManagement/BulkImportModal.tsx` - Improved UX with better feedback

**Features**:
- Intelligent column mapping for any CSV format (ZoomInfo, LinkedIn, etc.)
- Single-step upload → AI process → import workflow
- Enhanced JSON parsing with error recovery for malformed LLM responses
- OpenAI GPT-4o-mini integration with robust error handling
- Extended timeout support for large CSV files (50+ records)
- Improved user feedback with partial success messaging

**Recent Fixes**:
- ✅ Enhanced JSON parsing to handle unterminated LLM responses
- ✅ Better frontend error messaging for partial successes
- ✅ Improved timeout communication for users

### **🎯 Lead Enrichment & AI Features**
**Status**: ✅ FULLY OPERATIONAL
**Features**:
- **Lead Enrichment**: AI-powered data collection with OpenAI GPT-4o
- **Sales Coaching**: Personalized coaching tips generation
- **Email Draft Generation**: AI-generated personalized emails
- **Web Scraping**: Apify integration with Cheerio fallback

### **Database Schema**
- **Main Table**: `leads` with comprehensive fields
- **Supporting Tables**: `lead_enrichment`, `email_drafts`, `workflows`, `integrations`, `ad_campaigns`, `ad_variants`
- **Recent Fixes**: All missing tables created, foreign key relationships restored
- **Status**: ✅ Complete schema - Ready for all operations

### **Environment Setup**
```bash
# Services
Frontend: http://localhost:8053 (Vite dev server)
Backend: http://localhost:8052 (Express API)
Database: PostgreSQL on localhost:5432

# Key Variables
OPENAI_API_KEY=configured
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nobox_outreach
```

## Development Workflow

### **CSV Import Performance**
✅ **Small Files (< 10 records)**: 4-7 seconds processing
✅ **Medium Files (10-20 records)**: 15-30 seconds processing  
✅ **Large Files (50+ records)**: 2-3 minutes processing
✅ **Tested Formats**: Standard CSV, ZoomInfo, LinkedIn Sales Navigator
✅ **LLM Processing**: GPT-4o-mini with intelligent field mapping

### **Common Commands**
```bash
# Start services
npm run dev          # Express server (port 8052)
npm run dev:frontend # Vite dev server (port 8053)

# Database operations
npm run db:push      # Apply schema changes
npm run db:studio    # Database admin UI

# Debug CSV imports
tail -f server/logs  # Watch server logs
curl -X POST localhost:8052/api/leads/import/csv  # Test endpoint
```

### **Resolved Issues (August 25, 2025)**
✅ **RESOLVED - Database Schema**: All missing tables created and foreign keys restored
✅ **RESOLVED - Lead Detail Pages**: 500 errors fixed, all detail pages working
✅ **RESOLVED - CSV Import UX**: Enhanced error messaging and partial success handling
✅ **RESOLVED - JSON Parsing**: Robust error recovery for malformed LLM responses
✅ **RESOLVED - API Endpoints**: All lead enrichment and coaching endpoints operational
✅ **RESOLVED - Sales Coaching**: Working with proper enrichment detection
✅ **RESOLVED - Email Generation**: Functional with campaign integration

### **Current System Health**
🟢 **All Features Operational**:
- Lead Management: Create, read, update, delete leads
- Lead Enrichment: AI-powered data collection and analysis
- Sales Coaching: Personalized coaching tip generation
- Email Draft Generation: AI-generated personalized emails
- CSV Import: Intelligent mapping with enhanced error handling
- Dashboard Analytics: Stats, workflows, campaigns, integrations

## Implementation Notes

### **LLM Strategy**
- Direct CSV → leads transformation (no intermediate mapping steps)
- Comprehensive prompt with schema understanding
- Temperature: 0.1 for consistency
- Fallback to rule-based patterns if LLM fails

### **File Structure**
```
server/
├── services/csv-mapper.ts      # LLM transformation core
├── routes/csv-import.ts        # New intelligent routes
├── routes.ts                   # Main routes (old CSV route disabled)
├── importers/index.ts          # Legacy import functions
└── middleware/upload.ts        # Multer configuration

client/src/
├── components/LeadManagement/BulkImportModal.tsx  # UI
└── lib/queryClient.ts          # API client (FormData fixed)
```

### **Security & Performance**
- File size limit: 10MB
- File type validation: CSV only  
- Duplicate email detection
- Error handling and reporting
- Temporary file cleanup
- **Timeout Management**: 5-minute frontend timeout for large file processing
- **Token Optimization**: OpenAI caching reduces processing time for repeat imports
- **Progress Indicators**: Real-time feedback with processing time estimates

## System Status & Usage

### **✅ Production Ready**
The LLM-powered CSV import system is fully operational and ready for production use:

1. **Upload CSV**: Any format (ZoomInfo, LinkedIn, custom exports)
2. **AI Processing**: Intelligent field mapping with GPT-4o-mini
3. **Bulk Import**: Handle files with 50+ records (2-3 minute processing)
4. **Verification**: Check lead count or refresh to confirm successful imports

### **🔍 Monitoring**
```bash
# Watch backend processing logs
tail -f server/logs

# Check current lead count
curl http://localhost:8052/api/leads | jq 'length'

# Test small CSV import
curl --form "file=@test.csv" http://localhost:8052/api/leads/import/csv
```

### **💡 Best Practices**
- Large CSV files (50+ records) require patience (2-3 minutes)
- Enhanced user feedback now provides better progress communication
- Verify imports by checking lead count or refreshing the lead management page
- Duplicate emails are automatically detected and skipped
- Lead enrichment requires OpenAI API key configuration
- Sales coaching generates after lead enrichment completion

---

## 📋 Quick Reference

### **Testing Endpoints**
```bash
# Test specific lead with enrichment
curl http://localhost:8052/api/leads/207 | jq '.lead.enrichmentStatus'

# Test sales coaching
curl http://localhost:8052/api/leads/207/sales-coaching

# Test email drafts
curl http://localhost:8052/api/leads/207/email-drafts

# Test dashboard stats
curl http://localhost:8052/api/dashboard/stats
```

### **System Architecture**
```
leads (main table)
├── lead_enrichment (1:1) - AI-generated insights and coaching
├── email_drafts (1:many) - Generated personalized emails
└── Related: campaigns, workflows, integrations
```

---

*Updated: 2025-08-25 - Complete System Restoration - ALL FEATURES OPERATIONAL* ✅