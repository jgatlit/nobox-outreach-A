# Nobox Outreach - Service Management Guide

## Port Allocation & Service Configuration

### Development Environment Ports (8050-8070)
- **8050**: Python Automation API (FastAPI + Dramatiq)
- **8051**: Prometheus Metrics Server
- **8052**: Express API Server (Node.js + TypeScript)
- **8053**: React Frontend Development Server (Vite)
- **8054**: React Frontend Production Preview
- **8055**: Database Administration Interface (reserved)
- **8056**: Task Dashboard (reserved)
- **8057**: Application Metrics (reserved)
- **8058**: Health Check Service (reserved)
- **8059**: Development Tools (reserved)

## Service Start Commands

### Individual Services

#### 1. Express API Server (Port 8052)
```bash
npm run dev
# Includes: API routes, database connections, Airtable sync
```

#### 2. Python Automation API (Port 8050)
```bash
cd automation-service
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8050 --reload
```

#### 3. React Frontend (Port 8053)
```bash
npm run dev:frontend
# Runs: vite with environment-configured ports
```

#### 4. All Services Together
```bash
npm run dev:full
# Runs Express API + React Frontend concurrently
```

### Infrastructure Services

#### PostgreSQL Database
```bash
docker-compose up -d postgres
# Port: 5432 (internal), Database: nobox_outreach
```

#### Redis Cache
```bash
# Uses system Redis on port 6379
redis-cli ping  # Test connection
```

## Service Health Checks

### Python API Health Check
```bash
curl http://localhost:8050/health
# Expected: {"status":"healthy","service":"automation-api"}
```

### Express API Health Check
```bash
curl http://localhost:8052/api/dashboard/stats
# Expected: JSON response with dashboard statistics
```

### Frontend Health Check
```bash
curl http://localhost:8053/
# Expected: HTML response with Vite dev server
```

## Environment Configuration

### Core Environment Variables (.env)
```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nobox_outreach

# Service Ports
PYTHON_API_PORT=8050
EXPRESS_API_PORT=8052
FRONTEND_DEV_PORT=8053
FRONTEND_PROD_PORT=8054
WORKER_METRICS_PORT=8051

# API Endpoints
PYTHON_API_URL=http://localhost:8050
EXPRESS_API_URL=http://localhost:8052
```

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  React Frontend │    │   Express API   │    │  Python Auto    │
│   (Port 8053)   │◄──►│   (Port 8052)   │◄──►│   (Port 8050)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   PostgreSQL    │    │     Redis       │
                       │   (Port 5432)   │    │   (Port 6379)   │
                       └─────────────────┘    └─────────────────┘
```

## Development Workflow

### Starting Development Environment
1. **Ensure database is running**: `docker-compose up -d postgres`
2. **Start Express API**: `npm run dev` (background)
3. **Start Python API**: `cd automation-service && source venv/bin/activate && uvicorn main:app --reload` (background)
4. **Start React Frontend**: `npm run dev:frontend` (background)
5. **Verify all services**: Check health endpoints

### Stopping Services
```bash
# Kill background processes by name or use Ctrl+C in each terminal
pkill -f "tsx server/index.ts"
pkill -f "uvicorn main:app"
pkill -f "vite"
```

## Troubleshooting

### Port Conflicts
- All services use dedicated ports in 8050-8070 range
- Use `lsof -i :8050` to check port usage
- Adjust ports in .env file if conflicts occur

### Database Connection Issues
- Verify PostgreSQL container: `docker-compose ps postgres`
- Check DATABASE_URL in .env file
- Test connection: `docker-compose exec postgres psql -U postgres -d nobox_outreach`

### Frontend Module Resolution Issues
- Ensure running from project root directory
- Check Vite config alias paths are correct
- Verify all dependencies installed: `npm install`

## Production Deployment Notes
- Use `npm run build` for production frontend build
- Use `npm run start` for production Express server
- Configure environment variables for production
- Use process manager (PM2) for service management
- Set up reverse proxy (nginx) for proper routing