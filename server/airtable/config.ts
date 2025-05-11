/**
 * Airtable MCP Server Configuration
 * 
 * This file contains the configuration for connecting to Airtable via the MCP server.
 * It uses environment variables for sensitive information like API keys.
 */

export const airtableConfig = {
  apiKey: process.env.AIRTABLE_API_KEY,
  bases: [
    {
      id: process.env.AIRTABLE_BASE_ID || '',
      tables: [
        // Add your table names here
        // Example: 'Leads', 'Companies', 'Projects'
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