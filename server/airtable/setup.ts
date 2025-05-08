/**
 * Airtable Setup Utility
 * 
 * This utility helps create the necessary Airtable base and tables 
 * if they don't already exist.
 */

import { log } from '../vite';
import Airtable from 'airtable';
import { airtableSchema } from './schema';

// Configure Airtable with API key
const configureAirtable = (): Airtable => {
  if (!process.env.AIRTABLE_API_KEY) {
    throw new Error('AIRTABLE_API_KEY is not set');
  }
  
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
};

/**
 * Validate that the base exists and is accessible
 * @param baseId Airtable base ID
 * @returns Promise with validation result
 */
export async function validateAirtableBase(baseId: string): Promise<{ 
  valid: boolean; 
  message: string; 
  existingTables?: string[];
  missingTables?: string[];
}> {
  try {
    log(`Validating Airtable base with ID ${baseId}`, 'airtable');
    
    const airtable = configureAirtable();
    const base = airtable.base(baseId);
    
    // Try to list tables to verify base exists and is accessible
    // We'll use a different approach to verify the base and tables
    // The Airtable API doesn't have a direct method to list all tables
    // So we'll try to access each table we need using the table() method
    
    const tablesToCheck = Object.keys(airtableSchema);
    const existingTables: string[] = [];
    const missingTables: string[] = [];
    
    for (const tableName of tablesToCheck) {
      try {
        // Just try to access each table to see if it exists
        // We don't actually need to fetch records yet
        await airtable.base(baseId).table(tableName).select({ maxRecords: 1 }).firstPage();
        existingTables.push(tableName);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('table not found') || errorMessage.includes('NOT_FOUND')) {
          missingTables.push(tableName);
        } else {
          // If it's another kind of error, rethrow it
          throw error;
        }
      }
    }
    
    if (existingTables.length === 0) {
      return {
        valid: false,
        message: 'The base was found but doesn\'t contain any of the required tables. You need to create the tables manually in the Airtable UI first.'
      };
    }
    
    if (missingTables.length > 0) {
      return {
        valid: false,
        message: `The base was found but is missing these tables: ${missingTables.join(', ')}. You need to create them manually in the Airtable UI.`,
        existingTables,
        missingTables
      };
    }
    
    return {
      valid: true,
      message: 'Airtable base validated successfully. All required tables found.'
    };
  } catch (error) {
    log(`Error validating Airtable base: ${error}`, 'airtable');
    
    // Check for specific error messages to provide better guidance
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('Could not find')) {
      return {
        valid: false,
        message: 'Base ID not found. Please verify your AIRTABLE_BASE_ID environment variable.'
      };
    } else if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('invalid API key')) {
      return {
        valid: false,
        message: 'Invalid API key. Please verify your AIRTABLE_API_KEY environment variable.'
      };
    } else if (errorMessage.includes('FORBIDDEN') || errorMessage.includes('not authorized')) {
      return {
        valid: false,
        message: 'Your API key doesn\'t have permission to access this base. Check your access permissions.'
      };
    }
    
    return {
      valid: false,
      message: `Validation error: ${errorMessage}`
    };
  }
}

/**
 * Create fields in a table if they don't exist
 * @param baseId Airtable base ID
 * @param tableName Table name
 * @returns Promise with success status
 */
export async function ensureTableFields(baseId: string, tableName: string): Promise<boolean> {
  try {
    log(`Ensuring fields exist for table ${tableName}`, 'airtable');
    
    // This requires Airtable schema endpoint access, which might not be available with all API keys
    // This is a placeholder for future implementation if needed
    
    return true;
  } catch (error) {
    log(`Error ensuring table fields: ${error}`, 'airtable');
    return false;
  }
}

/**
 * Comprehensive setup function for Airtable integration
 * @returns Promise with setup results
 */
export async function setupAirtableIntegration(): Promise<{ 
  success: boolean; 
  message: string;
  baseValidation?: { 
    valid: boolean; 
    message: string;
    existingTables?: string[];
    missingTables?: string[];
  };
}> {
  try {
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
      return {
        success: false,
        message: 'Airtable API key or base ID not set. Please provide these environment variables.'
      };
    }
    
    // Validate the base and all required tables
    const baseValidation = await validateAirtableBase(process.env.AIRTABLE_BASE_ID);
    
    if (!baseValidation.valid) {
      return {
        success: false,
        message: `Airtable setup validation failed: ${baseValidation.message}`,
        baseValidation
      };
    }
    
    // If valid, return success
    return {
      success: true,
      message: 'Airtable integration setup successfully',
      baseValidation
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Airtable setup error: ${errorMessage}`, 'airtable');
    
    return {
      success: false,
      message: `Airtable setup error: ${errorMessage}`
    };
  }
}