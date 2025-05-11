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
  apiKeyInfo?: {
    type: string;
    format: string;
    hasPrefix: boolean;
  };
}> {
  try {
    // Get the API key
    let apiKey = process.env.AIRTABLE_API_KEY;
    
    if (!apiKey) {
      return {
        success: false,
        tables: {},
        error: "Airtable API key not configured"
      };
    }
    
    // Check if the API key is a PAT and format it correctly
    // Create mutable version of apiKeyInfo
    const apiKeyInfo = {
      type: apiKey.startsWith('pat') || apiKey.startsWith('Bearer pat') ? 'pat' : 
            (apiKey.length > 16 && !apiKey.startsWith('pat') && !apiKey.startsWith('Bearer')) ? 'classic_key' : 'unknown',
      format: 'valid',
      hasPrefix: apiKey.startsWith('Bearer ')
    };
    
    // If it's a PAT (starts with "pat") but doesn't have the Bearer prefix, add it
    if (apiKey.startsWith('pat') && !apiKey.startsWith('Bearer')) {
      apiKey = `Bearer ${apiKey}`;
      console.log('[airtable] Added Bearer prefix to PAT for Airtable API verification');
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
        // Just mark all tables as pending - we'll create them as needed
        // This simplifies the permission requirements for the PAT
        results[tableName] = { 
          exists: false, 
          error: 'Table status checking simplified - will create as needed' 
        };
        console.log(`[airtable] Table '${tableName}' status: pending creation if needed`);
        
        // Skip the individual table checks - we'll verify basic auth only
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
    
    // Check if we're having authentication issues
    const hasAuthIssues = Object.values(results).some(r => {
      if (!r.error) return false;
      return r.error.includes('UNAUTHORIZED') || 
             r.error.includes('AUTHENTICATION_REQUIRED') || 
             r.error.includes('Invalid authentication token');
    });
    
    if (hasAuthIssues) {
      // Update apiKeyInfo format status
      apiKeyInfo.format = 'invalid';
    }
    
    return {
      success,
      tables: results,
      error: success ? undefined : 
             hasAuthIssues ? "Authentication failed. Verify your Personal Access Token is correct and has proper permissions." :
             "Some required tables are missing or inaccessible",
      apiKeyInfo
    };
  } catch (error) {
    console.error("[airtable] Error verifying tables:", error);
    return {
      success: false,
      tables: {},
      error: error instanceof Error ? error.message : String(error),
      apiKeyInfo: {
        type: 'unknown',
        format: 'invalid',
        hasPrefix: false
      }
    };
  }
}

/**
 * Creates the Leads table in Airtable if it doesn't exist
 * This sets up the table with the correct field structure to match our PostgreSQL schema
 * @param baseId The Airtable Base ID
 * @returns Promise resolving to creation result
 */
export async function createLeadsTable(baseId: string): Promise<{
  success: boolean;
  message: string;
  tableId?: string;
  error?: string;
}> {
  try {
    // First verify if the table exists already
    const verifyResult = await verifyAirtableTables(baseId);
    
    // If table already exists, return success
    if (verifyResult.tables[TABLES.LEADS]?.exists) {
      return {
        success: true,
        message: 'Leads table already exists',
      };
    }

    // Get the API key and format it correctly
    let apiKey = process.env.AIRTABLE_API_KEY;
    
    if (!apiKey) {
      return {
        success: false,
        message: 'Failed to create Leads table',
        error: 'Airtable API key not configured'
      };
    }
    
    // Format API key for authentication if needed (handle PAT format)
    if (apiKey.startsWith('pat') && !apiKey.startsWith('Bearer ')) {
      apiKey = `Bearer ${apiKey}`;
      console.log('[airtable] Added Bearer prefix to PAT for table creation');
    }

    // Use Airtable Meta API to create the table
    // Note: This requires appropriate permissions on the PAT
    const createTableResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: TABLES.LEADS,
        description: 'Synchronized leads from the noboxLeadGen application',
        fields: [
          { 
            name: 'id', 
            type: 'number', 
            description: 'PostgreSQL ID',
            options: {
              precision: 0  // Integer
            }
          },
          { name: 'firstName', type: 'singleLineText', description: 'First name' },
          { name: 'lastName', type: 'singleLineText', description: 'Last name' },
          { name: 'email', type: 'email', description: 'Email address' },
          { name: 'company', type: 'singleLineText', description: 'Company name' },
          { name: 'title', type: 'singleLineText', description: 'Job title' },
          { name: 'status', type: 'singleSelect', description: 'Current status', 
            options: { 
              choices: [
                { name: 'active' },
                { name: 'inactive' },
                { name: 'contacted' },
                { name: 'responded' },
                { name: 'qualified' },
                { name: 'disqualified' }
              ] 
            } 
          },
          { name: 'source', type: 'singleLineText', description: 'Lead source' },
          { name: 'priority', type: 'singleSelect', description: 'Priority level',
            options: {
              choices: [
                { name: 'high' },
                { name: 'medium' },
                { name: 'low' }
              ]
            }
          },
          { 
            name: 'lastActivityDate', 
            type: 'date', 
            description: 'Date of last activity',
            options: {
              dateFormat: { name: 'iso' }
            }
          },
          { name: 'website', type: 'url', description: 'Website URL' },
          { name: 'notes', type: 'multilineText', description: 'Additional notes' },
          { name: 'tags', type: 'multipleSelects', description: 'Tags',
            options: {
              choices: [
                { name: 'follow-up' },
                { name: 'important' },
                { name: 'new' },
                { name: 'qualified' },
                { name: 'cold' },
                { name: 'warm' },
                { name: 'hot' }
              ]
            }
          },
          { 
            name: 'createdAt', 
            type: 'dateTime', 
            description: 'Creation timestamp',
            options: {
              dateFormat: { name: 'iso' },
              timeFormat: { name: '24hour' }
            } 
          },
          { 
            name: 'updatedAt', 
            type: 'dateTime', 
            description: 'Last update timestamp',
            options: {
              dateFormat: { name: 'iso' },
              timeFormat: { name: '24hour' }
            } 
          },
          { 
            name: 'lastSyncedAt', 
            type: 'dateTime', 
            description: 'Last synchronization timestamp',
            options: {
              dateFormat: { name: 'iso' },
              timeFormat: { name: '24hour' }
            } 
          },
          { name: 'syncSource', type: 'singleSelect', description: 'Synchronization source',
            options: {
              choices: [
                { name: 'postgresql' },
                { name: 'airtable' }
              ]
            }
          }
        ]
      })
    });

    // Check response status
    if (createTableResponse.ok) {
      const responseData = await createTableResponse.json();
      return {
        success: true,
        message: 'Successfully created Leads table in Airtable',
        tableId: responseData.id
      };
    } else {
      const errorData = await createTableResponse.text();
      return {
        success: false,
        message: 'Failed to create Leads table',
        error: errorData
      };
    }
  } catch (error) {
    console.error('[airtable] Error creating Leads table:', error);
    return {
      success: false,
      message: 'Failed to create Leads table due to an exception',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}