/**
 * Airtable Authentication Manager
 * 
 * This module handles the authentication with Airtable, supporting both Personal Access Tokens (PATs)
 * and classic API keys. PATs are the recommended and more secure option.
 */

import { log } from '../vite';

/**
 * Authentication type definitions
 */
export type AirtableAuthType = 'pat' | 'classic_key' | 'unknown';
export type AirtableAuthStatus = 'valid' | 'invalid' | 'unknown';

/**
 * Represents Airtable authentication details
 */
export interface AirtableAuth {
  type: AirtableAuthType;
  status: AirtableAuthStatus;
  hasPrefix: boolean;
  // Raw key from environment variable
  rawValue: string;
  // Value to use with Airtable SDK
  sdkValue: string;
  // Value to use with fetch API calls (includes Bearer for PATs)
  headerValue: string;
}

/**
 * Process and normalize the Airtable authentication token
 * @param apiKey The raw API key from env variable
 * @returns Processed authentication info
 */
export function processAuth(apiKey?: string): AirtableAuth {
  // Default return for no key provided
  if (!apiKey) {
    return {
      type: 'unknown',
      status: 'invalid',
      hasPrefix: false,
      rawValue: '',
      sdkValue: '',
      headerValue: ''
    };
  }

  let type: AirtableAuthType = 'unknown';
  let hasPrefix = false;
  let sdkValue = apiKey;
  let headerValue = apiKey;

  // Check if it's a PAT (starts with 'pat' or 'Bearer pat')
  if (apiKey.startsWith('pat')) {
    type = 'pat';
    hasPrefix = false;
    // PAT without Bearer prefix - add it for header value
    headerValue = `Bearer ${apiKey}`;
    // SDK requires the raw PAT without prefix
    sdkValue = apiKey;
  } 
  else if (apiKey.startsWith('Bearer pat')) {
    type = 'pat';
    hasPrefix = true;
    // PAT with Bearer prefix - keep it for header value
    headerValue = apiKey;
    // SDK requires the PAT without Bearer prefix
    sdkValue = apiKey.substring(7); // Remove 'Bearer ' prefix
  }
  // Check if it looks like a classic API key
  else if (apiKey.length > 16 && !apiKey.startsWith('pat') && !apiKey.startsWith('Bearer')) {
    type = 'classic_key';
    hasPrefix = false;
    // Classic API key - use as is for both SDK and header
    sdkValue = apiKey;
    headerValue = apiKey;
  }
  // Handle PAT with the wrong format
  else if (apiKey.startsWith('Bearer ') && !apiKey.includes('pat')) {
    log('Warning: Bearer token does not appear to be a valid PAT', 'airtable');
    type = 'unknown';
    hasPrefix = true;
    headerValue = apiKey;
    sdkValue = apiKey.substring(7); // Remove 'Bearer ' prefix
  }

  return {
    type,
    status: 'unknown', // Status is determined after testing
    hasPrefix,
    rawValue: apiKey,
    sdkValue,
    headerValue
  };
}

/**
 * Get the authentication info from environment variables
 * @returns Processed authentication info
 */
export function getAuth(): AirtableAuth {
  const apiKey = process.env.AIRTABLE_API_KEY;
  return processAuth(apiKey);
}

/**
 * Test if the authentication is valid
 * @param baseId Airtable base ID
 * @param auth Authentication info
 * @returns Promise resolving to the auth with updated status
 */
export async function testAuth(baseId: string, auth: AirtableAuth): Promise<AirtableAuth> {
  if (!auth.rawValue || !baseId) {
    auth.status = 'invalid';
    return auth;
  }

  try {
    // Try to access a table to verify authentication
    const url = `https://api.airtable.com/v0/${baseId}/Leads?maxRecords=1`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': auth.headerValue
      }
    });
    
    // Check if response is ok or if it's a 404 (which means the table doesn't exist but auth is valid)
    if (response.ok || response.status === 404) {
      auth.status = 'valid';
      log('Airtable authentication test successful', 'airtable');
    } else {
      auth.status = 'invalid';
      const errorText = await response.text();
      log(`Airtable authentication test failed: ${errorText}`, 'airtable');
    }
  } catch (error) {
    auth.status = 'invalid';
    log(`Airtable authentication test error: ${error}`, 'airtable');
  }
  
  return auth;
}