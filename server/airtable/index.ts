/**
 * Airtable Integration
 * 
 * This file exports all Airtable-related functionality.
 */

export { airtableConfig } from './config';
export { startAirtableServer } from './server';
export { 
  airtableClient,
  searchRecords,
  listRecords,
  createRecord,
  updateRecord,
  deleteRecord
} from './client';

// Main utility function for checking if Airtable is properly configured
export function isAirtableConfigured(): boolean {
  return Boolean(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);
}