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
  Leads: {
    name: 'Leads',
    description: 'Prospect and lead contact information',
    fields: [
      { name: 'First Name', type: 'singleLineText' },
      { name: 'Last Name', type: 'singleLineText' },
      { name: 'Email', type: 'email' },
      { name: 'Company', type: 'singleLineText' },
      { name: 'Title', type: 'singleLineText' },
      { name: 'Phone', type: 'phone' },
      { name: 'Website', type: 'url' },
      { name: 'LinkedIn URL', type: 'url' },
      { name: 'Source', type: 'singleSelect', options: ['email', 'pipedrive', 'asana', 'instantly', 'cyberleads', 'linkedin', 'manual'] },
      { name: 'Status', type: 'singleSelect', options: ['active', 'inactive', 'contacted', 'responded', 'qualified', 'disqualified'] },
      { name: 'Priority', type: 'singleSelect', options: ['low', 'medium', 'high', 'urgent'] },
      { name: 'Notes', type: 'multilineText' },
      { name: 'Tags', type: 'multipleSelect', options: ['conference', 'tech', 'referral', 'cold', 'warm'] },
      { name: 'Last Contact Date', type: 'date' },
      { name: 'Created At', type: 'date' },
      { name: 'Updated At', type: 'date' },
      { name: 'Email Status', type: 'singleSelect', options: ['not_started', 'draft_generated', 'sent', 'opened', 'clicked', 'replied'] },
      { name: 'Industry', type: 'singleLineText' },
      { name: 'Employee Count', type: 'singleLineText' },
      { name: 'Location', type: 'singleLineText' },
      { name: 'Tech Stack', type: 'multilineText' },
      { name: 'Insights', type: 'multilineText' },
      { name: 'Personalization Hooks', type: 'multilineText' }
    ]
  },
  Companies: {
    name: 'Companies',
    description: 'Company profile information',
    fields: [
      { name: 'Name', type: 'singleLineText' },
      { name: 'Website', type: 'url' },
      { name: 'Industry', type: 'singleLineText' },
      { name: 'Description', type: 'multilineText' },
      { name: 'Size', type: 'singleLineText' },
      { name: 'Location', type: 'singleLineText' },
      { name: 'LinkedIn URL', type: 'url' },
      { name: 'Created At', type: 'date' },
      { name: 'Updated At', type: 'date' }
    ]
  },
  Projects: {
    name: 'Projects',
    description: 'Project details and history',
    fields: [
      { name: 'Name', type: 'singleLineText' },
      { name: 'Description', type: 'multilineText' },
      { name: 'Client', type: 'singleLineText' },
      { name: 'Status', type: 'singleSelect', options: ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'] },
      { name: 'Start Date', type: 'date' },
      { name: 'End Date', type: 'date' },
      { name: 'Created At', type: 'date' },
      { name: 'Updated At', type: 'date' }
    ]
  },
  'Email Templates': {
    name: 'Email Templates',
    description: 'Email templates for outreach campaigns',
    fields: [
      { name: 'Name', type: 'singleLineText' },
      { name: 'Subject', type: 'singleLineText' },
      { name: 'Body', type: 'multilineText' },
      { name: 'Tags', type: 'multilineText' },
      { name: 'Created At', type: 'date' },
      { name: 'Updated At', type: 'date' }
    ]
  },
  Campaigns: {
    name: 'Campaigns',
    description: 'Marketing and outreach campaigns',
    fields: [
      { name: 'Name', type: 'singleLineText' },
      { name: 'Description', type: 'multilineText' },
      { name: 'Status', type: 'singleSelect', options: ['draft', 'active', 'paused', 'completed'] },
      { name: 'Start Date', type: 'date' },
      { name: 'End Date', type: 'date' },
      { name: 'Goal', type: 'singleLineText' },
      { name: 'Created At', type: 'date' },
      { name: 'Updated At', type: 'date' }
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
    if (tableName === 'Leads') {
      sampleRecord['First Name'] = 'Sample';
      sampleRecord['Last Name'] = 'User';
      sampleRecord['Email'] = 'sample.user@example.com';
      sampleRecord['Company'] = 'Example Corp';
      sampleRecord['Source'] = 'manual';
      sampleRecord['Status'] = 'active';
    } else if (tableName === 'Companies') {
      sampleRecord['Name'] = 'Example Corp';
      sampleRecord['Website'] = 'https://example.com';
      sampleRecord['Industry'] = 'Technology';
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