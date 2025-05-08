/**
 * Airtable MCP Server
 * 
 * This file creates and starts the Airtable MCP server which acts as a middleware
 * between your application and the Airtable API.
 */

// Using dynamic import for ESM modules
import { airtableConfig } from './config';
import { log } from '../vite';
import { updateMcpServerStatus } from '.';

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
      
      // Dynamically import the ESM module
      const AirtableMCP = await import('airtable-mcp-server');
      
      // Check available exports
      log(`Airtable MCP exports: ${Object.keys(AirtableMCP).join(', ')}`, 'airtable');
      
      // If createServer doesn't exist directly, look for it in default export
      let server;
      if (typeof AirtableMCP.createServer === 'function') {
        server = AirtableMCP.createServer(airtableConfig);
      } else if (AirtableMCP.default && typeof AirtableMCP.default.createServer === 'function') {
        server = AirtableMCP.default.createServer(airtableConfig);
      } else {
        throw new Error('Could not find createServer function in airtable-mcp-server module');
      }
      
      log('MCP server created, attempting to start...', 'airtable');
      
      // Start the server
      await server.start();
      log(`Airtable MCP server started on port ${airtableConfig.server.port}`, 'airtable');
      
      const serverStatus = {
        status: 'running',
        port: airtableConfig.server.port,
        server,
        startTime: new Date().toISOString()
      };
      
      // Update status tracker
      updateMcpServerStatus(serverStatus);
      
      return serverStatus;
    } catch (mcpError: any) {
      log(`Error starting MCP server: ${mcpError?.message || 'Unknown error'}`, 'airtable');
      log('Falling back to direct Airtable API client', 'airtable');
      
      const fallbackStatus = { 
        status: 'fallback_to_direct_client',
        error: mcpError?.message || 'Unknown error',
        stack: mcpError?.stack,
        fallbackTime: new Date().toISOString()
      };
      
      // Update status tracker
      updateMcpServerStatus(fallbackStatus);
      
      return fallbackStatus;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error starting Airtable MCP server: ${errorMessage}`, 'airtable');
    return null;
  }
}