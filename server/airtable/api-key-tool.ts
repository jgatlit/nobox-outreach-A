/**
 * Airtable API Key Management Tool
 * 
 * This module provides functions to validate and update Airtable API keys.
 */

import { log } from '../vite';
import { processAuth, testAuth } from './auth';

/**
 * Validates an Airtable API key or PAT
 * @param apiKey The API key to validate
 * @param baseId The base ID to test against
 * @returns Validation result
 */
export async function validateApiKey(apiKey: string, baseId: string): Promise<{
  valid: boolean;
  type: string;
  hasPrefix: boolean;
  message: string;
}> {
  try {
    // Process the key to determine its type
    const auth = processAuth(apiKey);
    
    // Test authentication with Airtable
    const testedAuth = await testAuth(baseId, auth);
    
    // Return results
    return {
      valid: testedAuth.status === 'valid',
      type: testedAuth.type,
      hasPrefix: testedAuth.hasPrefix,
      message: testedAuth.status === 'valid' 
        ? `Valid ${testedAuth.type} authentication token` 
        : `Invalid ${testedAuth.type} authentication token`
    };
  } catch (error) {
    log(`Error validating API key: ${error}`, 'airtable');
    return {
      valid: false,
      type: 'unknown',
      hasPrefix: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Formats an API key or PAT appropriately based on its type
 * @param apiKey The API key to format
 * @returns Formatted API key
 */
export function formatApiKey(apiKey: string): string {
  const auth = processAuth(apiKey);
  
  if (auth.type === 'pat' && !auth.hasPrefix) {
    // Add Bearer prefix for PATs that don't have it
    return `Bearer ${apiKey}`;
  }
  
  return apiKey;
}