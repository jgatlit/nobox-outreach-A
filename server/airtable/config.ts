/**
 * Airtable MCP Server Configuration
 * 
 * This file contains the configuration for connecting to Airtable via the MCP server.
 * It uses environment variables for sensitive information like API keys.
 */

// Define table interface for better typing
interface AirtableTable {
  id: string;
  name: string;
  description?: string;
}

// Define base interface
interface AirtableBase {
  id: string;
  name?: string;
  description?: string;
  tables: AirtableTable[];
}

export const airtableConfig = {
  apiKey: process.env.AIRTABLE_API_KEY,
  bases: [
    {
      id: process.env.AIRTABLE_BASE_ID || '',
      name: 'noboxLeadGen',
      description: 'Database for lead generation and management',
      tables: [
        {
          id: 'Leads',
          name: 'Leads',
          description: 'Prospect and lead contact information'
        },
        {
          id: 'Companies',
          name: 'Companies',
          description: 'Company profile information'
        },
        {
          id: 'Projects',
          name: 'Projects',
          description: 'Project details and history'
        },
        {
          id: 'EmailTemplates',
          name: 'Email Templates',
          description: 'Email templates for outreach campaigns'
        },
        {
          id: 'Campaigns',
          name: 'Campaigns',
          description: 'Marketing and outreach campaigns'
        }
      ]
    }
  ],
  // Optional: Configure caching
  cache: {
    enabled: true,
    ttl: 300 // Time to live in seconds
  },
  // Server settings for the MCP server
  server: {
    port: 3001 // Use a different port from your main application
  }
};