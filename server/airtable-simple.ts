import Airtable from 'airtable';
import { Lead } from '../shared/schema';

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

/**
 * Syncs PostgreSQL leads to Airtable
 * Creates or updates records in Airtable based on the leads from PostgreSQL
 */
export async function syncLeadsToAirtable(leads: Lead[]): Promise<number> {
  try {
    const base = getBase();
    const table = base(LEADS_TABLE);
    
    // First, get existing records to determine which to update vs. create
    const existingRecords = await table.select({
      fields: ['email', 'PostgreSQL_ID'] // Just need these fields for matching
    }).all();
    
    // Create a map for efficient lookups
    const existingLeadMap = new Map();
    existingRecords.forEach(record => {
      // Map by PostgreSQL_ID
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
      // Convert PostgreSQL lead to Airtable format
      const leadData = {
        PostgreSQL_ID: lead.id.toString(),
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        company: lead.company || '',
        title: lead.title || '',
        phone: lead.phone || '',
        website: lead.website || '',
        status: lead.status || 'new',
        source: lead.source || '',
        notes: lead.notes || '',
        priority: lead.priority || 'medium',
        tags: lead.tags || '',
        lastContact: lead.lastContact ? new Date(lead.lastContact).toISOString() : null
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
    
    // Process all create operations
    for (const chunk of createChunks) {
      if (chunk.length > 0) {
        const result = await table.create(chunk);
        created += result.length;
      }
    }
    
    // Process all update operations
    for (const chunk of updateChunks) {
      if (chunk.length > 0) {
        const result = await table.update(chunk);
        updated += result.length;
      }
    }
    
    console.log(`Airtable sync completed: ${created} records created, ${updated} records updated`);
    return created + updated;
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
        phone: fields.phone as string || '',
        website: fields.website as string || '',
        status: fields.status as string || 'new',
        source: fields.source as string || 'airtable',
        notes: fields.notes as string || '',
        priority: fields.priority as string || 'medium',
        tags: fields.tags as string || '',
        lastContact: fields.lastContact ? new Date(fields.lastContact as string) : null,
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