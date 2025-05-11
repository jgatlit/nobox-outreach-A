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
  
  // For connection status, just rely on authentication status
  let connectionStatus: 'ok' | 'failed' = authStatus === 'valid' ? 'ok' : 'failed';
  let tablesAccess: Record<string, { exists: boolean, error?: string }> = {};
  
  // Mark tables as pending validation
  log('Checking basic connection only - tables will be created as needed', 'airtable');
  if (isConfigured) {
    // Just check basic connectivity, don't verify individual tables
    tablesAccess = await testTableAccess(apiKey, usedBaseId);
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
 * Test access to expected Airtable tables - simplified version
 * This version doesn't test individual tables, just returns a placeholder status
 * @param apiKey Airtable API key
 * @param baseId Airtable base ID
 * @returns Table access results
 */
async function testTableAccess(apiKey: string, baseId: string): Promise<Record<string, { exists: boolean, error?: string, hasRecords?: boolean }>> {
  // Create a placeholder result for all expected tables
  const results: Record<string, { exists: boolean, error?: string, hasRecords?: boolean }> = {};
  
  // Test authentication first
  const auth = processAuth(apiKey);
  const authResult = await testAuth(baseId, auth);
  const isAuthValid = authResult.status === 'valid';
  
  // For all tables, mark them as pending creation rather than testing individually
  // This simplifies the permissions required for the PAT
  for (const table of EXPECTED_TABLES) {
    log(`Marking table '${table}' as pending validation`, 'airtable');
    
    if (isAuthValid) {
      results[table] = { 
        exists: false,  // We'll create them if needed later
        error: 'Table existence not checked - will be created if needed'
      };
    } else {
      results[table] = { 
        exists: false,
        error: 'Authentication failed - cannot verify table access'
      };
    }
  }
  
  return results;
}