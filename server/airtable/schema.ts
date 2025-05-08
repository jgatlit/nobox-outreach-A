/**
 * Airtable Schema Helper
 * 
 * This file provides utility functions to ensure Airtable tables and fields
 * are properly set up for the application.
 */

import { log } from '../vite';
import { createRecord, listRecords } from './client';

// Define types for the schema
interface AirtableFieldSchema {
  name: string;
  type: string;
  options?: string[];
}

interface AirtableTableSchema {
  name: string;
  description: string;
  fields: AirtableFieldSchema[];
}

interface AirtableSchema {
  [key: string]: AirtableTableSchema;
}

// Define the schema for each table
export const airtableSchema: AirtableSchema = {
  Conversations: {
    name: 'Conversations',
    description: 'AI conversation history and metadata',
    fields: [
      { name: 'Id', type: 'singleLineText' },
      { name: 'Title', type: 'singleLineText' },
      { name: 'User', type: 'singleLineText' },
      { name: 'Status', type: 'singleSelect', options: ['active', 'archived', 'deleted'] },
      { name: 'Messages', type: 'multilineText' }, // JSON stringified messages
      { name: 'Tags', type: 'multipleSelect', options: ['important', 'follow-up', 'completed', 'technical', 'sales', 'support'] },
      { name: 'Created At', type: 'date' },
      { name: 'Updated At', type: 'date' },
      { name: 'Last Message Date', type: 'date' },
      { name: 'Model Used', type: 'singleLineText' },
      { name: 'Tool Executions Count', type: 'number' },
      { name: 'Metadata', type: 'multilineText' } // JSON stringified metadata
    ]
  },
  ToolExecutions: {
    name: 'ToolExecutions',
    description: 'Records of tool usage during AI conversations',
    fields: [
      { name: 'Id', type: 'singleLineText' },
      { name: 'Conversation Id', type: 'singleLineText' },
      { name: 'Tool Name', type: 'singleLineText' },
      { name: 'Status', type: 'singleSelect', options: ['success', 'failure', 'pending'] },
      { name: 'Inputs', type: 'multilineText' }, // JSON stringified inputs
      { name: 'Outputs', type: 'multilineText' }, // JSON stringified outputs
      { name: 'Execution Time', type: 'number' }, // in milliseconds
      { name: 'Created At', type: 'date' },
      { name: 'Error Message', type: 'multilineText' },
      { name: 'Metadata', type: 'multilineText' } // JSON stringified metadata
    ]
  }
};

/**
 * Check if records exist in a table
 * @param baseId Airtable base ID
 * @param tableName Table name to check
 * @returns Promise that resolves with true if records exist, false otherwise
 */
export async function checkIfTableHasRecords(baseId: string, tableName: string): Promise<boolean> {
  try {
    const records = await listRecords(baseId, tableName, { maxRecords: 1 });
    return records && records.length > 0;
  } catch (error) {
    log(`Error checking if table ${tableName} has records: ${error}`, 'airtable');
    return false;
  }
}

/**
 * Create a sample record in a table if it's empty
 * @param baseId Airtable base ID
 * @param tableName Table name
 * @returns Promise that resolves with the created record or null if error
 */
export async function createSampleRecordIfEmpty(baseId: string, tableName: string): Promise<any> {
  try {
    // First check if the table already has records
    const hasRecords = await checkIfTableHasRecords(baseId, tableName);
    
    if (hasRecords) {
      log(`Table ${tableName} already has records, skipping sample creation`, 'airtable');
      return null;
    }
    
    // Get the schema for this table
    const tableSchema = airtableSchema[tableName];
    
    if (!tableSchema) {
      log(`No schema defined for table ${tableName}`, 'airtable');
      return null;
    }
    
    // Create a sample record based on the schema
    const sampleRecord: Record<string, any> = {};
    
    // Fill in some basic sample data based on field type
    tableSchema.fields.forEach((field: AirtableFieldSchema) => {
      switch (field.type) {
        case 'singleLineText':
          sampleRecord[field.name] = `Sample ${field.name}`;
          break;
        case 'multilineText':
          sampleRecord[field.name] = `Sample ${field.name} with\nmultiple lines of text.`;
          break;
        case 'email':
          sampleRecord[field.name] = 'sample@example.com';
          break;
        case 'url':
          sampleRecord[field.name] = 'https://example.com';
          break;
        case 'phone':
          sampleRecord[field.name] = '+1 (555) 123-4567';
          break;
        case 'singleSelect':
          if (field.options && field.options.length > 0) {
            sampleRecord[field.name] = field.options[0];
          }
          break;
        case 'multipleSelect':
          if (field.options && field.options.length > 0) {
            sampleRecord[field.name] = [field.options[0]];
          }
          break;
        case 'date':
          sampleRecord[field.name] = new Date().toISOString();
          break;
        default:
          // Skip fields with unknown types
          break;
      }
    });
    
    // Special handling for specific tables
    if (tableName === 'Conversations') {
      const sampleMessages = JSON.stringify([
        { role: 'user', content: 'Hello, I need help with sales automation.', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'I can help with that! What specific aspects of sales automation are you interested in?', timestamp: new Date().toISOString() }
      ]);
      
      sampleRecord['Id'] = `conv_${Date.now()}`;
      sampleRecord['Title'] = 'Sample Conversation';
      sampleRecord['User'] = 'sample.user@example.com';
      sampleRecord['Status'] = 'active';
      sampleRecord['Messages'] = sampleMessages;
      sampleRecord['Model Used'] = 'gpt-4o';
      sampleRecord['Tool Executions Count'] = 0;
      sampleRecord['Metadata'] = JSON.stringify({ source: 'sample_data', version: '1.0' });
    } else if (tableName === 'ToolExecutions') {
      sampleRecord['Id'] = `tool_${Date.now()}`;
      sampleRecord['Conversation Id'] = `conv_${Date.now()}`;
      sampleRecord['Tool Name'] = 'generate_email';
      sampleRecord['Status'] = 'success';
      sampleRecord['Inputs'] = JSON.stringify({ recipient: 'test@example.com', subject: 'Hello', template: 'welcome' });
      sampleRecord['Outputs'] = JSON.stringify({ success: true, messageId: '123456' });
      sampleRecord['Execution Time'] = 1250; // milliseconds
      sampleRecord['Metadata'] = JSON.stringify({ source: 'sample_data', version: '1.0' });
    }
    
    log(`Creating sample record for table ${tableName}`, 'airtable');
    const result = await createRecord(baseId, tableName, sampleRecord);
    
    log(`Successfully created sample record for table ${tableName}`, 'airtable');
    return result;
  } catch (error) {
    log(`Error creating sample record for table ${tableName}: ${error}`, 'airtable');
    return null;
  }
}

/**
 * Verify all tables have at least one record
 * @param baseId Airtable base ID
 * @returns Promise that resolves when verification is complete
 */
export async function verifyAirtableTables(baseId: string): Promise<void> {
  try {
    log('Verifying Airtable tables...', 'airtable');
    
    // Check each table in our schema
    for (const tableName of Object.keys(airtableSchema)) {
      try {
        await createSampleRecordIfEmpty(baseId, tableName);
      } catch (tableError) {
        log(`Error verifying table ${tableName}: ${tableError}`, 'airtable');
        // Continue with next table
      }
    }
    
    log('Airtable table verification complete', 'airtable');
  } catch (error) {
    log(`Error verifying Airtable tables: ${error}`, 'airtable');
  }
}