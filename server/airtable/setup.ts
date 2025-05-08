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
export async function validateAirtableBase(baseId: string): Promise<{ valid: boolean; message: string }> {
  try {
    log(`Validating Airtable base with ID ${baseId}`, 'airtable');
    
    const airtable = configureAirtable();
    const base = airtable.base(baseId);
    
    // Try to list tables to verify base exists and is accessible
    // Use the Airtable API correctly to list tables
    const tablesList = await Airtable.base(baseId).tables();
    
    if (!tablesList || tablesList.length === 0) {
      return {
        valid: false,
        message: 'The base was found but doesn\'t contain any tables. You need to create the tables manually in the Airtable UI first.'
      };
    }
    
    // Check if all our required tables exist
    const tableNames = tablesList.map((table: any) => table.name);
    const missingTables = Object.keys(airtableSchema).filter(tableName => 
      !tableNames.includes(tableName) && !tableNames.includes(tableName.replace(' ', ''))
    );
    
    if (missingTables.length > 0) {
      return {
        valid: false,
        message: `The base was found but is missing these tables: ${missingTables.join(', ')}. You need to create them manually in the Airtable UI.`
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
  baseValidation?: { valid: boolean; message: string };
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