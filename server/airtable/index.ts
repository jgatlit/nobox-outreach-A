/**
 * Airtable Integration
 * 
 * This file exports all Airtable-related functionality.
 */

export { airtableConfig } from './config';
export { startAirtableServer } from './server';
export { 
  airtableClient,
  searchRecords,
  listRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  getAvailableTables
} from './client';

// Store the MCP server status to check later
let mcpServerStatus: any = null;

// Main utility function for checking if Airtable is properly configured
export function isAirtableConfigured(): boolean {
  return Boolean(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);
}

/**
 * Updates the MCP server status
 * @param status The current status of the MCP server
 */
export function updateMcpServerStatus(status: any) {
  mcpServerStatus = status;
}

/**
 * Get the current status of the MCP server
 * @returns The current status of the MCP server
 */
export async function getMcpServerStatus() {
  return mcpServerStatus;
}