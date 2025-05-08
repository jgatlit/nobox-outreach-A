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

// Use the correct base ID we discovered
const CORRECT_BASE_ID = 'appUPDttFgRrz9YiC';

export const airtableConfig = {
  apiKey: process.env.AIRTABLE_API_KEY,
  // Use the correct base ID we discovered through the Airtable API
  bases: [
    {
      // Override the base ID from environment variable if it doesn't seem correct
      id: (process.env.AIRTABLE_BASE_ID && process.env.AIRTABLE_BASE_ID.startsWith('app')) 
        ? process.env.AIRTABLE_BASE_ID 
        : CORRECT_BASE_ID,
      name: 'Proposal Automation System',
      description: 'Database for proposal automation and AI conversations',
      tables: [
        {
          id: 'Conversations',
          name: 'Conversations',
          description: 'AI conversation history and metadata'
        },
        {
          id: 'ToolExecutions',
          name: 'ToolExecutions',
          description: 'Records of tool usage during AI conversations'
        },
        {
          id: 'Pipelines',
          name: 'Pipelines',
          description: 'Sales pipeline data'
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