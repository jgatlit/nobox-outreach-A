/**
 * Airtable Tool Executions Module
 * 
 * This module provides utility functions to interact with the ToolExecutions table in Airtable.
 * It handles storing, retrieving, and updating tool execution data.
 */

import { log } from '../vite';
import { createRecord, updateRecord, listRecords, searchRecords, deleteRecord } from './client';

// Define interfaces for tool execution data
export interface ToolExecution {
  id: string;
  conversationId: string;
  toolName: string;
  status: 'success' | 'failure' | 'pending';
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  executionTime?: number; // in milliseconds
  createdAt: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a new tool execution record in Airtable
 * @param baseId Airtable base ID
 * @param execution Tool execution data
 * @returns Promise that resolves with the created record
 */
export async function createToolExecution(baseId: string, execution: ToolExecution): Promise<any> {
  try {
    log(`Creating tool execution in Airtable: ${execution.id}`, 'airtable');
    
    // Prepare the record for Airtable
    const record = {
      'Id': execution.id,
      'Conversation Id': execution.conversationId,
      'Tool Name': execution.toolName,
      'Status': execution.status,
      'Inputs': JSON.stringify(execution.inputs),
      'Outputs': execution.outputs ? JSON.stringify(execution.outputs) : '',
      'Execution Time': execution.executionTime || 0,
      'Created At': execution.createdAt,
      'Error Message': execution.errorMessage || '',
      'Metadata': execution.metadata ? JSON.stringify(execution.metadata) : '{}'
    };
    
    return await createRecord(baseId, 'ToolExecutions', record);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error creating tool execution in Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Get all tool executions for a specific conversation
 * @param baseId Airtable base ID
 * @param conversationId Conversation ID
 * @returns Promise that resolves with the tool executions
 */
export async function getConversationToolExecutions(baseId: string, conversationId: string): Promise<ToolExecution[]> {
  try {
    log(`Getting tool executions for conversation: ${conversationId}`, 'airtable');
    
    // Search for tool executions by conversation ID
    const formula = `{Conversation Id} = "${conversationId}"`;
    const records = await searchRecords(baseId, 'ToolExecutions', formula);
    
    // Convert records to our internal format
    return records.map(record => {
      const inputs = record.fields['Inputs'] ? 
        JSON.parse(record.fields['Inputs']) : {};
      
      const outputs = record.fields['Outputs'] ? 
        JSON.parse(record.fields['Outputs']) : undefined;
      
      const metadata = record.fields['Metadata'] ? 
        JSON.parse(record.fields['Metadata']) : undefined;
      
      return {
        id: record.fields['Id'],
        conversationId: record.fields['Conversation Id'],
        toolName: record.fields['Tool Name'],
        status: record.fields['Status'],
        inputs,
        outputs,
        executionTime: record.fields['Execution Time'],
        createdAt: record.fields['Created At'],
        errorMessage: record.fields['Error Message'],
        metadata
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error getting conversation tool executions from Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Get a specific tool execution by ID
 * @param baseId Airtable base ID
 * @param executionId Tool execution ID
 * @returns Promise that resolves with the tool execution
 */
export async function getToolExecution(baseId: string, executionId: string): Promise<ToolExecution | null> {
  try {
    log(`Getting tool execution: ${executionId}`, 'airtable');
    
    // Search for the tool execution by ID
    const formula = `{Id} = "${executionId}"`;
    const records = await searchRecords(baseId, 'ToolExecutions', formula);
    
    if (!records || records.length === 0) {
      return null;
    }
    
    const record = records[0];
    
    // Convert record to our internal format
    const inputs = record.fields['Inputs'] ? 
      JSON.parse(record.fields['Inputs']) : {};
    
    const outputs = record.fields['Outputs'] ? 
      JSON.parse(record.fields['Outputs']) : undefined;
    
    const metadata = record.fields['Metadata'] ? 
      JSON.parse(record.fields['Metadata']) : undefined;
    
    return {
      id: record.fields['Id'],
      conversationId: record.fields['Conversation Id'],
      toolName: record.fields['Tool Name'],
      status: record.fields['Status'],
      inputs,
      outputs,
      executionTime: record.fields['Execution Time'],
      createdAt: record.fields['Created At'],
      errorMessage: record.fields['Error Message'],
      metadata
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error getting tool execution from Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Update a tool execution (typically to set outputs or status after completion)
 * @param baseId Airtable base ID
 * @param executionId Tool execution ID
 * @param updates Partial tool execution data to update
 * @returns Promise that resolves with the updated record
 */
export async function updateToolExecution(
  baseId: string, 
  executionId: string, 
  updates: Partial<ToolExecution>
): Promise<any> {
  try {
    log(`Updating tool execution: ${executionId}`, 'airtable');
    
    // First get the Airtable record ID for this tool execution
    const formula = `{Id} = "${executionId}"`;
    const records = await searchRecords(baseId, 'ToolExecutions', formula);
    
    if (!records || records.length === 0) {
      throw new Error(`Tool execution not found: ${executionId}`);
    }
    
    const recordId = records[0].id;
    
    // Prepare the updates for Airtable
    const fields: Record<string, any> = {};
    
    if (updates.status) fields['Status'] = updates.status;
    if (updates.outputs) fields['Outputs'] = JSON.stringify(updates.outputs);
    if (updates.executionTime !== undefined) fields['Execution Time'] = updates.executionTime;
    if (updates.errorMessage) fields['Error Message'] = updates.errorMessage;
    if (updates.metadata) fields['Metadata'] = JSON.stringify(updates.metadata);
    
    return await updateRecord(baseId, 'ToolExecutions', recordId, fields);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error updating tool execution in Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Complete a tool execution by updating its status, outputs, and execution time
 * @param baseId Airtable base ID
 * @param executionId Tool execution ID
 * @param success Whether the execution was successful
 * @param outputs The outputs of the tool execution (if successful)
 * @param executionTime The execution time in milliseconds
 * @param errorMessage Error message (if not successful)
 * @returns Promise that resolves with the updated tool execution
 */
export async function completeToolExecution(
  baseId: string, 
  executionId: string, 
  success: boolean,
  outputs?: Record<string, any>,
  executionTime?: number,
  errorMessage?: string
): Promise<ToolExecution | null> {
  try {
    log(`Completing tool execution: ${executionId} (success: ${success})`, 'airtable');
    
    // Update the tool execution
    await updateToolExecution(baseId, executionId, {
      status: success ? 'success' : 'failure',
      outputs,
      executionTime,
      errorMessage
    });
    
    // Return the updated tool execution
    return await getToolExecution(baseId, executionId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error completing tool execution in Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Delete a tool execution
 * @param baseId Airtable base ID
 * @param executionId Tool execution ID
 * @returns Promise that resolves when the operation is complete
 */
export async function deleteToolExecution(baseId: string, executionId: string): Promise<any> {
  try {
    log(`Deleting tool execution: ${executionId}`, 'airtable');
    
    // First get the Airtable record ID for this tool execution
    const formula = `{Id} = "${executionId}"`;
    const records = await searchRecords(baseId, 'ToolExecutions', formula);
    
    if (!records || records.length === 0) {
      throw new Error(`Tool execution not found: ${executionId}`);
    }
    
    const recordId = records[0].id;
    
    // Delete the record from Airtable
    return await deleteRecord(baseId, 'ToolExecutions', recordId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error deleting tool execution from Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Get all tool executions for a specific tool
 * @param baseId Airtable base ID
 * @param toolName Name of the tool
 * @param maxRecords Maximum number of records to return
 * @returns Promise that resolves with the tool executions
 */
export async function getToolExecutionsByName(
  baseId: string, 
  toolName: string,
  maxRecords: number = 100
): Promise<ToolExecution[]> {
  try {
    log(`Getting tool executions for tool: ${toolName}`, 'airtable');
    
    // Search for tool executions by tool name
    const formula = `{Tool Name} = "${toolName}"`;
    const records = await searchRecords(baseId, 'ToolExecutions', formula);
    
    // Convert records to our internal format (limited by maxRecords)
    return records.slice(0, maxRecords).map(record => {
      const inputs = record.fields['Inputs'] ? 
        JSON.parse(record.fields['Inputs']) : {};
      
      const outputs = record.fields['Outputs'] ? 
        JSON.parse(record.fields['Outputs']) : undefined;
      
      const metadata = record.fields['Metadata'] ? 
        JSON.parse(record.fields['Metadata']) : undefined;
      
      return {
        id: record.fields['Id'],
        conversationId: record.fields['Conversation Id'],
        toolName: record.fields['Tool Name'],
        status: record.fields['Status'],
        inputs,
        outputs,
        executionTime: record.fields['Execution Time'],
        createdAt: record.fields['Created At'],
        errorMessage: record.fields['Error Message'],
        metadata
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error getting tool executions by name from Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}