import Airtable from 'airtable';
import { Lead } from '../shared/schema';

/**
 * Format a date for Airtable
 * Airtable requires dates to be in YYYY-MM-DD format for the Date field type
 */
function formatDateForAirtable(dateValue: Date | string | null): string | null {
  if (!dateValue) return null;
  
  try {
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    
    // Ensure it's a valid date
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // Format as YYYY-MM-DD which is what Airtable Date fields expect
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error formatting date for Airtable:', error);
    return null;
  }
}

// Get or create the Airtable client
function getAirtableClient() {
  const apiKey = process.env.AIRTABLE_PAT;
  if (!apiKey) {
    throw new Error('Airtable PAT is required. Please set AIRTABLE_PAT environment variable.');
  }
  
  return new Airtable({ apiKey });
}

// Get the Airtable base using the configured base ID
function getBase(baseId = process.env.AIRTABLE_BASE_ID) {
  if (!baseId) {
    throw new Error('Airtable Base ID is required. Please set AIRTABLE_BASE_ID environment variable.');
  }
  const client = getAirtableClient();
  return client.base(baseId);
}

// Table name for leads in Airtable
const LEADS_TABLE = 'Leads';

// Expected field names in the Airtable Leads table
const EXPECTED_FIELDS = [
  'PostgreSQL_ID',
  'firstName',
  'lastName',
  'email',
  'company',
  'title',
  'phoneNumber', // Match our schema field name
  'website',
  'status',
  'source',
  'notes',
  'priority',
  'tags',
  'lastContactDate' // Match our schema field name
];

/**
 * Check if Leads table exists and has the necessary fields
 * If the table doesn't exist, we'll catch this elsewhere
 * If fields don't exist, this will just continue and let the create/update methods show the specific errors
 */
async function checkLeadsTableStructure() {
  try {
    const base = getBase();
    
    // First, try to access the Leads table to see if it exists
    const table = base(LEADS_TABLE);
    
    // Get a single record to see if the table exists
    // This will throw an error if the table doesn't exist
    await table.select({ maxRecords: 1 }).firstPage();
    
    // If we get here, the table exists
    return true;
  } catch (error) {
    // Rethrow the error for the caller to handle
    throw error;
  }
}

/**
 * Syncs PostgreSQL leads to Airtable
 * Creates or updates records in Airtable based on the leads from PostgreSQL
 * @returns The number of records created or updated, or throws an error
 */
export async function syncLeadsToAirtable(leads: Lead[]): Promise<{ count: number, error?: string }> {
  try {
    // Check if Leads table exists
    await checkLeadsTableStructure();
    
    const base = getBase();
    const table = base(LEADS_TABLE);
    
    // First, try to get existing records
    let existingRecords;
    let fieldErrorDetected = false;
    let fieldErrorMessage = '';
    
    try {
      existingRecords = await table.select({
        fields: ['email', 'PostgreSQL_ID'] // Just need these fields for matching
      }).all();
    } catch (error) {
      // If this fails because of unknown field names, capture the error
      console.log('Could not fetch existing records, assuming none exist:', error.message);
      
      if (error.message && error.message.includes('Unknown field name')) {
        fieldErrorDetected = true;
        fieldErrorMessage = error.message;
        
        // If we can't even find the PostgreSQL_ID field, we should fail explicitly
        if (error.message.includes('PostgreSQL_ID')) {
          throw new Error(error.message); // Rethrow to be handled by caller
        }
      }
      
      existingRecords = [];
    }
    
    // Create a map for efficient lookups
    const existingLeadMap = new Map();
    existingRecords.forEach(record => {
      // Map by PostgreSQL_ID if it exists
      const pgId = record.fields.PostgreSQL_ID;
      if (pgId) existingLeadMap.set(pgId.toString(), record.id);
      
      // Also map by email as fallback
      const email = record.fields.email;
      if (email && !existingLeadMap.has(email.toString().toLowerCase())) {
        existingLeadMap.set(email.toString().toLowerCase(), record.id);
      }
    });
    
    // Prepare batch operations for Airtable
    const recordsToCreate = [];
    const recordsToUpdate = [];
    
    for (const lead of leads) {
      // Format the tags - handle both string and array formats
      let formattedTags = '';
      if (lead.tags) {
        // Handle array format
        if (Array.isArray(lead.tags)) {
          formattedTags = lead.tags.join(', ');
        } 
        // Handle JSON string format that needs to be parsed
        else if (typeof lead.tags === 'string' && (lead.tags.startsWith('[') || lead.tags.includes(','))) {
          try {
            // Try to parse as JSON if it looks like an array
            if (lead.tags.startsWith('[')) {
              const tagsArray = JSON.parse(lead.tags);
              formattedTags = Array.isArray(tagsArray) ? tagsArray.join(', ') : lead.tags;
            } else {
              // Already comma-separated
              formattedTags = lead.tags;
            }
          } catch (e) {
            // If parsing fails, use as is
            formattedTags = lead.tags;
          }
        } else {
          // Simple string, use as is
          formattedTags = lead.tags;
        }
      }
      
      // Convert PostgreSQL lead to Airtable format
      const leadData = {
        PostgreSQL_ID: lead.id.toString(),
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email || '', // Ensure email is always a string, never null or undefined
        company: lead.company || '',
        title: lead.title || '',
        phoneNumber: lead.phoneNumber || '', // Field name matches EXPECTED_FIELDS
        website: lead.website || '',
        status: lead.status || 'new',
        source: lead.source || '',
        notes: lead.notes || '',
        priority: lead.priority || 'medium',
        tags: formattedTags, // Now always a comma-separated string
        // Format the date for Airtable - must be in YYYY-MM-DD format for the Date field type
        lastContactDate: lead.lastContactDate ? formatDateForAirtable(lead.lastContactDate) : null
      };
      
      // Check if this lead already exists in Airtable
      const existingId = existingLeadMap.get(lead.id.toString()) || 
                        existingLeadMap.get(lead.email.toLowerCase());
      
      if (existingId) {
        // Update the existing record
        recordsToUpdate.push({
          id: existingId,
          fields: leadData
        });
      } else {
        // Create a new record
        recordsToCreate.push({
          fields: leadData
        });
      }
    }
    
    // Execute batch operations in chunks to respect Airtable API limits
    const createChunks = chunkArray(recordsToCreate, 10); // Max 10 records per create request
    const updateChunks = chunkArray(recordsToUpdate, 10); // Max 10 records per update request
    
    let created = 0;
    let updated = 0;
    let createError = '';
    let updateError = '';
    
    // Process all create operations
    for (const chunk of createChunks) {
      if (chunk.length > 0) {
        try {
          const result = await table.create(chunk);
          created += result.length;
        } catch (error) {
          console.error('Error creating records in Airtable:', error.message);
          // Capture the first error message
          if (!createError && error.message) {
            createError = error.message;
            
            // If we hit a field not found error, propagate it
            if (error.message.includes('Unknown field name')) {
              throw new Error(error.message);
            }
          }
        }
      }
    }
    
    // Process all update operations
    for (const chunk of updateChunks) {
      if (chunk.length > 0) {
        try {
          const result = await table.update(chunk);
          updated += result.length;
        } catch (error) {
          console.error('Error updating records in Airtable:', error.message);
          // Capture the first error message
          if (!updateError && error.message) {
            updateError = error.message;
            
            // If we hit a field not found error, propagate it
            if (error.message.includes('Unknown field name')) {
              throw new Error(error.message);
            }
          }
        }
      }
    }
    
    console.log(`Airtable sync completed: ${created} records created, ${updated} records updated`);
    
    // If we had a field error but still completed some operations, we should warn
    if (fieldErrorDetected && (created > 0 || updated > 0)) {
      return { count: created + updated, error: fieldErrorMessage };
    }
    
    // If no records were processed but we detected a field error, something went wrong
    if (created === 0 && updated === 0 && (fieldErrorDetected || createError || updateError)) {
      const errorMsg = fieldErrorMessage || createError || updateError;
      throw new Error(errorMsg || 'Failed to sync any records but no specific error was detected');
    }
    
    return { count: created + updated };
  } catch (error) {
    console.error('Error syncing leads to Airtable:', error);
    throw new Error(`Failed to sync leads to Airtable: ${error.message}`);
  }
}

/**
 * Syncs leads from Airtable to PostgreSQL
 * Returns leads from Airtable that can be imported into PostgreSQL
 */
export async function getLeadsFromAirtable(): Promise<Partial<Lead>[]> {
  try {
    const base = getBase();
    const records = await base(LEADS_TABLE).select().all();
    
    return records.map(record => {
      const fields = record.fields;
      
      // Convert Airtable record to Lead format
      return {
        id: fields.PostgreSQL_ID ? parseInt(fields.PostgreSQL_ID as string, 10) : undefined,
        firstName: fields.firstName as string || '',
        lastName: fields.lastName as string || '',
        email: fields.email as string || '',
        company: fields.company as string || '',
        title: fields.title as string || '',
        phoneNumber: fields.phoneNumber as string || '', // Use correct field name
        website: fields.website as string || '',
        status: fields.status as string || 'new',
        source: fields.source as string || 'airtable',
        notes: fields.notes as string || '',
        priority: fields.priority as string || 'medium',
        tags: fields.tags as string || '',
        lastContactDate: fields.lastContactDate ? new Date(fields.lastContactDate as string) : null, // Use correct field name
        // Add this so we can track which records came from Airtable
        airtableId: record.id
      };
    });
  } catch (error) {
    console.error('Error getting leads from Airtable:', error);
    throw new Error(`Failed to get leads from Airtable: ${error.message}`);
  }
}

/**
 * Helper function to split an array into chunks of specified size
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}