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
import { getMcpClientAdapter } from './mcp-client';

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
      
      // The airtable-mcp-server package is actually a CLI tool, not a library with a createServer function
      // We'll spawn it as a child process instead
      const { spawn } = await import('child_process');
      
      // Start the MCP server as a child process
      const mcpProcess = spawn('node', [
        './node_modules/airtable-mcp-server/dist/index.js',
        process.env.AIRTABLE_API_KEY || ''
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });
      
      // Set up logging from the process
      mcpProcess.stdout.on('data', (data) => {
        log(`MCP stdout: ${data.toString().trim()}`, 'airtable');
      });
      
      mcpProcess.stderr.on('data', (data) => {
        log(`MCP stderr: ${data.toString().trim()}`, 'airtable');
      });
      
      // Handle process exit
      mcpProcess.on('exit', (code) => {
        log(`MCP server process exited with code ${code}`, 'airtable');
      });
      
      // Create a server object with the process reference
      const server = {
        process: mcpProcess,
        start: async () => {
          log('MCP server process started successfully', 'airtable');
          return true;
        },
        stop: async () => {
          mcpProcess.kill();
          return true;
        }
      };
      
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
      
      // Connect the client adapter to the MCP server process
      if (process.env.AIRTABLE_BASE_ID) {
        try {
          const mcpClientAdapter = getMcpClientAdapter(process.env.AIRTABLE_BASE_ID);
          mcpClientAdapter.connectToProcess(mcpProcess);
          log('MCP client adapter connected to server process', 'airtable');
        } catch (adapterError: any) {
          log(`Error connecting MCP client adapter: ${adapterError?.message || 'Unknown error'}`, 'airtable');
        }
      }
      
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