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

// New exports for conversations and tool executions
export {
  createConversation,
  getUserConversations,
  getConversation,
  updateConversation,
  addMessageToConversation,
  softDeleteConversation,
  hardDeleteConversation
} from './conversations';

export {
  createToolExecution,
  getConversationToolExecutions,
  getToolExecution,
  updateToolExecution,
  completeToolExecution,
  deleteToolExecution,
  getToolExecutionsByName
} from './toolExecutions';

// Store the MCP server status to check later
let mcpServerStatus: any = null;

// Main utility function for checking if Airtable is properly configured
export function isAirtableConfigured(): boolean {
  // We only need to check for API key since we're hardcoding the correct base ID
  return Boolean(process.env.AIRTABLE_API_KEY);
}

// Get the correct Airtable base ID - always use our discovered ID
export function getAirtableBaseId(): string {
  // Always return the correct base ID we discovered
  return 'appUPDttFgRrz9YiC';
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