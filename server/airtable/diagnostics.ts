/**
 * Airtable Diagnostics
 * 
 * This module provides diagnostic tools for the Airtable integration.
 */

import { log } from '../vite';
import { AirtableAuth, getAuth, testAuth } from './auth';
import { TABLES } from './schema';

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
    }>;
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
  
  try {
    // Get authentication info
    const auth = getAuth();
    
    // Check if we have a baseId
    if (!baseId) {
      baseId = process.env.AIRTABLE_BASE_ID;
      
      if (!baseId) {
        return {
          success: false,
          diagnostics: {
            connectionStatus: 'failed',
            credentialInfo: {
              type: auth.type,
              status: auth.status,
              hasPrefix: auth.hasPrefix
            },
            tables: {}
          },
          error: 'No Airtable Base ID provided'
        };
      }
    }
    
    // Test the authentication
    const testedAuth = await testAuth(baseId, auth);
    
    // Check the tables
    const tableResults: Record<string, { exists: boolean; error?: string }> = {};
    
    log(`Testing tables...`, 'airtable');
    
    // Test each table access
    for (const tableName of Object.keys(TABLES)) {
      try {
        log(`Testing access to ${tableName} table...`, 'airtable');
        const url = `https://api.airtable.com/v0/${baseId}/${tableName}?maxRecords=1`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': testedAuth.headerValue
          }
        });
        
        if (response.ok) {
          tableResults[tableName] = { exists: true };
          log(`Table '${tableName}' exists and is accessible.`, 'airtable');
        } else {
          const errorData = await response.json();
          tableResults[tableName] = { 
            exists: false,
            error: JSON.stringify(errorData)
          };
          log(`Table '${tableName}' does not exist or is not accessible. ${JSON.stringify(errorData)}`, 'airtable');
        }
      } catch (error) {
        tableResults[tableName] = { 
          exists: false,
          error: error instanceof Error ? error.message : String(error)
        };
        log(`Error testing table '${tableName}': ${error}`, 'airtable');
      }
    }
    
    return {
      success: true,
      diagnostics: {
        connectionStatus: testedAuth.status === 'valid' ? 'ok' : 'failed',
        credentialInfo: {
          type: testedAuth.type,
          status: testedAuth.status,
          hasPrefix: testedAuth.hasPrefix
        },
        tables: tableResults
      }
    };
  } catch (error) {
    log(`Error running Airtable diagnostics: ${error}`, 'airtable');
    return {
      success: false,
      diagnostics: {
        connectionStatus: 'failed',
        credentialInfo: {
          type: 'unknown',
          status: 'invalid',
          hasPrefix: false
        },
        tables: {}
      },
      error: error instanceof Error ? error.message : String(error)
    };
  }
}