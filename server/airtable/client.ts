/**
 * Airtable MCP Client
 * 
 * This file provides utility functions to interact with Airtable via the MCP server.
 * It handles authentication and provides fallback mechanisms when the MCP server is unavailable.
 */

import * as Airtable from 'airtable';
import { airtableConfig } from './config';
import { log } from '../vite';
import { getMcpClientAdapter } from './mcp-client';
import { getMcpServerStatus } from '.';
import { AirtableAuth, processAuth, testAuth, getAuth, formatApiKeyForRequest } from './auth';

// Define client interface since type definitions are incomplete
interface AirtableMCPClient {
  query: (baseId: string, tableName: string, options?: any) => Promise<any[]>;
  create: (baseId: string, tableName: string, fields: Record<string, any>) => Promise<any>;
  update: (baseId: string, tableName: string, recordId: string, fields: Record<string, any>) => Promise<any>;
  delete: (baseId: string, tableName: string, recordId: string) => Promise<any>;
}

// Create a client for TypeScript until we have proper types
export let airtableClient: AirtableMCPClient;

// Import Airtable
import airtableLib from 'airtable';

// Initialize the client directly with Airtable API
// Will use MCP server when available with fallback to direct client
let airtableInstance: any = null;
let mcpClientAdapter: any = null;
let authInfo: AirtableAuth = getAuth();

/**
 * Initialize the Airtable client with proper authentication
 */
export async function initializeAirtableClient() {
  try {
    log('Initializing Airtable client...', 'airtable');
    
    // Get authentication credentials
    authInfo = getAuth();
    
    if (!authInfo.rawValue) {
      log('Airtable not configured. Add an Airtable Personal Access Token (PAT) as AIRTABLE_API_KEY to use Airtable integration.', 'airtable');
      return false;
    }
    
    // Log information about the authentication type
    if (authInfo.type === 'pat') {
      log('Using Personal Access Token (PAT) for Airtable authentication', 'airtable');
      if (authInfo.hasPrefix) {
        log('PAT includes Bearer prefix', 'airtable');
      } else {
        log('PAT does not include Bearer prefix, it will be added for API calls', 'airtable');
      }
    } else {
      log('Unknown authentication type. Please check your AIRTABLE_API_KEY format - should start with "pat"', 'airtable');
    }
    
    // Initialize with Airtable package
    try {
      airtableInstance = new airtableLib({ apiKey: authInfo.sdkValue });
      log('Airtable package initialized successfully', 'airtable');
      
      // Test the authentication if we have a base ID
      const baseId = process.env.AIRTABLE_BASE_ID || airtableConfig.bases[0]?.id;
      if (baseId) {
        authInfo = await testAuth(baseId, authInfo);
        if (authInfo.status === 'valid') {
          log('Airtable authentication verified successfully', 'airtable');
          return true;
        } else {
          log('Airtable authentication failed verification', 'airtable');
          return false;
        }
      }
    } catch (sdkError: any) {
      log(`Error initializing Airtable SDK: ${sdkError?.message || 'Unknown error'}`, 'airtable');
      return false;
    }
    
    return true;
  } catch (error: any) {
    log(`Error in Airtable client initialization: ${error?.message || 'Unknown error'}`, 'airtable');
    return false;
  }
}

// Initialize the client when this module is loaded
initializeAirtableClient().then(success => {
  if (success) {
    log('Airtable client initialization completed successfully', 'airtable');
  } else {
    log('Airtable client initialization failed or incomplete', 'airtable');
  }
});

// Initialize the MCP client adapter with the correct base ID
try {
  // Use the base ID from environment or config
  const baseId = process.env.AIRTABLE_BASE_ID || airtableConfig.bases[0]?.id;
  if (baseId) {
    mcpClientAdapter = getMcpClientAdapter(baseId);
    log(`MCP client adapter initialized with baseId: ${baseId}`, 'airtable');
  } else {
    log('No Airtable base ID available for MCP client adapter', 'airtable');
  }
} catch (error: any) {
  log(`Error initializing MCP client adapter: ${error?.message || 'Unknown error'}`, 'airtable');
}

// Check if the MCP server is running
async function isMcpServerRunning(): Promise<boolean> {
  try {
    const serverStatus = await getMcpServerStatus();
    return Boolean(serverStatus && serverStatus.status === 'running');
  } catch (error) {
    return false;
  }
}

/**
 * Ensures that we have a valid Airtable client instance
 * If not, attempts to initialize it on-demand
 * @returns True if client is available, false otherwise
 */
async function ensureAirtableClient(): Promise<boolean> {
  if (airtableInstance) {
    return true;
  }
  
  // Try to initialize the client on-demand
  log('Attempting to initialize Airtable client on-demand', 'airtable');
  
  // Get fresh authentication info
  authInfo = getAuth();
  
  if (!authInfo.rawValue) {
    log('Airtable API key not available. Check environment variables.', 'airtable');
    return false;
  }
  
  try {
    airtableInstance = new airtableLib({ apiKey: authInfo.sdkValue });
    log('Airtable client initialized successfully on-demand', 'airtable');
    return true;
  } catch (error) {
    log(`Failed to initialize Airtable client: ${error}`, 'airtable');
    return false;
  }
}

// Create a compatible interface adapter with error handling and MCP server support
airtableClient = {
  query: async (baseId: string, tableName: string, options = {}) => {
    // Refresh auth info on each call to pick up environment variable changes
    authInfo = getAuth();
    
    // Verify we have authentication info
    if (!authInfo.rawValue) {
      log('Airtable API key not configured. Check your environment variables.', 'airtable');
      throw new Error('Airtable API key not configured');
    }
    
    // Try to use MCP server if available
    const mcpRunning = await isMcpServerRunning();
    if (mcpRunning && mcpClientAdapter && mcpClientAdapter.isAvailable()) {
      try {
        log('Using MCP server for query operation', 'airtable');
        return await mcpClientAdapter.query(baseId, tableName, options);
      } catch (mcpError: any) {
        log(`MCP query failed, falling back to direct client: ${mcpError?.message || 'Unknown error'}`, 'airtable');
        // Fall through to direct client if MCP fails
      }
    }

    // Fall back to direct client
    if (!await ensureAirtableClient()) {
      log('Failed to initialize Airtable client for query operation', 'airtable');
      return [];
    }
    
    try {
      log('Using direct Airtable client for query operation', 'airtable');
      const base = airtableInstance.base(baseId);
      const records = await base(tableName).select(options).all();
      log(`Retrieved ${records.length} records from ${tableName}`, 'airtable');
      return records.map((r: any) => ({ id: r.id, fields: r.fields }));
    } catch (error: any) {
      log(`Airtable query error: ${error?.message || 'Unknown error'}`, 'airtable');
      return [];
    }
  },
  
  create: async (baseId: string, tableName: string, fields: Record<string, any>) => {
    // Refresh auth info on each call to pick up environment variable changes
    authInfo = getAuth();
    
    // Verify we have authentication info
    if (!authInfo.rawValue) {
      log('Airtable API key not configured. Check your environment variables.', 'airtable');
      throw new Error('Airtable API key not configured');
    }
    
    // Try to use MCP server if available
    const mcpRunning = await isMcpServerRunning();
    if (mcpRunning && mcpClientAdapter && mcpClientAdapter.isAvailable()) {
      try {
        log('Using MCP server for create operation', 'airtable');
        return await mcpClientAdapter.create(baseId, tableName, fields);
      } catch (mcpError: any) {
        log(`MCP create failed, falling back to direct client: ${mcpError?.message || 'Unknown error'}`, 'airtable');
        // Fall through to direct client if MCP fails
      }
    }
    
    // Fall back to direct client
    if (!await ensureAirtableClient()) {
      log('Failed to initialize Airtable client for create operation', 'airtable');
      throw new Error('Failed to initialize Airtable client');
    }
    
    try {
      log('Using direct Airtable client for create operation', 'airtable');
      const base = airtableInstance.base(baseId);
      const record = await base(tableName).create(fields);
      return { id: record.id, fields: record.fields };
    } catch (error: any) {
      log(`Error creating record in Airtable: ${error?.message || 'Unknown error'}`, 'airtable');
      throw error;
    }
  },
  
  update: async (baseId: string, tableName: string, recordId: string, fields: Record<string, any>) => {
    // Refresh auth info on each call to pick up environment variable changes
    authInfo = getAuth();
    
    // Verify we have authentication info
    if (!authInfo.rawValue) {
      log('Airtable API key not configured. Check your environment variables.', 'airtable');
      throw new Error('Airtable API key not configured');
    }
    
    // Try to use MCP server if available
    const mcpRunning = await isMcpServerRunning();
    if (mcpRunning && mcpClientAdapter && mcpClientAdapter.isAvailable()) {
      try {
        log('Using MCP server for update operation', 'airtable');
        return await mcpClientAdapter.update(baseId, tableName, recordId, fields);
      } catch (mcpError: any) {
        log(`MCP update failed, falling back to direct client: ${mcpError?.message || 'Unknown error'}`, 'airtable');
        // Fall through to direct client if MCP fails
      }
    }
    
    // Fall back to direct client
    if (!await ensureAirtableClient()) {
      log('Failed to initialize Airtable client for update operation', 'airtable');
      throw new Error('Failed to initialize Airtable client');
    }
    
    try {
      log('Using direct Airtable client for update operation', 'airtable');
      const base = airtableInstance.base(baseId);
      const record = await base(tableName).update(recordId, fields);
      return { id: record.id, fields: record.fields };
    } catch (error: any) {
      log(`Error updating record in Airtable: ${error?.message || 'Unknown error'}`, 'airtable');
      throw error;
    }
  },
  
  delete: async (baseId: string, tableName: string, recordId: string) => {
    // Verify we have authentication info
    if (!authInfo.rawValue) {
      log('Airtable API key not configured. Check your environment variables.', 'airtable');
      throw new Error('Airtable API key not configured');
    }
    
    // Try to use MCP server if available
    const mcpRunning = await isMcpServerRunning();
    if (mcpRunning && mcpClientAdapter && mcpClientAdapter.isAvailable()) {
      try {
        log('Using MCP server for delete operation', 'airtable');
        return await mcpClientAdapter.delete(baseId, tableName, recordId);
      } catch (mcpError: any) {
        log(`MCP delete failed, falling back to direct client: ${mcpError?.message || 'Unknown error'}`, 'airtable');
        // Fall through to direct client if MCP fails
      }
    }
    
    // Fall back to direct client
    if (!await ensureAirtableClient()) {
      log('Failed to initialize Airtable client for delete operation', 'airtable');
      throw new Error('Failed to initialize Airtable client');
    }
    
    try {
      log('Using direct Airtable client for delete operation', 'airtable');
      const base = airtableInstance.base(baseId);
      await base(tableName).destroy(recordId);
      return { id: recordId, deleted: true };
    } catch (error: any) {
      log(`Error deleting record from Airtable: ${error?.message || 'Unknown error'}`, 'airtable');
      throw error;
    }
  }
};

/**
 * Searches for records in an Airtable table
 * @param baseId The Airtable base ID
 * @param tableName The name of the table to search
 * @param query The search query formula
 * @returns Promise that resolves with the search results
 */
export async function searchRecords(baseId: string, tableName: string, query: string) {
  try {
    const tableId = getTableId(tableName);
    log(`Searching Airtable table ${tableId} with query: ${query}`, 'airtable');
    const results = await airtableClient.query(baseId, tableId, {
      filterByFormula: query
    });
    log(`Found ${results.length} records in ${tableId}`, 'airtable');
    return results;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error searching Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Gets the actual table ID from the table name or ID
 * @param tableNameOrId The name or ID of the table
 * @returns The table ID
 */
function getTableId(tableNameOrId: string): string {
  // If this is already an ID format (e.g., tblXXXXXXXXXXXX), return as is
  if (tableNameOrId.startsWith('tbl')) {
    return tableNameOrId;
  }
  
  // Otherwise, look up the ID from our config
  try {
    // Always use the correct base ID from our config
    const base = airtableConfig.bases[0];
    
    // For the "Pipelines" table, use the discovered table ID
    if (tableNameOrId.toLowerCase() === 'pipelines') {
      return 'tbleLCTwQcmeJxmS9'; // This is the actual ID we discovered from the API
    }
    
    // For other tables, look them up in our config
    const table = base.tables.find(t => 
      t.name.toLowerCase() === tableNameOrId.toLowerCase() || 
      t.id.toLowerCase() === tableNameOrId.toLowerCase()
    );
    
    if (table) {
      log(`Found table '${tableNameOrId}' in configuration`, 'airtable');
      return table.id;
    } else {
      log(`Table '${tableNameOrId}' not found in configuration, using as-is`, 'airtable');
      return tableNameOrId;
    }
  } catch (error) {
    // If anything goes wrong, return the original value
    log(`Error in getTableId: ${error}`, 'airtable');
    return tableNameOrId;
  }
}

/**
 * Lists all records from an Airtable table
 * @param baseId The Airtable base ID
 * @param tableName The name of the table to list
 * @param options Optional parameters for the query
 * @returns Promise that resolves with the records
 */
export async function listRecords(
  baseId: string, 
  tableName: string, 
  options: { 
    sort?: Array<{field: string, direction: 'asc' | 'desc'}>,
    maxRecords?: number, 
    view?: string
  } = {}
) {
  try {
    const tableId = getTableId(tableName);
    log(`Listing records from Airtable table ${tableId}`, 'airtable');
    const results = await airtableClient.query(baseId, tableId, options);
    log(`Retrieved ${results.length} records from ${tableId}`, 'airtable');
    return results;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error listing records from Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Creates a new record in an Airtable table
 * @param baseId The Airtable base ID
 * @param tableName The name of the table where the record will be created
 * @param fields The record data
 * @returns Promise that resolves with the created record
 */
export async function createRecord(baseId: string, tableName: string, fields: Record<string, any>) {
  try {
    const tableId = getTableId(tableName);
    log(`Creating record in Airtable table ${tableId}`, 'airtable');
    const result = await airtableClient.create(baseId, tableId, fields);
    log(`Record created successfully in ${tableId}`, 'airtable');
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error creating record in Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Updates an existing record in an Airtable table
 * @param baseId The Airtable base ID
 * @param tableName The name of the table containing the record
 * @param recordId The ID of the record to update
 * @param fields The updated record data
 * @returns Promise that resolves with the updated record
 */
export async function updateRecord(
  baseId: string, 
  tableName: string, 
  recordId: string, 
  fields: Record<string, any>
) {
  try {
    const tableId = getTableId(tableName);
    log(`Updating record ${recordId} in Airtable table ${tableId}`, 'airtable');
    const result = await airtableClient.update(baseId, tableId, recordId, fields);
    log(`Record ${recordId} updated successfully in ${tableId}`, 'airtable');
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error updating record in Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Deletes a record from an Airtable table
 * @param baseId The Airtable base ID
 * @param tableName The name of the table containing the record
 * @param recordId The ID of the record to delete
 * @returns Promise that resolves when the record is deleted
 */
export async function deleteRecord(baseId: string, tableName: string, recordId: string) {
  try {
    const tableId = getTableId(tableName);
    log(`Deleting record ${recordId} from Airtable table ${tableId}`, 'airtable');
    const result = await airtableClient.delete(baseId, tableId, recordId);
    log(`Record ${recordId} deleted successfully from ${tableId}`, 'airtable');
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error deleting record from Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Get available tables in the Airtable base
 * @param baseId The Airtable base ID
 * @returns Promise that resolves with the table information
 */
export async function getAvailableTables(baseId: string) {
  try {
    // Always use the correct base ID from config
    const correctBaseId = airtableConfig.bases[0].id;
    log(`Getting available tables for Airtable base ${correctBaseId}`, 'airtable');
    
    // Method 1: Check if tables from our schema are accessible
    const discoveredTables: Array<{id: string, name: string, status: 'available' | 'error', error?: string}> = [];
    
    if (!airtableInstance) {
      throw new Error('Airtable client not initialized');
    }
    
    // Get the base using the correct ID
    const base = airtableInstance.base(correctBaseId);
    
    // Add the Pipelines table which we know exists
    discoveredTables.push({
      id: 'tbleLCTwQcmeJxmS9',
      name: 'Pipelines',
      status: 'available'
    });
    
    // Try to check if we can access the Pipelines table
    try {
      log('Checking if Pipelines table is accessible...', 'airtable');
      const pipelinesRecords = await base('Pipelines').select({ maxRecords: 1 }).firstPage();
      log(`Successfully accessed Pipelines table with ${pipelinesRecords.length} records`, 'airtable');
    } catch (pipelineError) {
      log(`Error accessing Pipelines table: ${pipelineError}`, 'airtable');
      
      // Update the status to error
      const pipelinesTable = discoveredTables.find(t => t.name === 'Pipelines');
      if (pipelinesTable) {
        pipelinesTable.status = 'error';
        pipelinesTable.error = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
      }
    }
    
    // Attempt to create our needed tables
    const allTableNames = ['Conversations', 'ToolExecutions'];
    
    for (const tableName of allTableNames) {
      try {
        // Try to query the table to see if it exists
        log(`Checking if table '${tableName}' exists...`, 'airtable');
        const records = await base(tableName).select({ maxRecords: 1 }).firstPage();
        
        log(`Table '${tableName}' exists and has ${records.length} records`, 'airtable');
        discoveredTables.push({
          id: tableName,
          name: tableName,
          status: 'available'
        });
      } catch (tableError) {
        const errorMessage = tableError instanceof Error ? tableError.message : String(tableError);
        log(`Error accessing table '${tableName}': ${errorMessage}`, 'airtable');
        
        discoveredTables.push({
          id: tableName,
          name: tableName,
          status: 'error',
          error: errorMessage
        });
      }
    }
    
    // Method 2: Use the Airtable metadata API to list all tables
    try {
      // Direct API call to the metadata endpoint
      log('Fetching tables via Airtable metadata API...', 'airtable');
      
      // Using fetch to make a direct API call with the correct base ID
      const response = await fetch(`https://api.airtable.com/v0/meta/bases/${correctBaseId}/tables`, {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        log('Metadata API response: ' + JSON.stringify(data).substring(0, 200) + '...', 'airtable');
        
        if (data && data.tables && Array.isArray(data.tables)) {
          log(`Retrieved ${data.tables.length} tables from metadata API`, 'airtable');
          
          // Add any tables that weren't already discovered
          for (const table of data.tables) {
            if (!discoveredTables.some(t => t.name === table.name)) {
              log(`Found additional table from metadata API: ${table.name} (${table.id})`, 'airtable');
              discoveredTables.push({
                id: table.id || table.name,
                name: table.name,
                status: 'available'
              });
            }
          }
        }
      } else {
        const errorText = await response.text();
        log(`Metadata API request failed with status ${response.status}: ${errorText}`, 'airtable');
      }
    } catch (error) {
      log(`Error using metadata API: ${error}`, 'airtable');
      // Continue with what we've got so far
    }
    
    // Return all discovered tables
    return discoveredTables;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error getting Airtable tables: ${errorMessage}`, 'airtable');
    return [];
  }
}