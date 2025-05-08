/**
 * Airtable MCP Client Adapter
 * 
 * This file provides a client adapter for the Airtable MCP server.
 * It exposes an API compatible with our existing client interface
 * but leverages the enhanced capabilities of the MCP server.
 */

import { spawn, ChildProcess } from 'child_process';
import { log } from '../vite';

interface McpRequest {
  type: string;
  args: any;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

/**
 * Adapter class that translates between our client interface and the MCP server
 */
export class AirtableMcpAdapter {
  private mcpProcess: ChildProcess | null = null;
  private buffer: string = '';
  private requests: McpRequest[] = [];
  private baseId: string;
  private initialized: boolean = false;
  private initPromise: Promise<boolean>;
  private initResolve!: (value: boolean) => void;
  private initReject!: (error: any) => void;

  constructor(baseId: string) {
    this.baseId = baseId;
    
    this.initPromise = new Promise((resolve, reject) => {
      this.initResolve = resolve;
      this.initReject = reject;
    });
    
    this.initialize();
  }

  /**
   * Initialize the MCP client adapter
   */
  private async initialize(): Promise<void> {
    try {
      // Since we're avoiding circular dependencies, we'll check if the server process
      // is provided later during server start. For now, initialize as not ready.
      log('MCP adapter initialized in pending state. Will be connected to server if available.', 'airtable');
      this.initialized = false;
      this.initResolve(false);
    } catch (error: any) {
      log(`Error initializing MCP adapter: ${error?.message || 'Unknown error'}`, 'airtable');
      this.initReject(error);
    }
  }
  
  /**
   * Connect to an existing MCP server process
   * @param process The child process running the MCP server
   */
  public connectToProcess(process: ChildProcess): void {
    if (this.mcpProcess) {
      log('MCP adapter already connected to a process', 'airtable');
      return;
    }
    
    log('Connecting MCP adapter to server process', 'airtable');
    this.mcpProcess = process;
    
    // Set up data handling for the process
    this.setupProcessListeners();
    
    this.initialized = true;
    
    // If initialization already completed with false, we don't need to resolve again
    // This is just an extra safety measure
    this.initPromise.then(initialized => {
      if (!initialized) {
        this.initResolve(true);
      }
    }).catch(() => {
      // If it was rejected, we can't do anything
    });
  }

  /**
   * Set up the listeners for the MCP process
   */
  private setupProcessListeners(): void {
    if (!this.mcpProcess) return;
    
    this.mcpProcess.stdout?.on('data', (data) => {
      const dataStr = data.toString();
      this.buffer += dataStr;
      
      // Process complete JSON responses
      this.processBuffer();
    });

    this.mcpProcess.stderr?.on('data', (data) => {
      log(`MCP stderr: ${data.toString().trim()}`, 'airtable');
    });

    this.mcpProcess.on('error', (error) => {
      log(`MCP process error: ${error.message}`, 'airtable');
      this.handleFailedRequests(error);
    });

    this.mcpProcess.on('exit', (code) => {
      log(`MCP process exited with code ${code}`, 'airtable');
      this.handleFailedRequests(new Error(`MCP process exited with code ${code || 'unknown'}`));
      this.mcpProcess = null;
    });
  }

  /**
   * Process the buffer to extract complete JSON responses
   */
  private processBuffer(): void {
    // Try to find complete JSON messages in the buffer
    try {
      const lines = this.buffer.split('\n');
      
      // Process all complete lines
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        try {
          const response = JSON.parse(line);
          this.handleMcpResponse(response);
        } catch (parseError) {
          log(`Failed to parse MCP response: ${line}`, 'airtable');
        }
      }
      
      // Keep the last (potentially incomplete) line in the buffer
      this.buffer = lines[lines.length - 1];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`Error processing MCP buffer: ${errorMessage}`, 'airtable');
    }
  }

  /**
   * Handle a response from the MCP server
   */
  private handleMcpResponse(response: any): void {
    if (this.requests.length === 0) {
      log('Received MCP response but no pending requests', 'airtable');
      return;
    }
    
    // Get the oldest request
    const request = this.requests.shift();
    
    if (!request) return;
    
    if (response.error) {
      request.reject(new Error(response.error.message || 'MCP server error'));
    } else {
      request.resolve(response.result);
    }
  }

  /**
   * Handle failed requests when the MCP process fails
   */
  private handleFailedRequests(error: Error): void {
    // Reject all pending requests
    while (this.requests.length > 0) {
      const request = this.requests.shift();
      if (request) {
        request.reject(error);
      }
    }
  }

  /**
   * Send a command to the MCP server
   */
  private async sendCommand(type: string, args: any): Promise<any> {
    try {
      // Wait for initialization to complete
      const initialized = await this.initPromise;
      
      if (!initialized || !this.mcpProcess) {
        throw new Error('MCP adapter not initialized or process not available');
      }
      
      return new Promise((resolve, reject) => {
        const request: McpRequest = {
          type,
          args,
          resolve,
          reject
        };
        
        this.requests.push(request);
        
        const command = JSON.stringify({
          jsonrpc: '2.0',
          method: 'call_tool',
          params: {
            tool_name: type,
            tool_params: args
          },
          id: Date.now().toString()
        });
        
        if (this.mcpProcess && this.mcpProcess.stdin) {
          this.mcpProcess.stdin.write(command + '\n');
        } else {
          throw new Error('MCP process or stdin not available');
        }
      });
    } catch (error: any) {
      log(`Error sending MCP command: ${error?.message || 'Unknown error'}`, 'airtable');
      throw error;
    }
  }

  /**
   * Query records from a table
   */
  async query(baseId: string, tableName: string, options: any = {}): Promise<any[]> {
    try {
      // Adapt our query format to MCP list_records format
      const mcpArgs: any = {
        baseId,
        tableId: tableName,
        maxRecords: options.maxRecords || 100
      };
      
      if (options.filterByFormula) {
        mcpArgs.filterByFormula = options.filterByFormula;
      }
      
      const result = await this.sendCommand('list_records', mcpArgs);
      
      // Transform MCP response to match our expected format
      return Array.isArray(result) ? result.map(record => ({
        id: record.id,
        fields: record.fields || {}
      })) : [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`MCP query failed, using fallback: ${errorMessage}`, 'airtable');
      throw error; // Let the fallback mechanism handle it
    }
  }

  /**
   * Create a record in a table
   */
  async create(baseId: string, tableName: string, fields: Record<string, any>): Promise<any> {
    try {
      const result = await this.sendCommand('create_record', {
        baseId,
        tableId: tableName,
        fields
      });
      
      return {
        id: result.id,
        fields: result.fields || fields
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`MCP create failed, using fallback: ${errorMessage}`, 'airtable');
      throw error;
    }
  }

  /**
   * Update a record in a table
   */
  async update(baseId: string, tableName: string, recordId: string, fields: Record<string, any>): Promise<any> {
    try {
      const result = await this.sendCommand('update_records', {
        baseId,
        tableId: tableName,
        records: [{ id: recordId, fields }]
      });
      
      // The MCP server returns an array of updated records
      const updatedRecord = Array.isArray(result) && result.length > 0 ? result[0] : null;
      
      if (!updatedRecord) {
        throw new Error('Failed to update record');
      }
      
      return {
        id: updatedRecord.id,
        fields: updatedRecord.fields || fields
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`MCP update failed, using fallback: ${errorMessage}`, 'airtable');
      throw error;
    }
  }

  /**
   * Delete a record from a table
   */
  async delete(baseId: string, tableName: string, recordId: string): Promise<any> {
    try {
      await this.sendCommand('delete_records', {
        baseId,
        tableId: tableName,
        recordIds: [recordId]
      });
      
      return {
        id: recordId,
        deleted: true
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`MCP delete failed, using fallback: ${errorMessage}`, 'airtable');
      throw error;
    }
  }

  /**
   * Check if the MCP client is initialized and available
   */
  isAvailable(): boolean {
    return this.initialized && this.mcpProcess !== null;
  }
}

// Create and export a singleton instance
let mcpClientAdapter: AirtableMcpAdapter | null = null;

/**
 * Get the MCP client adapter instance
 */
export function getMcpClientAdapter(baseId: string): AirtableMcpAdapter {
  if (!mcpClientAdapter) {
    mcpClientAdapter = new AirtableMcpAdapter(baseId);
  }
  return mcpClientAdapter;
}