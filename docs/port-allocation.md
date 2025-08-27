# Port Allocation for Nobox-Outreach Application

## Dedicated Port Range: 8050-8070

**Reserved Ports for Nobox-Outreach Services**

| Port | Service | Description | Status |
|------|---------|-------------|--------|
| 8050 | Python Automation API | FastAPI main service | **PRIMARY** |
| 8051 | Automation Worker Metrics | Prometheus metrics for workers | Monitoring |
| 8052 | Express.js API | Node.js backend API | **PRIMARY** |
| 8053 | React Development Server | Vite dev server | Development |
| 8054 | React Production Server | Nginx static serve | Production |
| 8055 | Database Admin | pgAdmin or DB tools | Management |
| 8056 | Task Queue Dashboard | Dramatiq/BullMQ UI | Monitoring |
| 8057 | Application Metrics | Prometheus scraping | Monitoring |
| 8058 | Health Check Service | Service health monitoring | Health |
| 8059 | Development Tools | Hot reload/debug tools | Development |

## Service Configuration

### Python Automation Service (Port 8050)
- **Primary API endpoint**: `http://localhost:8050`
- **Health check**: `http://localhost:8050/health`
- **API Documentation**: `http://localhost:8050/docs`
- **Metrics**: `http://localhost:8050/metrics`

### Express.js API (Port 8052)
- **API endpoint**: `http://localhost:8052`
- **Authentication**: `http://localhost:8052/auth`
- **File uploads**: `http://localhost:8052/api/upload`

### Frontend Development (Port 8053)
- **Vite dev server**: `http://localhost:8053`
- **Hot reload**: Enabled
- **API proxy**: Proxies to 8050 and 8052

### Monitoring Stack
- **Worker Metrics** (8051): Dramatiq job queue metrics
- **App Metrics** (8057): Application performance metrics
- **Health Checks** (8058): Service availability monitoring

## Environment Configuration

```bash
# Core Services
PYTHON_API_PORT=8050
EXPRESS_API_PORT=8052
FRONTEND_DEV_PORT=8053
FRONTEND_PROD_PORT=8054

# Monitoring
WORKER_METRICS_PORT=8051
APP_METRICS_PORT=8057
HEALTH_CHECK_PORT=8058

# Management
DB_ADMIN_PORT=8055
TASK_DASHBOARD_PORT=8056
DEV_TOOLS_PORT=8059

# URLs for inter-service communication
PYTHON_API_URL=http://localhost:8050
EXPRESS_API_URL=http://localhost:8052
```

## Docker Compose Port Mapping

```yaml
services:
  automation-api:
    ports:
      - "8050:8050"
  
  automation-worker-metrics:
    ports:
      - "8051:9090"
  
  express-api:
    ports:
      - "8052:3000"
  
  frontend-dev:
    ports:
      - "8053:5173"
  
  frontend-prod:
    ports:
      - "8054:80"
```

## Load Balancer Configuration (Future)

When scaling horizontally:
- **8050-8051**: Python services (can scale to multiple instances)
- **8052**: Express API (can scale with load balancer)
- **8053-8054**: Frontend (dev/prod separation)
- **8055-8059**: Management and monitoring tools

## Security Considerations

- **External Access**: Only ports 8050, 8052, 8053, 8054 should be exposed externally
- **Internal Only**: Ports 8055-8059 should be internal/VPN only
- **Firewall Rules**: Configure iptables/ufw to restrict access as needed

## Development vs Production

### Development Mode
- All ports available on localhost
- Hot reload enabled on 8053
- Debug tools available on 8059
- Direct database access on 8055

### Production Mode
- Frontend served on 8054 via Nginx
- API services on 8050, 8052 behind reverse proxy
- Monitoring ports (8051, 8057, 8058) internal only
- Management ports (8055, 8056, 8059) VPN/internal only

## Port Conflict Resolution

If any port is in use:
1. Check with `netstat -tlnp | grep :PORT`
2. Update environment variables
3. Update Docker Compose configuration
4. Update frontend proxy configuration
5. Update documentation

## Backup Port Range

If 8050-8070 becomes unavailable, fallback to:
- **8080-8090** (commonly used, check availability)
- **8100-8110** (alternative range)

---

**Last Updated**: August 24, 2025  
**Status**: Active Configuration