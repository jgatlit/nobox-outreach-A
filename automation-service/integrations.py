"""
External service integrations for Google Docs, Gmail, Airtable, etc.
Replaces n8n integration nodes with direct API calls.
"""

import json
import os
from typing import Dict, Any, List, Optional
import aiohttp
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
from loguru import logger

# Google API imports (optional, install as needed)
try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    GOOGLE_AVAILABLE = True
except ImportError:
    logger.warning("Google API libraries not installed")
    GOOGLE_AVAILABLE = False

# SendGrid import (optional)
try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail
    SENDGRID_AVAILABLE = True
except ImportError:
    logger.warning("SendGrid library not installed")
    SENDGRID_AVAILABLE = False

from config import settings

class GoogleDocsService:
    """Google Docs integration service."""
    
    def __init__(self):
        self.service = None
        self.credentials = None
        self._setup_credentials()
    
    def _setup_credentials(self):
        """Setup Google API credentials."""
        if not GOOGLE_AVAILABLE:
            logger.warning("Google API libraries not available")
            return
        
        try:
            if settings.GOOGLE_APPLICATION_CREDENTIALS and os.path.exists(settings.GOOGLE_APPLICATION_CREDENTIALS):
                # Service account credentials
                self.credentials = service_account.Credentials.from_service_account_file(
                    settings.GOOGLE_APPLICATION_CREDENTIALS,
                    scopes=['https://www.googleapis.com/auth/documents',
                           'https://www.googleapis.com/auth/drive']
                )
            elif settings.GOOGLE_SHEETS_PRIVATE_KEY and settings.GOOGLE_SHEETS_CLIENT_EMAIL:
                # Manual service account setup
                service_account_info = {
                    "type": "service_account",
                    "private_key": settings.GOOGLE_SHEETS_PRIVATE_KEY.replace('\\n', '\n'),
                    "client_email": settings.GOOGLE_SHEETS_CLIENT_EMAIL,
                    "token_uri": "https://oauth2.googleapis.com/token"
                }
                
                self.credentials = service_account.Credentials.from_service_account_info(
                    service_account_info,
                    scopes=['https://www.googleapis.com/auth/documents',
                           'https://www.googleapis.com/auth/drive']
                )
            
            if self.credentials:
                self.service = build('docs', 'v1', credentials=self.credentials)
                self.drive_service = build('drive', 'v3', credentials=self.credentials)
                logger.info("Google Docs service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to setup Google credentials: {str(e)}")
    
    def is_configured(self) -> bool:
        """Check if Google Docs is properly configured."""
        return self.service is not None
    
    def create_document(self, title: str, content: str) -> Optional[str]:
        """
        Create a Google Doc with content.
        Replaces n8n Google Docs node.
        """
        if not self.is_configured():
            logger.warning("Google Docs not configured")
            return None
        
        try:
            # Create document
            document = {
                'title': title
            }
            
            doc = self.service.documents().create(body=document).execute()
            doc_id = doc.get('documentId')
            
            # Add content
            requests = [
                {
                    'insertText': {
                        'location': {
                            'index': 1,
                        },
                        'text': content
                    }
                }
            ]
            
            self.service.documents().batchUpdate(
                documentId=doc_id, 
                body={'requests': requests}
            ).execute()
            
            # Make document publicly readable
            permission = {
                'type': 'anyone',
                'role': 'reader'
            }
            
            self.drive_service.permissions().create(
                fileId=doc_id,
                body=permission
            ).execute()
            
            doc_url = f"https://docs.google.com/document/d/{doc_id}/edit"
            logger.info(f"Created Google Doc: {doc_url}")
            
            return doc_url
            
        except Exception as e:
            logger.error(f"Failed to create Google Doc: {str(e)}")
            return None

class GoogleSheetsService:
    """Google Sheets integration service."""
    
    def __init__(self):
        self.service = None
        self.credentials = None
        self._setup_credentials()
    
    def _setup_credentials(self):
        """Setup Google Sheets credentials."""
        if not GOOGLE_AVAILABLE:
            return
        
        try:
            if settings.GOOGLE_APPLICATION_CREDENTIALS and os.path.exists(settings.GOOGLE_APPLICATION_CREDENTIALS):
                self.credentials = service_account.Credentials.from_service_account_file(
                    settings.GOOGLE_APPLICATION_CREDENTIALS,
                    scopes=['https://www.googleapis.com/auth/spreadsheets']
                )
            
            if self.credentials:
                self.service = build('sheets', 'v4', credentials=self.credentials)
                logger.info("Google Sheets service initialized")
            
        except Exception as e:
            logger.error(f"Failed to setup Google Sheets: {str(e)}")
    
    def is_configured(self) -> bool:
        """Check if Google Sheets is configured."""
        return self.service is not None
    
    async def append_lead_data(self, spreadsheet_id: str, lead_data: Dict[str, Any]) -> bool:
        """Append lead data to Google Sheets."""
        if not self.is_configured():
            return False
        
        try:
            # Prepare row data
            row_data = [
                lead_data.get('email', ''),
                lead_data.get('first_name', ''),
                lead_data.get('last_name', ''),
                lead_data.get('company', ''),
                lead_data.get('position', ''),
                lead_data.get('website', ''),
                lead_data.get('lead_source', ''),
                lead_data.get('status', ''),
                str(lead_data.get('lead_score', 0))
            ]
            
            body = {
                'values': [row_data]
            }
            
            result = self.service.spreadsheets().values().append(
                spreadsheetId=spreadsheet_id,
                range='Sheet1!A:I',
                valueInputOption='RAW',
                body=body
            ).execute()
            
            logger.info(f"Appended lead data to Google Sheets: {result.get('updates', {}).get('updatedRows', 0)} rows")
            return True
            
        except Exception as e:
            logger.error(f"Failed to append to Google Sheets: {str(e)}")
            return False

class EmailService:
    """Email service with multiple provider support."""
    
    def __init__(self):
        self.sendgrid_client = None
        self._setup_sendgrid()
    
    def _setup_sendgrid(self):
        """Setup SendGrid client."""
        if SENDGRID_AVAILABLE and settings.SENDGRID_API_KEY:
            try:
                self.sendgrid_client = SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
                logger.info("SendGrid client initialized")
            except Exception as e:
                logger.error(f"Failed to setup SendGrid: {str(e)}")
    
    async def send_email(self, recipient: str, subject: str, template: str = "default", template_data: Dict[str, Any] = None) -> bool:
        """
        Send email using available provider.
        Replaces n8n email nodes.
        """
        try:
            if self.sendgrid_client:
                return await self._send_via_sendgrid(recipient, subject, template, template_data or {})
            else:
                logger.warning("No email service configured")
                return False
                
        except Exception as e:
            logger.error(f"Failed to send email to {recipient}: {str(e)}")
            return False
    
    async def _send_via_sendgrid(self, recipient: str, subject: str, template: str, data: Dict[str, Any]) -> bool:
        """Send email via SendGrid."""
        try:
            # Generate content based on template
            content = self._generate_email_content(template, data)
            
            message = Mail(
                from_email='noreply@noboxcreatives.com',  # Configure as needed
                to_emails=recipient,
                subject=subject,
                html_content=content
            )
            
            response = self.sendgrid_client.send(message)
            
            if response.status_code in [200, 202]:
                logger.info(f"Email sent successfully to {recipient}")
                return True
            else:
                logger.error(f"SendGrid error {response.status_code}: {response.body}")
                return False
                
        except Exception as e:
            logger.error(f"SendGrid send failed: {str(e)}")
            return False
    
    def _generate_email_content(self, template: str, data: Dict[str, Any]) -> str:
        """Generate email content from template and data."""
        if template == "lead_enrichment":
            return f"""
            <html>
            <body>
                <h2>Lead Enrichment Results</h2>
                <p><strong>Company:</strong> {data.get('company', 'Unknown')}</p>
                <p><strong>Contact:</strong> {data.get('contact', 'Unknown')}</p>
                
                <h3>AI Insights</h3>
                <ul>
                    {''.join(f'<li>{hook}</li>' for hook in data.get('email_hooks', []))}
                </ul>
                
                <p><strong>Personalization Score:</strong> {data.get('personalization_score', 0)}/100</p>
                
                <p>Generated by Nobox Outreach Automation</p>
            </body>
            </html>
            """
        
        # Default template
        return f"""
        <html>
        <body>
            <h2>Automated Message</h2>
            <p>{data.get('message', 'No message content')}</p>
            <p>Best regards,<br>Nobox Outreach Team</p>
        </body>
        </html>
        """

class AirtableService:
    """Airtable integration service."""
    
    def __init__(self):
        self.api_key = settings.AIRTABLE_API_KEY
        self.base_url = "https://api.airtable.com/v0"
        self.session = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession(
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    async def create_record(self, base_id: str, table_name: str, fields: Dict[str, Any]) -> Optional[str]:
        """
        Create record in Airtable.
        Replaces n8n Airtable node.
        """
        if not self.api_key:
            logger.warning("Airtable API key not configured")
            return None
        
        try:
            async with self:
                url = f"{self.base_url}/{base_id}/{table_name}"
                
                data = {
                    "fields": fields
                }
                
                async with self.session.post(url, json=data) as response:
                    if response.status == 200:
                        result = await response.json()
                        record_id = result.get('id')
                        logger.info(f"Created Airtable record: {record_id}")
                        return record_id
                    else:
                        error_text = await response.text()
                        logger.error(f"Airtable create failed {response.status}: {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"Airtable create record failed: {str(e)}")
            return None
    
    async def update_record(self, base_id: str, table_name: str, record_id: str, fields: Dict[str, Any]) -> bool:
        """Update existing Airtable record."""
        if not self.api_key:
            return False
        
        try:
            async with self:
                url = f"{self.base_url}/{base_id}/{table_name}/{record_id}"
                
                data = {
                    "fields": fields
                }
                
                async with self.session.patch(url, json=data) as response:
                    if response.status == 200:
                        logger.info(f"Updated Airtable record: {record_id}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Airtable update failed {response.status}: {error_text}")
                        return False
                        
        except Exception as e:
            logger.error(f"Airtable update record failed: {str(e)}")
            return False

class SlackService:
    """Slack integration for notifications."""
    
    def __init__(self, webhook_url: Optional[str] = None):
        self.webhook_url = webhook_url or os.getenv('SLACK_WEBHOOK_URL')
    
    async def send_notification(self, message: str, channel: Optional[str] = None) -> bool:
        """Send Slack notification."""
        if not self.webhook_url:
            logger.warning("Slack webhook URL not configured")
            return False
        
        try:
            payload = {
                "text": message,
                "username": "Nobox Automation",
                "icon_emoji": ":robot_face:"
            }
            
            if channel:
                payload["channel"] = channel
            
            async with aiohttp.ClientSession() as session:
                async with session.post(self.webhook_url, json=payload) as response:
                    if response.status == 200:
                        logger.info("Slack notification sent successfully")
                        return True
                    else:
                        logger.error(f"Slack notification failed: {response.status}")
                        return False
                        
        except Exception as e:
            logger.error(f"Slack notification error: {str(e)}")
            return False

class WebhookService:
    """Generic webhook service for integrations."""
    
    def __init__(self):
        self.session = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    async def send_webhook(self, url: str, data: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> bool:
        """Send webhook to external service."""
        try:
            async with self:
                request_headers = {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Nobox-Automation/1.0'
                }
                
                if headers:
                    request_headers.update(headers)
                
                async with self.session.post(url, json=data, headers=request_headers) as response:
                    if 200 <= response.status < 300:
                        logger.info(f"Webhook sent successfully to {url}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Webhook failed {response.status}: {error_text}")
                        return False
                        
        except Exception as e:
            logger.error(f"Webhook send failed to {url}: {str(e)}")
            return False

# Service instances (lazy initialization)
google_docs_service = GoogleDocsService()
google_sheets_service = GoogleSheetsService()
email_service = EmailService()
airtable_service = AirtableService()
slack_service = SlackService()
webhook_service = WebhookService()