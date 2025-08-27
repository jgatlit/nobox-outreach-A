#!/usr/bin/env python3
"""
Test script to validate the automation service setup.
This tests database connectivity, Redis connectivity, and basic service functionality.
"""

import asyncio
import sys
import os
import time
from typing import Dict, Any

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_database_connection():
    """Test PostgreSQL database connection and pgvector."""
    print("🔍 Testing database connection...")
    try:
        from config import settings
        from sqlalchemy.ext.asyncio import create_async_engine
        from sqlalchemy import text
        
        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        
        async with engine.begin() as conn:
            # Test basic connection
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✅ PostgreSQL connected: {version.split(',')[0]}")
            
            # Test pgvector extension
            result = await conn.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector'"))
            vector_ext = result.scalar()
            if vector_ext:
                print("✅ pgvector extension available")
            else:
                print("❌ pgvector extension not found")
                return False
            
            # Test vector operations
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            result = await conn.execute(text("SELECT '[1,2,3]'::vector(3) <-> '[1,2,4]'::vector(3) AS distance"))
            distance = result.scalar()
            print(f"✅ Vector operations working: distance = {distance}")
        
        await engine.dispose()
        return True
        
    except Exception as e:
        print(f"❌ Database connection failed: {str(e)}")
        return False

def test_redis_connection():
    """Test Redis connection."""
    print("\n🔍 Testing Redis connection...")
    try:
        import redis
        from config import settings
        
        client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        
        # Test basic operations
        client.ping()
        print("✅ Redis connected successfully")
        
        # Test set/get operations
        test_key = "test:connection"
        test_value = "test_value_123"
        client.set(test_key, test_value, ex=10)  # Expire in 10 seconds
        
        retrieved = client.get(test_key)
        if retrieved == test_value:
            print("✅ Redis operations working")
        else:
            print("❌ Redis operations failed")
            return False
        
        # Clean up
        client.delete(test_key)
        return True
        
    except Exception as e:
        print(f"❌ Redis connection failed: {str(e)}")
        return False

async def test_database_operations():
    """Test database operations with SQLAlchemy."""
    print("\n🔍 Testing database operations...")
    try:
        from database import init_database, create_lead, get_lead_by_id
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        from config import settings
        
        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        
        # Initialize database
        await init_database(engine)
        print("✅ Database tables created/verified")
        
        # Test lead operations
        async_session = async_sessionmaker(engine, expire_on_commit=False)
        async with async_session() as session:
            # Create test lead
            test_lead_data = {
                "email": "test@example.com",
                "first_name": "Test",
                "last_name": "User",
                "company": "Test Company",
                "lead_source": "api_test"
            }
            
            lead = await create_lead(session, test_lead_data)
            await session.commit()
            print(f"✅ Lead created with ID: {lead.id}")
            
            # Retrieve lead
            retrieved_lead = await get_lead_by_id(session, str(lead.id))
            if retrieved_lead and retrieved_lead.email == test_lead_data["email"]:
                print("✅ Lead retrieval working")
            else:
                print("❌ Lead retrieval failed")
                return False
        
        await engine.dispose()
        return True
        
    except Exception as e:
        print(f"❌ Database operations failed: {str(e)}")
        return False

def test_ai_services():
    """Test AI service configuration."""
    print("\n🔍 Testing AI services configuration...")
    try:
        from ai_services import AIServiceManager
        from config import settings
        
        ai_service = AIServiceManager()
        
        if settings.OPENAI_API_KEY:
            print("✅ OpenAI API key configured")
        else:
            print("⚠️  OpenAI API key not configured")
        
        if settings.ANTHROPIC_API_KEY:
            print("✅ Anthropic API key configured")
        else:
            print("⚠️  Anthropic API key not configured")
        
        if ai_service.is_available():
            print("✅ At least one AI service is available")
            return True
        else:
            print("⚠️  No AI services configured (add API keys to test)")
            return True  # Not a failure, just not configured
            
    except Exception as e:
        print(f"❌ AI services test failed: {str(e)}")
        return False

def test_dramatiq_setup():
    """Test Dramatiq job queue setup."""
    print("\n🔍 Testing Dramatiq setup...")
    try:
        import dramatiq
        from dramatiq.brokers.redis import RedisBroker
        from config import settings
        
        # Setup broker
        redis_broker = RedisBroker(url=settings.REDIS_URL)
        dramatiq.set_broker(redis_broker)
        
        # Define a test actor
        @dramatiq.actor
        def test_job(message: str) -> str:
            return f"Processed: {message}"
        
        # Test that we can define actors
        print("✅ Dramatiq broker setup successfully")
        print("✅ Test actor defined successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ Dramatiq setup failed: {str(e)}")
        return False

async def test_fastapi_imports():
    """Test FastAPI and related imports."""
    print("\n🔍 Testing FastAPI imports...")
    try:
        from fastapi import FastAPI, HTTPException
        from pydantic import BaseModel
        from models import LeadData, EnrichmentRequest
        
        print("✅ FastAPI imports working")
        print("✅ Pydantic models working")
        
        # Test model validation
        test_lead = LeadData(
            email="test@example.com",
            company="Test Company",
            lead_source="test"
        )
        print("✅ Model validation working")
        
        return True
        
    except Exception as e:
        print(f"❌ FastAPI imports failed: {str(e)}")
        return False

def test_web_scraping():
    """Test web scraping setup."""
    print("\n🔍 Testing web scraping setup...")
    try:
        from scraping import WebScraper
        import aiohttp
        
        print("✅ Web scraping imports working")
        
        # Test that we can create a scraper instance
        scraper = WebScraper(max_pages=1, delay=0.1)
        print("✅ WebScraper instance created")
        
        return True
        
    except Exception as e:
        print(f"❌ Web scraping setup failed: {str(e)}")
        return False

def test_monitoring():
    """Test monitoring and metrics setup."""
    print("\n🔍 Testing monitoring setup...")
    try:
        from monitoring import setup_metrics, record_job_start, record_job_completion
        from prometheus_client import Counter
        
        print("✅ Monitoring imports working")
        
        # Test metrics recording
        start_time = record_job_start("test", "test_job_123")
        time.sleep(0.1)
        record_job_completion("test", "test_job_123", start_time, "success")
        print("✅ Metrics recording working")
        
        return True
        
    except Exception as e:
        print(f"❌ Monitoring setup failed: {str(e)}")
        return False

async def main():
    """Run all tests."""
    print("🚀 Starting nobox-outreach automation service tests...")
    print("=" * 60)
    
    tests = [
        ("Database Connection", test_database_connection()),
        ("Redis Connection", test_redis_connection()),
        ("Database Operations", test_database_operations()),
        ("AI Services", test_ai_services()),
        ("Dramatiq Setup", test_dramatiq_setup()),
        ("FastAPI Imports", test_fastapi_imports()),
        ("Web Scraping", test_web_scraping()),
        ("Monitoring", test_monitoring()),
    ]
    
    results = []
    for test_name, test_coro in tests:
        if asyncio.iscoroutine(test_coro):
            result = await test_coro
        else:
            result = test_coro
        results.append((test_name, result))
    
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:.<40} {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("-" * 60)
    print(f"Total Tests: {len(results)} | Passed: {passed} | Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 All tests passed! The automation service is ready to use.")
        print("\n🚀 Next Steps:")
        print("1. Add your AI API keys to .env file")
        print("2. Start the automation service: cd automation-service && python main.py")
        print("3. Test the API endpoints at http://localhost:8000/docs")
        return True
    else:
        print(f"\n❌ {failed} tests failed. Please fix the issues before proceeding.")
        return False

if __name__ == "__main__":
    import asyncio
    
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n💥 Unexpected error: {str(e)}")
        sys.exit(1)