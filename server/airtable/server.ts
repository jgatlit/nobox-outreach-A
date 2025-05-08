/**
 * Airtable MCP Server
 * 
 * This file creates and starts the Airtable MCP server which acts as a middleware
 * between your application and the Airtable API.
 */

import { createServer } from 'airtable-mcp-server';
import { airtableConfig } from './config';
import { log } from '../vite';

/**
 * Starts the Airtable MCP server
 * @returns A promise that resolves with the server instance
 */
export async function startAirtableServer() {
  try {
    if (!airtableConfig.apiKey) {
      log('Airtable API key not found. Airtable MCP server not started.', 'airtable');
      return null;
    }

    if (!airtableConfig.bases[0].id) {
      log('Airtable Base ID not found. Airtable MCP server not started.', 'airtable');
      return null;
    }

    log('Starting Airtable MCP server...', 'airtable');
    const server = createServer(airtableConfig);
    
    await server.start();
    log(`Airtable MCP server started on port ${airtableConfig.server.port}`, 'airtable');
    
    return server;
  } catch (error) {
    log(`Error starting Airtable MCP server: ${error.message}`, 'airtable');
    return null;
  }
}