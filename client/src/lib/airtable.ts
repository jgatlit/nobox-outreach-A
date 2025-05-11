import { apiRequest } from './queryClient';

/**
 * Check Airtable connection status
 */
export async function checkAirtableConnection() {
  return apiRequest('GET', '/api/airtable/check-connection');
}

/**
 * Sync leads from PostgreSQL to Airtable
 */
export async function syncLeadsToAirtable() {
  return apiRequest('POST', '/api/airtable/sync-to-airtable');
}

/**
 * Sync leads from Airtable to PostgreSQL
 */
export async function syncLeadsFromAirtable() {
  return apiRequest('POST', '/api/airtable/sync-from-airtable');
}