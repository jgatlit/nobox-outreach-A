/**
 * This file defines the Airtable schema for our tables.
 * It helps with type safety when interacting with Airtable.
 */

export interface AirtableRecord<T> {
  id: string;
  fields: T;
  createdTime: string;
}

// Conversations table schema
export interface ConversationFields {
  Name: string;
  Lead?: string[];  // Reference to Lead in Airtable
  LeadEmail?: string;
  Content: string;
  Type: string;
  Date: string;
  Status?: string;
  Notes?: string;
}

// ToolExecutions table schema
export interface ToolExecutionFields {
  Name: string;
  Tool: string;
  Parameters?: string;
  Result?: string;
  Status: string;
  ExecutedAt: string;
  ExecutedBy?: string;
}

// Pipelines table schema
export interface PipelineFields {
  Name: string;
  Lead?: string[];  // Reference to Lead in Airtable
  LeadEmail?: string;
  Stage: string;
  Value?: number;
  ExpectedCloseDate?: string;
  AssignedTo?: string;
  LastActivity?: string;
  Notes?: string;
}

// Leads table schema - mirrors PostgreSQL leads table
export interface LeadFields {
  id: number;                   // PostgreSQL ID
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  title?: string;
  status?: string;
  source?: string;
  priority?: string;
  lastActivityDate?: string;
  website?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;      // For tracking sync status
  syncSource?: string;        // "postgresql" or "airtable"
}

// Table names as constants for consistency
export const TABLES = {
  CONVERSATIONS: 'Conversations',
  TOOL_EXECUTIONS: 'ToolExecutions',
  PIPELINES: 'Pipelines',
  LEADS: 'Leads',
};

/**
 * Verify that required Airtable tables exist (including the Leads table).
 * This function is called by the MCP server during startup.
 * @param baseId The Airtable Base ID to verify
 * @returns Promise resolving to verification result
 */
export async function verifyAirtableTables(baseId: string): Promise<{
  success: boolean;
  tables: Record<string, { exists: boolean; error?: string }>;
  error?: string;
}> {
  try {
    // Get the API key
    const apiKey = process.env.AIRTABLE_API_KEY;
    
    if (!apiKey) {
      return {
        success: false,
        tables: {},
        error: "Airtable API key not configured"
      };
    }
    
    if (!baseId) {
      return {
        success: false,
        tables: {},
        error: "Airtable Base ID not provided"
      };
    }
    
    // List of required tables
    const requiredTables = Object.values(TABLES);
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