import { apiRequest } from './queryClient';

/**
 * Check Airtable connection status
 */
export async function checkAirtableConnection() {
  return apiRequest('/api/airtable/check-connection', {});
}

/**
 * Sync leads from PostgreSQL to Airtable
 */
export async function syncLeadsToAirtable() {
  return apiRequest('/api/airtable/sync-to-airtable', {
    method: 'POST',
    body: {}
  });
}

/**
 * Sync leads from Airtable to PostgreSQL
 */
export async function syncLeadsFromAirtable() {
  return apiRequest('/api/airtable/sync-from-airtable', {
    method: 'POST',
    body: {}
  });
}