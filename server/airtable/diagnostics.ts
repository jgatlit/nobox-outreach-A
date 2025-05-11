/**
 * Airtable Diagnostics
 * 
 * This module provides diagnostic tools for the Airtable integration.
 */

import Airtable from 'airtable';
import { airtableConfig } from './config';
import { log } from '../vite';
import { processAuth, testAuth, AirtableAuth, getAuth } from './auth';

// Define key expected tables for the integration
const EXPECTED_TABLES = ['Conversations', 'ToolExecutions', 'Pipelines', 'Leads'];

export interface DiagnosticResult {
  success: boolean;
  diagnostics: {
    connectionStatus: 'ok' | 'failed';
    credentialInfo: {
      type: string;
      status: string;
      hasPrefix: boolean;
    };
    tables: Record<string, {
      exists: boolean;
      error?: string;
      hasRecords?: boolean;
    }>;
    config: {
      isConfigured: boolean;
      apiKeyPresent: boolean;
      baseIdPresent: boolean;
      baseIdCorrect: boolean;
      usedBaseId: string;
      error?: string;
    };
    mcpServer: {
      running: boolean;
      status: any;
    };
    apiConnection: {
      status: number;
      isSuccess: boolean;
      error?: string;
      tablesAccess?: {
        success: boolean;
        tables: Record<string, {
          exists: boolean;
          error?: string;
          hasRecords?: boolean;
        }>;
      };
    };
  };
  error?: string;
}

/**
 * Run diagnostic tests for the Airtable integration
 * @param baseId Airtable base ID to test against
 * @returns Diagnostic results
 */
export async function runDiagnostics(baseId?: string): Promise<DiagnosticResult> {
  log('Running Airtable diagnostics...', 'airtable');
  
  // Get API key from environment variable
  const apiKey = process.env.AIRTABLE_API_KEY;
  const usedBaseId = baseId || process.env.AIRTABLE_BASE_ID || airtableConfig.bases[0].id;
  
  // Check for API key and base ID
  const isConfigured = !!(apiKey && usedBaseId);
  const apiKeyPresent = !!apiKey;
  const baseIdPresent = !!usedBaseId;
  const baseIdCorrect = baseIdPresent && usedBaseId.startsWith('app');
  
  // Process authentication token to determine its type
  const auth: AirtableAuth = apiKey 
    ? processAuth(apiKey) 
    : { 
        type: 'unknown', 
        value: '', 
        hasPrefix: false, 
        status: 'untested',
        rawValue: '',
        sdkValue: ''
      };
  
  // Test authentication against Airtable API
  let authStatus = auth.status || 'untested';
  if (apiKey && baseIdPresent) {
    const testedAuth = await testAuth(usedBaseId, auth);
    authStatus = testedAuth.status || 'untested';
  }
  
  // MCP server info - not implemented yet
  const mcpServerRunning = false;
  const mcpServerStatus = null;
  
  // Test API connection status by verifying tables
  let connectionStatus: 'ok' | 'failed' = 'failed';
  let tablesAccess: Record<string, { exists: boolean, error?: string }> = {};
  
  // Test table access
  log('Testing tables...', 'airtable');
  if (isConfigured && authStatus === 'valid') {
    // Test API access to each expected table
    tablesAccess = await testTableAccess(apiKey, usedBaseId);
    
    // If at least one table is accessible, mark connection as OK
    const accessibleTables = Object.values(tablesAccess).filter(t => t.exists).length;
    if (accessibleTables > 0) {
      connectionStatus = 'ok';
    }
  }
  
  // Return diagnostic results
  return {
    success: true,
    diagnostics: {
      connectionStatus,
      tables: tablesAccess,
      config: {
        isConfigured,
        apiKeyPresent,
        baseIdPresent,
        baseIdCorrect,
        usedBaseId,
        error: !isConfigured ? 'Missing required configuration' : undefined
      },
      mcpServer: {
        running: mcpServerRunning,
        status: mcpServerStatus,
      },
      apiConnection: {
        status: authStatus === 'valid' ? 200 : 401,
        isSuccess: authStatus === 'valid',
        error: authStatus !== 'valid' ? 'Authentication failed' : undefined,
        tablesAccess: {
          success: connectionStatus === 'ok',
          tables: tablesAccess
        }
      },
      credentialInfo: {
        type: auth.type,
        status: authStatus,
        hasPrefix: auth.hasPrefix
      }
    }
  };
}

/**
 * Test access to expected Airtable tables
 * @param apiKey Airtable API key
 * @param baseId Airtable base ID
 * @returns Table access results
 */
async function testTableAccess(apiKey: string, baseId: string): Promise<Record<string, { exists: boolean, error?: string }>> {
  const results: Record<string, { exists: boolean, error?: string }> = {};
  const auth = processAuth(apiKey);
  
  // Test each expected table
  for (const table of EXPECTED_TABLES) {
    const tableId = table.toUpperCase();
    try {
      log(`Testing access to ${tableId} table...`, 'airtable');
      
      // For PAT authentication, use fetch with Authorization header
      if (auth.type === 'pat') {
        const authHeader = auth.hasPrefix ? auth.value : `Bearer ${auth.value}`;
        
        // Check if table exists
        const response = await fetch(`https://api.airtable.com/v0/${baseId}/${table}?maxRecords=1`, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          results[table] = { 
            exists: true,
            hasRecords: data?.records?.length > 0 
          };
        } else {
          const errorData = await response.json();
          log(`Table '${table}' does not exist or is not accessible. ${JSON.stringify(errorData)}`, 'airtable');
          results[table] = { 
            exists: false, 
            error: errorData?.error?.message || 'Unknown error' 
          };
        }
      } 
      // For classic API key authentication, use Airtable SDK
      else {
        const airtable = new Airtable({ apiKey });
        const base = airtable.base(baseId);
        
        try {
          // Try to select records
          const records = await base(table).select({ maxRecords: 1 }).firstPage();
          results[table] = { 
            exists: true,
            hasRecords: records.length > 0 
          };
        } catch (error) {
          log(`Error accessing table '${table}': ${error}`, 'airtable');
          results[table] = { 
            exists: false, 
            error: error instanceof Error ? error.message : String(error) 
          };
        }
      }
    } catch (error) {
      log(`Error testing table '${table}': ${error}`, 'airtable');
      results[table] = { 
        exists: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }
  
  return results;
}