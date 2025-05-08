/**
 * Airtable MCP Client
 * 
 * This file provides utility functions to interact with Airtable via the MCP server.
 */

import * as Airtable from 'airtable';
import { airtableConfig } from './config';
import { log } from '../vite';
import { getMcpClientAdapter } from './mcp-client';
import { getMcpServerStatus } from '.';

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

try {
  log('Initializing direct Airtable client...', 'airtable');
  
  // Check if we have the necessary API key
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    log('Airtable not configured. Add AIRTABLE_API_KEY and AIRTABLE_BASE_ID to use Airtable integration.', 'airtable');
  } else {
    // Initialize with ES module import correctly - airtableLib is a constructor function
    airtableInstance = new airtableLib({ apiKey: process.env.AIRTABLE_API_KEY });
    log('Airtable package loaded successfully', 'airtable');
    
    // Log the actual base ID we're using
    const baseId = process.env.AIRTABLE_BASE_ID;
    log(`Using Airtable Base ID: ${baseId}`, 'airtable');
    
    // Try to list all tables to validate connection
    try {
      const base = airtableInstance.base(baseId);
      // This is a hack to get the tables - we have to make a request to the API
      // and catch the response which includes table info
      log('Attempting to list available tables in the base...', 'airtable');
    } catch (innerError: any) {
      log(`Error checking base tables: ${innerError?.message || 'Unknown error'}`, 'airtable');
    }
  }
} catch (error: any) {
  log(`Error in Airtable client initialization: ${error?.message || 'Unknown error'}`, 'airtable');
}

// Initialize with either environment variable or config file value
const apiKey = process.env.AIRTABLE_API_KEY || airtableConfig.apiKey;

// Initialize the MCP client adapter if we have a base ID
if (process.env.AIRTABLE_BASE_ID) {
  try {
    mcpClientAdapter = getMcpClientAdapter(process.env.AIRTABLE_BASE_ID);
    log('MCP client adapter initialized', 'airtable');
  } catch (error: any) {
    log(`Error initializing MCP client adapter: ${error?.message || 'Unknown error'}`, 'airtable');
  }
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

// Create a compatible interface adapter with error handling and MCP server support
airtableClient = {
  query: async (baseId: string, tableName: string, options = {}) => {
    if (!apiKey) {
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
    if (!airtableInstance) {
      log('Airtable client not initialized. Creating empty response.', 'airtable');
      return [];
    }
    
    try {
      log('Using direct Airtable client for query operation', 'airtable');
      const base = airtableInstance.base(baseId);
      const records = await base(tableName).select(options).all();
      return records.map((r: any) => ({ id: r.id, fields: r.fields }));
    } catch (error: any) {
      log(`Airtable query error: ${error?.message || 'Unknown error'}`, 'airtable');
      return [];
    }
  },
  
  create: async (baseId: string, tableName: string, fields: Record<string, any>) => {
    if (!apiKey) {
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
    if (!airtableInstance) {
      log('Airtable client not initialized. Creation operation failed.', 'airtable');
      throw new Error('Airtable client not initialized');
    }
    
    log('Using direct Airtable client for create operation', 'airtable');
    const base = airtableInstance.base(baseId);
    const record = await base(tableName).create(fields);
    return { id: record.id, fields: record.fields };
  },
  
  update: async (baseId: string, tableName: string, recordId: string, fields: Record<string, any>) => {
    if (!apiKey) {
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
    if (!airtableInstance) {
      log('Airtable client not initialized. Update operation failed.', 'airtable');
      throw new Error('Airtable client not initialized');
    }
    
    log('Using direct Airtable client for update operation', 'airtable');
    const base = airtableInstance.base(baseId);
    const record = await base(tableName).update(recordId, fields);
    return { id: record.id, fields: record.fields };
  },
  
  delete: async (baseId: string, tableName: string, recordId: string) => {
    if (!apiKey) {
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
    if (!airtableInstance) {
      log('Airtable client not initialized. Delete operation failed.', 'airtable');
      throw new Error('Airtable client not initialized');
    }
    
    log('Using direct Airtable client for delete operation', 'airtable');
    const base = airtableInstance.base(baseId);
    await base(tableName).destroy(recordId);
    return { id: recordId, deleted: true };
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
    const baseId = process.env.AIRTABLE_BASE_ID;
    if (!baseId) return tableNameOrId;
    
    const base = airtableConfig.bases.find(b => b.id === baseId);
    if (!base) return tableNameOrId;
    
    const table = base.tables.find(t => 
      t.name.toLowerCase() === tableNameOrId.toLowerCase() || 
      t.id.toLowerCase() === tableNameOrId.toLowerCase()
    );
    
    return table ? table.id : tableNameOrId;
  } catch (error) {
    // If anything goes wrong, return the original value
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
    log(`Getting available tables for Airtable base ${baseId}`, 'airtable');
    
    // Find the base in our config
    const base = airtableConfig.bases.find(b => b.id === baseId);
    
    if (!base) {
      log(`Base ID ${baseId} not found in configuration`, 'airtable');
      return [];
    }
    
    // Return the table information from our config
    return base.tables.map(table => ({
      id: table.id,
      name: table.name,
      description: table.description
    }));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error getting Airtable tables: ${errorMessage}`, 'airtable');
    return [];
  }
}