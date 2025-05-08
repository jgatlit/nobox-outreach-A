/**
 * Airtable MCP Server
 * 
 * This file creates and starts the Airtable MCP server which acts as a middleware
 * between your application and the Airtable API.
 */

import * as AirtableMCP from 'airtable-mcp-server';
import { airtableConfig } from './config';
import { log } from '../vite';

/**
 * Starts the Airtable MCP server
 * @returns A promise that resolves with the server instance
 */
export async function startAirtableServer() {
  try {
    if (!process.env.AIRTABLE_API_KEY) {
      log('Airtable API key not found. Airtable MCP server not started.', 'airtable');
      return null;
    }

    if (!process.env.AIRTABLE_BASE_ID) {
      log('Airtable Base ID not found. Airtable MCP server not started.', 'airtable');
      return null;
    }

    // Adding enhanced diagnostics for Airtable MCP server
    log('Airtable credentials found. Activating MCP server...', 'airtable');
    
    // Log the configuration for diagnostic purposes
    log(`Airtable configuration: baseId=${airtableConfig.bases[0].id}, server port=${airtableConfig.server.port}`, 'airtable');
    log(`Airtable tables configured: ${airtableConfig.bases[0].tables.map(t => t.name).join(', ')}`, 'airtable');
    
    try {
      log('Starting Airtable MCP server...', 'airtable');
      // @ts-ignore - The typing for airtable-mcp-server is incomplete
      const server = AirtableMCP.createServer(airtableConfig);
      
      log('MCP server created, attempting to start...', 'airtable');
      
      // @ts-ignore - The typing for airtable-mcp-server is incomplete
      await server.start();
      log(`Airtable MCP server started on port ${airtableConfig.server.port}`, 'airtable');
      
      return {
        status: 'running',
        port: airtableConfig.server.port,
        server
      };
    } catch (mcpError: any) {
      log(`Error starting MCP server: ${mcpError?.message || 'Unknown error'}`, 'airtable');
      log('Falling back to direct Airtable API client', 'airtable');
      
      return { 
        status: 'fallback_to_direct_client',
        error: mcpError?.message || 'Unknown error',
        stack: mcpError?.stack
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error starting Airtable MCP server: ${errorMessage}`, 'airtable');
    return null;
  }
}