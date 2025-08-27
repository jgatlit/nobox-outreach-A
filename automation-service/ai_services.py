"""
AI services for OpenAI and Anthropic integration.
Handles lead enrichment, email generation, and insights.
"""

import asyncio
import json
from typing import Dict, Any, List, Optional
import openai
import anthropic
from loguru import logger

from config import settings

class OpenAIService:
    """OpenAI API service for lead enrichment."""
    
    def __init__(self, api_key: str):
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.model = settings.OPENAI_MODEL
    
    async def generate_lead_insights(self, context_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate lead insights using OpenAI."""
        try:
            prompt = self._build_insights_prompt(context_data)
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._get_system_prompt()},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            return json.loads(content)
            
        except Exception as e:
            logger.error(f"OpenAI insights generation failed: {str(e)}")
            raise
    
    async def generate_email_hooks(self, company_data: Dict[str, Any], count: int = 3) -> List[str]:
        """Generate personalized email hooks."""
        prompt = f"""
        Based on this company data, generate {count} personalized email hooks for B2B outreach:
        
        Company: {company_data.get('company_name', 'Unknown')}
        Industry: {company_data.get('industry', 'Unknown')}
        Tech Stack: {company_data.get('tech_stack', [])}
        Recent Content: {company_data.get('recent_content', [])}
        
        Return as JSON array of strings.
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert B2B sales copywriter specializing in personalized outreach."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8,
                max_tokens=400,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            return result.get('hooks', [])
            
        except Exception as e:
            logger.error(f"OpenAI email hooks generation failed: {str(e)}")
            return []
    
    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for vector storage."""
        try:
            response = await self.client.embeddings.create(
                model="text-embedding-3-small",
                input=texts
            )
            
            return [embedding.embedding for embedding in response.data]
            
        except Exception as e:
            logger.error(f"OpenAI embeddings generation failed: {str(e)}")
            return []
    
    def _build_insights_prompt(self, context_data: Dict[str, Any]) -> str:
        """Build prompt for insights generation."""
        return f"""
        Analyze this company data and generate actionable sales insights:
        
        Website Content: {context_data.get('website_content', [])}
        Tech Stack: {context_data.get('tech_stack', [])}
        Company Info: {context_data.get('company_info', {})}
        Additional Context: {context_data.get('additional_context', '')}
        
        Provide analysis in this JSON format:
        {{
            "email_hooks": ["hook1", "hook2", "hook3"],
            "company_insights": {{
                "industry_focus": "string",
                "pain_points": ["point1", "point2"],
                "technology_needs": ["need1", "need2"],
                "decision_maker_profile": "string"
            }},
            "personalization_score": 0-100,
            "recommended_approach": "string",
            "confidence_level": "low|medium|high"
        }}
        """
    
    def _get_system_prompt(self) -> str:
        """Get system prompt for lead analysis."""
        return """
        You are an expert B2B sales intelligence analyst specializing in lead qualification and personalization.
        Your role is to analyze company data and provide actionable insights for sales outreach.
        
        Focus on:
        1. Identifying genuine business pain points
        2. Understanding technology stack and needs
        3. Crafting personalized conversation starters
        4. Assessing lead quality and fit
        
        Always provide specific, actionable insights based on actual data.
        Avoid generic or templated responses.
        """

class AnthropicService:
    """Anthropic Claude API service for lead enrichment."""
    
    def __init__(self, api_key: str):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = settings.ANTHROPIC_MODEL
    
    async def generate_lead_insights(self, context_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate lead insights using Claude."""
        try:
            prompt = self._build_insights_prompt(context_data)
            
            message = await self.client.messages.create(
                model=self.model,
                max_tokens=1000,
                system=self._get_system_prompt(),
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            content = message.content[0].text
            
            # Parse JSON response
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                # Fallback parsing
                return self._parse_text_response(content)
                
        except Exception as e:
            logger.error(f"Anthropic insights generation failed: {str(e)}")
            raise
    
    async def generate_email_content(self, lead_data: Dict[str, Any], insights: Dict[str, Any]) -> str:
        """Generate complete email content."""
        prompt = f"""
        Create a personalized B2B outreach email based on:
        
        Lead: {lead_data.get('first_name', '')} {lead_data.get('last_name', '')}
        Company: {lead_data.get('company', 'Unknown')}
        Position: {lead_data.get('position', 'Unknown')}
        
        Insights: {json.dumps(insights, indent=2)}
        
        Write a professional, concise email (150-200 words) that:
        1. References specific company insights
        2. Offers genuine value
        3. Includes a clear, soft call-to-action
        4. Avoids sales-y language
        
        Format as complete email with subject line.
        """
        
        try:
            message = await self.client.messages.create(
                model=self.model,
                max_tokens=600,
                system="You are an expert B2B sales copywriter known for high-converting, personalized outreach emails.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            return message.content[0].text
            
        except Exception as e:
            logger.error(f"Anthropic email generation failed: {str(e)}")
            return ""
    
    def _build_insights_prompt(self, context_data: Dict[str, Any]) -> str:
        """Build prompt for insights generation."""
        return f"""
        Analyze this company data to generate sales intelligence:
        
        Website Pages: {context_data.get('website_content', [])}
        Technology Stack: {context_data.get('tech_stack', [])}
        Company Information: {context_data.get('company_info', {})}
        Context: {context_data.get('additional_context', '')}
        
        Provide detailed analysis in JSON format:
        {{
            "email_hooks": ["specific hook 1", "specific hook 2", "specific hook 3"],
            "company_insights": {{
                "industry_focus": "specific industry details",
                "pain_points": ["identified pain point 1", "pain point 2"],
                "technology_needs": ["tech need 1", "tech need 2"],
                "decision_maker_profile": "detailed profile",
                "growth_indicators": ["indicator 1", "indicator 2"],
                "competitive_landscape": "analysis"
            }},
            "personalization_score": 85,
            "recommended_approach": "specific strategy recommendation",
            "confidence_level": "high",
            "next_steps": ["action 1", "action 2"]
        }}
        
        Base your analysis on actual data provided. Be specific and actionable.
        """
    
    def _get_system_prompt(self) -> str:
        """Get system prompt for Claude."""
        return """
        You are a senior B2B sales intelligence analyst with deep expertise in lead qualification, 
        market research, and personalized outreach strategy.
        
        Your analysis should be:
        - Data-driven and specific to the company provided
        - Focused on actionable business insights
        - Tailored for B2B sales and marketing professionals
        - Professional yet conversational in tone
        
        Always ground your insights in the actual data provided rather than making generic assumptions.
        """
    
    def _parse_text_response(self, content: str) -> Dict[str, Any]:
        """Fallback parsing for non-JSON responses."""
        return {
            "email_hooks": ["Generic hook based on content analysis"],
            "company_insights": {
                "industry_focus": "Analysis based on content",
                "pain_points": ["Identified from content"],
                "technology_needs": ["Inferred from data"]
            },
            "personalization_score": 50,
            "recommended_approach": "Standard approach based on available data",
            "confidence_level": "medium"
        }

class AIServiceManager:
    """Manages multiple AI services with fallback logic."""
    
    def __init__(self):
        self.openai_service = None
        self.anthropic_service = None
        
        # Initialize available services
        if settings.OPENAI_API_KEY:
            self.openai_service = OpenAIService(settings.OPENAI_API_KEY)
        
        if settings.ANTHROPIC_API_KEY:
            self.anthropic_service = AnthropicService(settings.ANTHROPIC_API_KEY)
    
    async def generate_lead_insights(self, context_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate insights with fallback between services."""
        last_error = None
        
        # Try OpenAI first (generally faster for JSON responses)
        if self.openai_service:
            try:
                return await self.openai_service.generate_lead_insights(context_data)
            except Exception as e:
                logger.warning(f"OpenAI failed, trying Anthropic: {str(e)}")
                last_error = e
        
        # Fallback to Anthropic
        if self.anthropic_service:
            try:
                return await self.anthropic_service.generate_lead_insights(context_data)
            except Exception as e:
                logger.error(f"Anthropic also failed: {str(e)}")
                last_error = e
        
        # If all services fail, return basic structure
        if last_error:
            logger.error(f"All AI services failed: {str(last_error)}")
            raise Exception("No AI service available or all failed")
        
        raise Exception("No AI service configured")
    
    async def generate_email_hooks(self, company_data: Dict[str, Any], count: int = 3) -> List[str]:
        """Generate email hooks with service fallback."""
        if self.openai_service:
            try:
                return await self.openai_service.generate_email_hooks(company_data, count)
            except Exception as e:
                logger.warning(f"OpenAI email hooks failed: {str(e)}")
        
        if self.anthropic_service:
            try:
                # Anthropic doesn't have a dedicated email hooks method, use insights
                insights = await self.anthropic_service.generate_lead_insights({"company_info": company_data})
                return insights.get("email_hooks", [])
            except Exception as e:
                logger.error(f"Anthropic email hooks failed: {str(e)}")
        
        return ["Generic personalized hook based on available data"]
    
    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings (only available via OpenAI)."""
        if not self.openai_service:
            logger.warning("OpenAI not configured, cannot generate embeddings")
            return []
        
        return await self.openai_service.generate_embeddings(texts)
    
    def is_available(self) -> bool:
        """Check if any AI service is available."""
        return bool(self.openai_service or self.anthropic_service)

# Global AI service manager instance
ai_service = AIServiceManager()