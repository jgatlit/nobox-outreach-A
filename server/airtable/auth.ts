/**
 * Airtable Authentication Module
 * 
 * This module handles all aspects of Airtable authentication, supporting both
 * Personal Access Tokens (PAT) and classic API keys with proper formatting.
 */

import { log } from '../vite';
import Airtable from 'airtable';

// Define missing interface from Airtable SDK
interface AirtableBase {
  table: (tableName: string) => any;
  tables: () => Promise<any[]>;
}

// Define auth type interface
export interface AirtableAuth {
  type: 'pat' | 'classic_key' | 'unknown';
  value: string;
  hasPrefix: boolean;
  bearerToken?: string;
  status?: 'valid' | 'invalid' | 'untested';
  // For backward compatibility with existing code
  rawValue?: string;
  sdkValue?: string;
}

/**
 * Process an authentication token to determine its type and format
 * @param authToken API key or PAT to process
 * @returns Processed auth object
 */
export function processAuth(authToken: string): AirtableAuth {
  let type: 'pat' | 'classic_key' | 'unknown' = 'unknown';
  let hasPrefix = false;
  let value = authToken;
  let bearerToken: string | undefined;

  // Check if it's a PAT (starts with "pat" or has "Bearer pat" prefix)
  if (authToken.startsWith('pat') || /^pat\w+$/.test(authToken)) {
    type = 'pat';
    value = authToken;
    bearerToken = `Bearer ${authToken}`;
  } else if (authToken.startsWith('Bearer pat')) {
    type = 'pat';
    hasPrefix = true;
    value = authToken.replace('Bearer ', '');
    bearerToken = authToken;
  } else if (authToken.startsWith('Bearer ') && !authToken.includes('pat')) {
    // If it has Bearer prefix but doesn't look like a PAT
    type = 'unknown';
    hasPrefix = true;
    value = authToken.replace('Bearer ', '');
    bearerToken = authToken;
  } else if (authToken.startsWith('key')) {
    // It's a classic API key
    type = 'classic_key';
    value = authToken;
  }

  return {
    type,
    value,
    hasPrefix,
    bearerToken: type === 'pat' ? bearerToken : undefined,
    status: 'untested'
  };
}

/**
 * Test authentication against Airtable API
 * @param baseId Base ID to test against
 * @param auth Auth object from processAuth
 * @returns Auth object with updated status
 */
export async function testAuth(baseId: string, auth: AirtableAuth): Promise<AirtableAuth> {
  try {
    // For PAT, use fetch with Authorization header
    if (auth.type === 'pat') {
      // Add Bearer prefix if not present
      const authHeader = auth.hasPrefix ? auth.value : `Bearer ${auth.value}`;
      log(`Added Bearer prefix to PAT for Airtable API verification`, 'airtable');

      // Make a basic request to the metadata API
      const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return { ...auth, status: 'valid' };
      }

      const errorData = await response.json();
      log(`Airtable authentication test failed: ${JSON.stringify(errorData)}`, 'airtable');
      
      if (errorData?.error?.type === 'UNAUTHORIZED' || 
          errorData?.error?.type === 'AUTHENTICATION_REQUIRED') {
        log(`Airtable authentication failed verification`, 'airtable');
        return { ...auth, status: 'invalid' };
      }
      
      // If we get here, the token might be valid but there are other issues
      return { ...auth, status: 'invalid' };
    } 
    // For classic API key, use Airtable SDK
    else if (auth.type === 'classic_key') {
      const airtable = new Airtable({ apiKey: auth.value });
      const base = airtable.base(baseId);
      
      // Try to list tables, which will verify the API key
      try {
        // Just try to retrieve metadata, not actual records
        await base.tables();
        return { ...auth, status: 'valid' };
      } catch (error) {
        log(`Classic API key verification failed: ${error}`, 'airtable');
        return { ...auth, status: 'invalid' };
      }
    }
    
    // For unknown types, assume invalid
    return { ...auth, status: 'invalid' };
  } catch (error) {
    log(`Error testing Airtable authentication: ${error}`, 'airtable');
    return { ...auth, status: 'invalid' };
  }
}

/**
 * Process an API key and ensure it has the correct prefix for its type
 * @param apiKey API key to format
 * @returns Properly formatted API key
 */
export function formatApiKeyForRequest(apiKey: string): string {
  const auth = processAuth(apiKey);
  
  if (auth.type === 'pat' && !auth.hasPrefix) {
    return `Bearer ${apiKey}`;
  }
  
  return apiKey;
}

/**
 * Get the current API key from environment variables
 * @returns The current API key
 */
export function getCurrentApiKey(): string | null {
  return process.env.AIRTABLE_API_KEY || null;
}

/**
 * Set a new API key in the environment
 * @param apiKey New API key to use
 */
export function setApiKey(apiKey: string): void {
  process.env.AIRTABLE_API_KEY = apiKey;
}

/**
 * Retrieve current auth information from environment
 * @returns Current authentication object
 */
export function getAuth(): AirtableAuth {
  const apiKey = process.env.AIRTABLE_API_KEY || '';
  
  if (!apiKey) {
    return {
      type: 'unknown',
      value: '',
      hasPrefix: false,
      rawValue: '',
      sdkValue: ''
    };
  }
  
  const auth = processAuth(apiKey);
  
  // Add backward compatibility properties
  auth.rawValue = auth.value;
  
  // For SDK usage, remove Bearer prefix if it's a PAT
  auth.sdkValue = auth.type === 'pat' && auth.hasPrefix 
    ? auth.value.replace('Bearer ', '') 
    : auth.value;
    
  return auth;
}