/**
 * Airtable Integration Service
 * 
 * This module handles all interactions with Airtable API using Personal Access Token (PAT)
 * and integrates with the MCP (Multiple Cursor Problem) server for optimized requests.
 */

import axios from 'axios';
import { config } from 'dotenv';
import { AxiosError } from 'axios';

// Initialize environment variables
config();

// Airtable API constants
const AIRTABLE_API_URL = 'https://api.airtable.com/v0';
const MCP_SERVER_URL = 'https://airtable-mcp-proxy.deno.dev';

// Check for required environment variables
const validateEnvVars = (): { pat: string | null; baseId: string | null; missingVars: string[] } => {
  const missing = [];
  if (!process.env.AIRTABLE_PAT) missing.push('AIRTABLE_PAT');
  if (!process.env.AIRTABLE_BASE_ID) missing.push('AIRTABLE_BASE_ID');
  
  // Return the values that are available, along with missing vars list
  const pat = process.env.AIRTABLE_PAT || null;
  const baseId = process.env.AIRTABLE_BASE_ID || null;
  
  return { pat, baseId, missingVars: missing };
};

// Get auth headers for API requests
const getAuthHeaders = (): Record<string, string> => {
  const { pat } = validateEnvVars();
  if (!pat) {
    console.warn('PAT not found in environment variables');
    return {
      'Content-Type': 'application/json',
      'Authorization': 'NOT_CONFIGURED'
    };
  }
  return {
    'Authorization': `Bearer ${pat}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Core Airtable API client with error handling and retries
 */
class AirtableClient {
  private baseId: string | null;
  private headers: Record<string, string>;
  private maxRetries: number = 3;
  private isConfigured: boolean = false;
  
  constructor() {
    const { baseId, missingVars } = validateEnvVars();
    this.baseId = baseId;
    this.headers = getAuthHeaders();
    this.isConfigured = missingVars.length === 0;
    
    if (!this.isConfigured) {
      console.warn(`Airtable client not fully configured. Missing: ${missingVars.join(', ')}`);
    }
  }
  
  /**
   * Make a request to the Airtable API with retry logic
   */
  private async makeRequest(
    method: string,
    endpoint: string,
    data?: any,
    retryCount: number = 0
  ): Promise<any> {
    if (!this.baseId || !this.isConfigured) {
      throw new Error('Airtable client is not properly configured');
    }
    
    const url = `${AIRTABLE_API_URL}/${this.baseId}${endpoint}`;
    
    try {
      const response = await axios({
        method,
        url,
        headers: this.headers,
        data
      });
      
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      // Handle rate limiting with exponential backoff
      if (axiosError.response && axiosError.response.status === 429 && retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Rate limited, retrying after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(method, endpoint, data, retryCount + 1);
      }
      
      // Log the error details for debugging
      console.error('Airtable API Error:', {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        url,
        method
      });
      
      throw error;
    }
  }
  
  /**
   * List records from a table
   */
  async listRecords(
    tableName: string,
    options: {
      maxRecords?: number;
      view?: string;
      filterByFormula?: string;
      fields?: string[];
      sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
      offset?: string;
    } = {}
  ) {
    // Build query parameters
    const params = new URLSearchParams();
    if (options.maxRecords) params.append('maxRecords', options.maxRecords.toString());
    if (options.view) params.append('view', options.view);
    if (options.filterByFormula) params.append('filterByFormula', options.filterByFormula);
    if (options.fields) options.fields.forEach(field => params.append('fields[]', field));
    if (options.sort) params.append('sort', JSON.stringify(options.sort));
    if (options.offset) params.append('offset', options.offset);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.makeRequest('GET', `/${encodeURIComponent(tableName)}${queryString}`);
  }
  
  /**
   * Create a record in a table
   */
  async createRecord(tableName: string, fields: Record<string, any>) {
    return this.makeRequest('POST', `/${encodeURIComponent(tableName)}`, { fields });
  }
  
  /**
   * Update a record in a table
   */
  async updateRecord(tableName: string, recordId: string, fields: Record<string, any>) {
    return this.makeRequest('PATCH', `/${encodeURIComponent(tableName)}/${recordId}`, { fields });
  }
  
  /**
   * Delete a record from a table
   */
  async deleteRecord(tableName: string, recordId: string) {
    return this.makeRequest('DELETE', `/${encodeURIComponent(tableName)}/${recordId}`);
  }
}

/**
 * MCP Server client for optimized bulk operations
 */
class MCPClient {
  private baseId: string | null;
  private headers: Record<string, string>;
  private isConfigured: boolean = false;
  
  constructor() {
    const { baseId, missingVars } = validateEnvVars();
    this.baseId = baseId;
    this.headers = getAuthHeaders();
    this.isConfigured = missingVars.length === 0;
    
    if (!this.isConfigured) {
      console.warn(`MCP client not fully configured. Missing: ${missingVars.join(', ')}`);
    }
  }
  
  /**
   * Use the MCP server to execute multiple operations in parallel
   */
  async executeBatch(operations: Array<{
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string;
    body?: any;
  }>) {
    try {
      const response = await axios.post(MCP_SERVER_URL, {
        baseId: this.baseId,
        operations: operations
      }, {
        headers: this.headers
      });
      
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('MCP Server Error:', axiosError.response?.data || axiosError.message);
      throw error;
    }
  }
  
  /**
   * Create multiple records at once using the MCP server
   */
  async createRecords(tableName: string, records: Array<Record<string, any>>) {
    const operations = records.map(fields => ({
      method: 'POST' as const,
      path: `/${tableName}`,
      body: { fields }
    }));
    
    return this.executeBatch(operations);
  }
  
  /**
   * Update multiple records at once using the MCP server
   */
  async updateRecords(tableName: string, updates: Array<{ id: string; fields: Record<string, any> }>) {
    const operations = updates.map(({ id, fields }) => ({
      method: 'PATCH' as const,
      path: `/${tableName}/${id}`,
      body: { fields }
    }));
    
    return this.executeBatch(operations);
  }
  
  /**
   * Delete multiple records at once using the MCP server
   */
  async deleteRecords(tableName: string, recordIds: string[]) {
    const operations = recordIds.map(id => ({
      method: 'DELETE' as const,
      path: `/${tableName}/${id}`
    }));
    
    return this.executeBatch(operations);
  }
}

/**
 * Main Airtable service with both direct API and MCP server functionality
 */
export class AirtableService {
  private airtableClient: AirtableClient;
  private mcpClient: MCPClient;
  
  constructor() {
    this.airtableClient = new AirtableClient();
    this.mcpClient = new MCPClient();
  }
  
  /**
   * Test the connection to Airtable
   */
  async testConnection() {
    try {
      // Check if environment variables are configured
      const { baseId, pat, missingVars } = validateEnvVars();
      
      if (missingVars.length > 0) {
        return {
          connected: false,
          error: `Missing configuration: ${missingVars.join(', ')}`
        };
      }
      
      // Verify the credentials by checking if we can access the base metadata
      try {
        const url = `${AIRTABLE_API_URL}/meta/bases/${baseId}`;
        const response = await axios.get(url, { headers: getAuthHeaders() });
        
        // If successful, return the base info
        return {
          connected: true,
          baseInfo: {
            id: response.data.id,
            name: response.data.name,
            permissionLevel: response.data.permissionLevel
          }
        };
      } catch (error) {
        // Handle specific error types from Airtable
        const axiosError = error as AxiosError;
        console.error('Error connecting to Airtable:', {
          status: axiosError.response?.status,
          data: axiosError.response?.data
        });
        
        // Unauthorized - invalid PAT
        if (axiosError.response?.status === 401) {
          return {
            connected: false,
            error: 'Authentication failed. Please check your Personal Access Token.'
          };
        }
        
        // Not found - invalid base ID
        if (axiosError.response?.status === 404) {
          return {
            connected: false,
            error: 'Base not found. Please check your Base ID.'
          };
        }
        
        // Forbidden - insufficient permissions
        if (axiosError.response?.status === 403) {
          // Try to extract more specific error from Airtable response
          const airtableError = axiosError.response?.data?.error;
          
          if (airtableError && airtableError.type === 'INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND') {
            return {
              connected: false,
              error: 'Invalid permissions or base not found. Make sure your token has access to this base.'
            };
          }
          
          return {
            connected: false,
            error: airtableError?.message || 'Insufficient permissions to access this base.'
          };
        }
        
        // For any other error, return a generic message with status code
        return {
          connected: false,
          error: `Connection error (${axiosError.response?.status || 'unknown'}): ${axiosError.message}`
        };
      }
    } catch (error) {
      // Any other unexpected errors
      const err = error as Error;
      return {
        connected: false,
        error: err.message || 'Unexpected error during connection test'
      };
    }
  }
  
  /**
   * Get available tables in the base
   */
  async getTables() {
    try {
      // Make a request to the base metadata endpoint
      const url = `${AIRTABLE_API_URL}/meta/bases/${validateEnvVars().baseId}/tables`;
      const response = await axios.get(url, { headers: getAuthHeaders() });
      
      // Extract table names
      return {
        tables: response.data.tables.map((table: any) => ({
          id: table.id,
          name: table.name,
          fields: table.fields.map((field: any) => ({
            id: field.id,
            name: field.name,
            type: field.type
          }))
        }))
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Error fetching tables:', axiosError.message);
      throw error;
    }
  }
  
  // Standard API methods
  async listRecords(tableName: string, options = {}) {
    return this.airtableClient.listRecords(tableName, options);
  }
  
  async createRecord(tableName: string, fields: Record<string, any>) {
    return this.airtableClient.createRecord(tableName, fields);
  }
  
  async updateRecord(tableName: string, recordId: string, fields: Record<string, any>) {
    return this.airtableClient.updateRecord(tableName, recordId, fields);
  }
  
  async deleteRecord(tableName: string, recordId: string) {
    return this.airtableClient.deleteRecord(tableName, recordId);
  }
  
  // Bulk operations using MCP server
  async createRecords(tableName: string, records: Array<Record<string, any>>) {
    return this.mcpClient.createRecords(tableName, records);
  }
  
  async updateRecords(tableName: string, updates: Array<{ id: string; fields: Record<string, any> }>) {
    return this.mcpClient.updateRecords(tableName, updates);
  }
  
  async deleteRecords(tableName: string, recordIds: string[]) {
    return this.mcpClient.deleteRecords(tableName, recordIds);
  }
  
  /**
   * Update the Airtable API credentials
   * In a real application, this would update environment variables or a configuration store
   * For demo purposes, we're setting up a mechanism to update the credentials at runtime
   * 
   * @param baseId The Airtable Base ID
   * @param pat The Personal Access Token
   * @returns Success status and message
   */
  async updateCredentials(baseId: string, pat: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      // In a real application, this would store the credentials securely
      // For demo purposes, we're setting the values in process.env
      process.env.AIRTABLE_BASE_ID = baseId;
      process.env.AIRTABLE_PAT = pat;
      
      // Recreate the clients with the new credentials
      this.airtableClient = new AirtableClient();
      this.mcpClient = new MCPClient();
      
      // Test the connection with the new credentials
      const testResult = await this.testConnection();
      
      if (testResult.connected) {
        return {
          success: true,
          message: "Airtable credentials updated successfully"
        };
      } else {
        return {
          success: false,
          error: testResult.error || "Failed to connect with the new credentials"
        };
      }
    } catch (error) {
      console.error('Error updating Airtable credentials:', error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      return {
        success: false,
        error: errorMessage
      };
    }
  }
}

// Export a singleton instance
export const airtableService = new AirtableService();

// Default export for convenience
export default airtableService;