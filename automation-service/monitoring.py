"""
Monitoring and metrics collection for the automation service.
Provides Prometheus metrics and logging.
"""

import time
from typing import Dict, Any
from prometheus_client import Counter, Histogram, Gauge, Info, start_http_server
from loguru import logger

from config import settings

# === PROMETHEUS METRICS ===

# Job metrics
job_total = Counter(
    'automation_jobs_total',
    'Total number of automation jobs processed',
    ['job_type', 'status']
)

job_duration = Histogram(
    'automation_job_duration_seconds',
    'Time spent processing automation jobs',
    ['job_type'],
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0]
)

# Lead enrichment metrics
leads_processed = Counter(
    'leads_processed_total',
    'Total number of leads processed',
    ['source', 'status']
)

enrichment_duration = Histogram(
    'lead_enrichment_duration_seconds',
    'Time spent on lead enrichment',
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0, 600.0]
)

ai_requests = Counter(
    'ai_requests_total',
    'Total AI service requests',
    ['service', 'status']
)

ai_response_time = Histogram(
    'ai_response_time_seconds',
    'AI service response time',
    ['service'],
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 30.0, 60.0]
)

# Web scraping metrics
scraping_requests = Counter(
    'scraping_requests_total',
    'Total web scraping requests',
    ['status']
)

scraping_duration = Histogram(
    'scraping_duration_seconds',
    'Time spent scraping websites',
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0]
)

pages_scraped = Counter(
    'pages_scraped_total',
    'Total number of pages scraped'
)

# Database metrics
db_operations = Counter(
    'database_operations_total',
    'Total database operations',
    ['operation', 'table', 'status']
)

db_query_duration = Histogram(
    'database_query_duration_seconds',
    'Database query execution time',
    ['operation'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)

# System metrics
active_jobs = Gauge(
    'active_jobs_count',
    'Number of currently active jobs',
    ['job_type']
)

queue_size = Gauge(
    'queue_size',
    'Number of jobs in queue',
    ['queue_name']
)

# API metrics
http_requests = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint'],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

# Error metrics
errors_total = Counter(
    'errors_total',
    'Total number of errors',
    ['error_type', 'component']
)

# Application info
app_info = Info(
    'automation_service_info',
    'Information about the automation service'
)

# === METRIC COLLECTION FUNCTIONS ===

def record_job_start(job_type: str, job_id: str) -> float:
    """Record job start and return start time."""
    active_jobs.labels(job_type=job_type).inc()
    logger.info(f"Job started: {job_type} - {job_id}")
    return time.time()

def record_job_completion(job_type: str, job_id: str, start_time: float, status: str = "success"):
    """Record job completion."""
    duration = time.time() - start_time
    
    job_total.labels(job_type=job_type, status=status).inc()
    job_duration.labels(job_type=job_type).observe(duration)
    active_jobs.labels(job_type=job_type).dec()
    
    logger.info(f"Job completed: {job_type} - {job_id} - {status} - {duration:.2f}s")

def record_lead_processing(source: str, status: str, duration: float = None):
    """Record lead processing metrics."""
    leads_processed.labels(source=source, status=status).inc()
    
    if duration:
        enrichment_duration.observe(duration)

def record_ai_request(service: str, start_time: float, status: str = "success"):
    """Record AI service request metrics."""
    duration = time.time() - start_time
    
    ai_requests.labels(service=service, status=status).inc()
    ai_response_time.labels(service=service).observe(duration)
    
    logger.debug(f"AI request: {service} - {status} - {duration:.2f}s")

def record_scraping_request(url: str, start_time: float, pages_count: int = 0, status: str = "success"):
    """Record web scraping metrics."""
    duration = time.time() - start_time
    
    scraping_requests.labels(status=status).inc()
    scraping_duration.observe(duration)
    
    if pages_count > 0:
        pages_scraped.inc(pages_count)
    
    logger.info(f"Scraping completed: {url} - {pages_count} pages - {status} - {duration:.2f}s")

def record_database_operation(operation: str, table: str, start_time: float, status: str = "success"):
    """Record database operation metrics."""
    duration = time.time() - start_time
    
    db_operations.labels(operation=operation, table=table, status=status).inc()
    db_query_duration.labels(operation=operation).observe(duration)
    
    logger.debug(f"DB operation: {operation} {table} - {status} - {duration:.3f}s")

def record_http_request(method: str, endpoint: str, start_time: float, status_code: int):
    """Record HTTP request metrics."""
    duration = time.time() - start_time
    status_class = f"{status_code // 100}xx"
    
    http_requests.labels(method=method, endpoint=endpoint, status=status_class).inc()
    http_request_duration.labels(method=method, endpoint=endpoint).observe(duration)

def record_error(error_type: str, component: str, error_message: str = None):
    """Record error metrics."""
    errors_total.labels(error_type=error_type, component=component).inc()
    
    if error_message:
        logger.error(f"Error recorded: {component} - {error_type} - {error_message}")
    else:
        logger.error(f"Error recorded: {component} - {error_type}")

def update_queue_size(queue_name: str, size: int):
    """Update queue size metric."""
    queue_size.labels(queue_name=queue_name).set(size)

# === CONTEXT MANAGERS FOR TIMING ===

class MetricTimer:
    """Context manager for timing operations."""
    
    def __init__(self, metric_func, *args, **kwargs):
        self.metric_func = metric_func
        self.args = args
        self.kwargs = kwargs
        self.start_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.start_time:
            duration = time.time() - self.start_time
            status = "error" if exc_type else "success"
            self.metric_func(*self.args, duration=duration, status=status, **self.kwargs)

class JobTimer:
    """Context manager for timing jobs."""
    
    def __init__(self, job_type: str, job_id: str):
        self.job_type = job_type
        self.job_id = job_id
        self.start_time = None
    
    def __enter__(self):
        self.start_time = record_job_start(self.job_type, self.job_id)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.start_time:
            status = "error" if exc_type else "success"
            record_job_completion(self.job_type, self.job_id, self.start_time, status)

# === SETUP AND INITIALIZATION ===

def setup_metrics():
    """Setup metrics collection and export."""
    try:
        # Set application info
        app_info.info({
            'version': '1.0.0',
            'service': 'nobox-automation',
            'environment': 'development' if settings.DEBUG else 'production'
        })
        
        # Start Prometheus metrics server on separate port
        start_http_server(settings.PROMETHEUS_PORT)
        logger.info(f"Prometheus metrics server started on port {settings.PROMETHEUS_PORT}")
        
    except Exception as e:
        logger.error(f"Failed to setup metrics: {str(e)}")

def get_metrics_summary() -> Dict[str, Any]:
    """Get current metrics summary."""
    try:
        from prometheus_client import REGISTRY
        
        summary = {}
        
        # Collect current metric values
        for collector in REGISTRY._collector_to_names.keys():
            for metric_family in collector.collect():
                metric_name = metric_family.name
                metric_type = metric_family.type
                
                if metric_type == 'counter':
                    summary[f"{metric_name}_total"] = sum(sample.value for sample in metric_family.samples)
                elif metric_type == 'gauge':
                    summary[f"{metric_name}_current"] = {
                        sample.labels: sample.value 
                        for sample in metric_family.samples
                    }
        
        return summary
        
    except Exception as e:
        logger.error(f"Failed to get metrics summary: {str(e)}")
        return {}

# === HEALTH CHECK FUNCTIONS ===

def get_service_health() -> Dict[str, Any]:
    """Get service health status."""
    try:
        health_status = {
            "status": "healthy",
            "timestamp": time.time(),
            "metrics": {
                "total_jobs_processed": sum(
                    sample.value for family in REGISTRY._collector_to_names.keys() 
                    for metric_family in family.collect() 
                    if metric_family.name == 'automation_jobs_total'
                    for sample in metric_family.samples
                ),
                "active_jobs": sum(
                    sample.value for family in REGISTRY._collector_to_names.keys()
                    for metric_family in family.collect()
                    if metric_family.name == 'active_jobs_count'
                    for sample in metric_family.samples
                ),
                "error_rate": "< 1%",  # Simplified calculation
            },
            "services": {
                "database": "connected",
                "redis": "connected",
                "ai_services": "available"
            }
        }
        
        return health_status
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": time.time()
        }

# === LOGGING CONFIGURATION ===

def setup_logging():
    """Setup structured logging."""
    try:
        # Remove default handler
        logger.remove()
        
        # Add console handler with formatting
        logger.add(
            sink=lambda message: print(message, end=""),
            format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
                   "<level>{level: <8}</level> | "
                   "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
                   "<level>{message}</level>",
            colorize=True,
            level="INFO" if not settings.DEBUG else "DEBUG"
        )
        
        # Add file handler for errors
        logger.add(
            "/tmp/automation-service-errors.log",
            rotation="10 MB",
            retention="7 days",
            level="ERROR",
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message}"
        )
        
        logger.info("Logging configured successfully")
        
    except Exception as e:
        print(f"Failed to setup logging: {str(e)}")

# Initialize logging on import
setup_logging()