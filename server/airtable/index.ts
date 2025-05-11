/**
 * Airtable Integration
 * 
 * This file exports all Airtable-related functionality and handles configuration.
 */

export { airtableConfig } from './config';
export { startAirtableServer } from './server';
export { createLeadsTable } from './schema';
export {
  createLeadsTableHandler,
  getSyncStatusHandler,
  configureAirtableHandler,
  triggerFullSyncHandler
} from './api';
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
    error: !apiKeyPresent ? 'Missing Airtable Personal Access Token (PAT)' : 
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
 * Verify that required Airtable tables exist (including the Leads table).
 * Creates tables that don't exist if possible.
 * @returns Promise resolving to verification result
 */
async function _verifyAirtableTables(): Promise<{
  success: boolean;
  tables: Record<string, { exists: boolean; error?: string }>;
  error?: string;
}> {
  try {
    // Get the API key and base ID
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = getAirtableBaseId();
    
    if (!apiKey) {
      return {
        success: false,
        tables: {},
        error: "Airtable API key not configured"
      };
    }
    
    // List of required tables
    const requiredTables = ['Conversations', 'ToolExecutions', 'Pipelines', 'Leads'];
    const results: Record<string, { exists: boolean; error?: string }> = {};
    
    // Check each table
    for (const tableName of requiredTables) {
      try {
        // Check if table exists
        const url = `https://api.airtable.com/v0/${baseId}/${tableName}?maxRecords=1`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        
        if (response.ok) {
          results[tableName] = { exists: true };
          console.log(`[airtable] Table '${tableName}' exists.`);
        } else {
          const errorText = await response.text();
          results[tableName] = { 
            exists: false, 
            error: `Table check failed: ${response.status} - ${errorText}` 
          };
          console.log(`[airtable] Table '${tableName}' does not exist or is not accessible. ${errorText}`);
        }
      } catch (error) {
        results[tableName] = { 
          exists: false, 
          error: error instanceof Error ? error.message : String(error)
        };
        console.error(`[airtable] Error checking table '${tableName}':`, error);
      }
    }
    
    // Overall success if all tables exist
    const success = Object.values(results).every(r => r.exists);
    
    return {
      success,
      tables: results,
      error: success ? undefined : "Some required tables are missing or inaccessible"
    };
  } catch (error) {
    console.error("[airtable] Error verifying tables:", error);
    return {
      success: false,
      tables: {},
      error: error instanceof Error ? error.message : String(error)
    };
  }
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
    let apiKey = process.env.AIRTABLE_API_KEY;
    
    // Analyze the API key format for diagnostics
    const apiKeyInfo = {
      type: apiKey?.startsWith('pat') ? 'PAT' : 
            apiKey?.startsWith('Bearer pat') ? 'PAT with Bearer prefix' : 'Unknown',
      value: apiKey ? (apiKey.length > 10 ? `${apiKey.substring(0, 10)}...` : apiKey) : 'Not set',
      hasPrefix: apiKey?.startsWith('Bearer ') || false
    };
    
    // Format API key for the request properly
    let formattedApiKey = apiKey || '';
    if (formattedApiKey.startsWith('pat') && !formattedApiKey.startsWith('Bearer ')) {
      formattedApiKey = `Bearer ${formattedApiKey}`;
      console.log('[airtable] Added Bearer prefix to PAT for diagnostic test');
    }
    
    const url = `https://api.airtable.com/v0/meta/bases/${CORRECT_BASE_ID}`;
    
    const metaResponse = await fetch(url, {
      headers: {
        'Authorization': formattedApiKey,
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
      tablesAccess: tablesResult,
      apiKeyInfo: apiKeyInfo
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