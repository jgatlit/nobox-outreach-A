/**
 * Airtable Integration
 * 
 * This file exports all Airtable-related functionality and handles configuration.
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

// The correct Airtable base ID based on our investigation
const CORRECT_BASE_ID = 'appUPDttFgRrz9YiC';

// Environment configuration check result
let configCheckPerformed = false;
let configCheckResult: {
  isConfigured: boolean;
  apiKeyPresent: boolean;
  baseIdPresent: boolean;
  baseIdCorrect: boolean;
  usedBaseId: string;
  error?: string;
} | null = null;

/**
 * Check and verify the Airtable environment configuration
 * @returns Detailed configuration status
 */
export function checkAirtableConfig() {
  const apiKeyPresent = Boolean(process.env.AIRTABLE_API_KEY);
  const configuredBaseId = process.env.AIRTABLE_BASE_ID || '';
  const baseIdPresent = Boolean(configuredBaseId);
  const baseIdCorrect = configuredBaseId === CORRECT_BASE_ID;
  const usedBaseId = baseIdCorrect ? configuredBaseId : CORRECT_BASE_ID;
  
  // Set the result
  configCheckResult = {
    isConfigured: apiKeyPresent && (baseIdCorrect || !baseIdPresent),
    apiKeyPresent,
    baseIdPresent,
    baseIdCorrect,
    usedBaseId,
    error: !apiKeyPresent ? 'Missing Airtable API Key' : 
           (baseIdPresent && !baseIdCorrect ? `Incorrect Base ID: ${configuredBaseId} (should be ${CORRECT_BASE_ID})` : undefined)
  };
  
  configCheckPerformed = true;
  
  console.log('[airtable] Configuration check:', configCheckResult);
  
  // If the base ID is configured but incorrect, warn in the logs
  if (baseIdPresent && !baseIdCorrect) {
    console.warn(`[airtable] ⚠️ Warning: Configured Airtable Base ID (${configuredBaseId}) is incorrect.`);
    console.warn(`[airtable] ⚠️ Will use the correct base ID: ${CORRECT_BASE_ID}`);
  }
  
  return configCheckResult;
}

/**
 * Get the configuration check result, or perform the check if not done yet
 * @returns Detailed configuration status
 */
export function getAirtableConfigStatus() {
  if (!configCheckPerformed) {
    return checkAirtableConfig();
  }
  return configCheckResult;
}

/**
 * Main utility function for checking if Airtable is properly configured
 * This function will use the correct base ID if available, even if env variable is incorrect
 * @returns Boolean indicating if Airtable is configured correctly
 */
export function isAirtableConfigured(): boolean {
  const config = getAirtableConfigStatus();
  return config ? config.isConfigured : false;
}

/**
 * Get the correct Airtable base ID to use for all operations
 * This will always return the correct ID regardless of what's in environment variables
 * @returns The correct Airtable base ID
 */
export function getAirtableBaseId(): string {
  return CORRECT_BASE_ID;
}

/**
 * Check if the MCP server is running
 * @returns Boolean indicating if the MCP server is running
 */
export function isMcpServerRunning(): boolean {
  return mcpServerStatus !== null && mcpServerStatus.running === true;
}

/**
 * Updates the MCP server status
 * @param status The current status of the MCP server
 */
export function updateMcpServerStatus(status: any) {
  mcpServerStatus = status;
  console.log('[airtable] MCP server status updated:', 
    status?.running ? 'Running' : 'Not running',
    status?.port ? `on port ${status.port}` : ''
  );
}

/**
 * Get the current status of the MCP server
 * @returns The current status of the MCP server
 */
export async function getMcpServerStatus() {
  return mcpServerStatus;
}

/**
 * Perform a full diagnostic of the Airtable integration
 * @returns Detailed diagnostic information
 */
export async function diagnoseAirtableIntegration() {
  const configStatus = getAirtableConfigStatus();
  
  // Get the MCP server status
  const mcpStatus = await getMcpServerStatus();
  
  // Attempt a basic API connection test using fetch instead of the Airtable library
  let apiConnectionResult = null;
  try {
    // Test the base metadata API
    const apiKey = process.env.AIRTABLE_API_KEY;
    const url = `https://api.airtable.com/v0/meta/bases/${CORRECT_BASE_ID}`;
    
    const metaResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const status = metaResponse.status;
    const isSuccess = metaResponse.ok;
    
    let data = null;
    let errorText = null;
    
    try {
      if (isSuccess) {
        data = await metaResponse.json();
      } else {
        errorText = await metaResponse.text();
      }
    } catch (e) {
      errorText = e instanceof Error ? e.message : String(e);
    }
    
    // Also test the tables access with direct API call
    const tablesResult = await testTableAccess(apiKey, CORRECT_BASE_ID);
    
    apiConnectionResult = {
      status,
      isSuccess,
      data,
      error: errorText,
      tablesAccess: tablesResult
    };
  } catch (error) {
    apiConnectionResult = {
      status: 0,
      isSuccess: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
      tablesAccess: { success: false, error: error instanceof Error ? error.message : String(error) }
    };
  }
  
  return {
    config: configStatus,
    mcpServer: {
      running: Boolean(mcpStatus?.running),
      status: mcpStatus
    },
    apiConnection: apiConnectionResult
  };
}

/**
 * Tests access to key tables in the Airtable base to verify correct permissions
 * @param apiKey The Airtable API key
 * @param baseId The Airtable base ID
 * @returns Result of the table access test
 */
async function testTableAccess(apiKey: string | undefined, baseId: string) {
  // The tables we want to test
  const tablesToTest = ['Conversations', 'ToolExecutions', 'Pipelines'];
  const results: Record<string, any> = {};
  
  if (!apiKey) {
    return {
      success: false,
      error: "API key is missing",
      tables: {}
    };
  }
  
  try {
    // Test each table
    for (const tableName of tablesToTest) {
      try {
        console.log(`[airtable] Testing access to ${tableName} table...`);
        
        const tableUrl = `https://api.airtable.com/v0/${baseId}/${tableName}?maxRecords=1`;
        const response = await fetch(tableUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        
        const status = response.status;
        const isSuccess = response.ok;
        
        let responseData = null;
        let errorText = null;
        
        try {
          if (isSuccess) {
            responseData = await response.json();
          } else {
            errorText = await response.text();
          }
        } catch (e) {
          errorText = e instanceof Error ? e.message : String(e);
        }
        
        results[tableName] = {
          status,
          success: isSuccess,
          error: errorText,
          hasRecords: isSuccess && responseData?.records?.length > 0
        };
        
        if (isSuccess) {
          console.log(`[airtable] Successfully accessed ${tableName} table.`);
        } else {
          console.log(`[airtable] Failed to access ${tableName} table. Status: ${status}, Error: ${errorText}`);
        }
      } catch (tableError) {
        console.error(`[airtable] Error testing ${tableName} table:`, tableError);
        results[tableName] = {
          status: 0,
          success: false,
          error: tableError instanceof Error ? tableError.message : String(tableError)
        };
      }
    }
    
    return {
      success: Object.values(results).some((r: any) => r.success),
      tables: results
    };
  } catch (error) {
    console.error("[airtable] Error testing table access:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      tables: results
    };
  }
}