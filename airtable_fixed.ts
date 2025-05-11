import axios from 'axios';
import Airtable from 'airtable';
import { Campaign, Lead } from '@shared/schema';

// PAT = Personal Access Token
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;

// Hard-coded Airtable Base ID - no fallbacks or user input needed
const AIRTABLE_BASE_ID = 'appUPDttFgRrz9YiC';

if (!AIRTABLE_PAT) {
  console.warn('Airtable PAT not set in environment variables');
}

// Configure Airtable SDK
const airtableClient = new Airtable({
  apiKey: AIRTABLE_PAT,
});

/**
 * Get the configured base using the hard-coded Airtable Base ID
 * 
 * Using the specific Airtable base ID 'appUPDttFgRrz9YiC' for all operations
 */
function getBase() {
  if (!AIRTABLE_PAT) {
    throw new Error('Airtable personal access token is not set');
  }
  
  return airtableClient.base(AIRTABLE_BASE_ID);
}

/**
 * Direct API call to Airtable using axios
 * This provides more flexibility than the Airtable SDK in some cases
 */
export async function callAirtableApi(
  endpoint: string,
  method: string = 'GET',
  data: any = null
): Promise<any> {
  if (!AIRTABLE_PAT) {
    throw new Error('Airtable personal access token is not set');
  }

  // Hard-coded Airtable Base ID
  const baseId = AIRTABLE_BASE_ID;
  
  try {
    const url = `https://api.airtable.com/v0/${baseId}/${endpoint}`;
    
    const response = await axios({
      method,
      url,
      headers: {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      data,
    });
    
    return response.data;
  } catch (error) {
    console.error(`Airtable API error (${method} ${endpoint}):`, error);
    throw error;
  }
}

/**
 * List tables in an Airtable base
 */
export async function listAirtableTables(): Promise<string[]> {
  try {
    // Get schema for the base which contains tables info
    const response = await callAirtableApi('', 'GET', null);
    
    if (response && response.tables) {
      return response.tables.map(record => record.name);
    }
    
    return [];
  } catch (error) {
    console.error('Error listing Airtable tables:', error);
    throw error;
  }
}

/**
 * Get records from an Airtable table
 */
export async function getAirtableRecords(tableName: string): Promise<any[]> {
  try {
    const response = await callAirtableApi(`${tableName}?maxRecords=100`, 'GET', null);
    return response.records || [];
  } catch (error) {
    console.error(`Error fetching Airtable records from ${tableName}:`, error);
    return [];
  }
}

/**
 * Sync leads from PostgreSQL to Airtable
 * Creates a "Leads" table if it doesn't exist, or updates existing records
 */
export async function syncLeadsToAirtable(leads: Lead[], tableName: string = 'Leads'): Promise<any[]> {
  try {
    // First, check if the table exists and get existing records
    let existingRecords = [];
    try {
      const response = await callAirtableApi(`${tableName}?maxRecords=100`, 'GET', null);
      existingRecords = response.records || [];
    } catch (error) {
      // If the table doesn't exist, we'll create it when we add the first record
      console.log(`Table ${tableName} not found, will create when adding first record`);
    }
    
    // Map existing records by email for easy lookup
    const existingRecordsByEmail = {};
    existingRecords.forEach(record => {
      if (record.fields.email) {
        existingRecordsByEmail[record.fields.email] = record;
      }
    });
    
    // Prepare batches of records for update and create
    const recordsToUpdate = [];
    const recordsToCreate = [];
    
    leads.forEach(lead => {
      // Map lead data to Airtable fields
      const fields = {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        company: lead.company,
        title: lead.title,
        phone: lead.phoneNumber, // Map phoneNumber to phone in Airtable
        website: lead.website,
        status: lead.status,
        source: lead.source,
        lastContact: lead.lastContactDate ? new Date(lead.lastContactDate).toISOString() : null,
        createdAt: lead.createdAt ? new Date(lead.createdAt).toISOString() : new Date().toISOString(),
        notes: lead.notes,
        priority: lead.priority,
        tags: lead.tags,
        id: lead.id.toString() // Store the PostgreSQL ID for reference
      };
      
      // Check if record exists by email
      if (existingRecordsByEmail[lead.email]) {
        // Update existing record
        recordsToUpdate.push({
          id: existingRecordsByEmail[lead.email].id,
          fields
        });
      } else {
        // Create new record
        recordsToCreate.push({
          fields
        });
      }
    });
    
    // Process updates
    let updatedRecords = [];
    if (recordsToUpdate.length > 0) {
      try {
        // Batch updates in groups of 10 (Airtable limit)
        for (let i = 0; i < recordsToUpdate.length; i += 10) {
          const batch = recordsToUpdate.slice(i, i + 10);
          const response = await callAirtableApi(tableName, 'PATCH', { records: batch });
          updatedRecords = updatedRecords.concat(response.records || []);
        }
      } catch (error) {
        console.error('Error updating Airtable records:', error);
      }
    }
    
    // Process creates
    let createdRecords = [];
    if (recordsToCreate.length > 0) {
      try {
        // Batch creates in groups of 10 (Airtable limit)
        for (let i = 0; i < recordsToCreate.length; i += 10) {
          const batch = recordsToCreate.slice(i, i + 10);
          const response = await callAirtableApi(tableName, 'POST', { records: batch });
          createdRecords = createdRecords.concat(response.records || []);
        }
      } catch (error) {
        console.error('Error creating Airtable records:', error);
      }
    }
    
    return [...updatedRecords, ...createdRecords];
  } catch (error) {
    console.error('Error syncing leads to Airtable:', error);
    throw error;
  }
}

/**
 * Sync leads from Airtable to PostgreSQL
 */
export async function syncLeadsFromAirtable(tableName: string = 'Leads'): Promise<Lead[]> {
  try {
    const records = await getAirtableRecords(tableName);
    
    // Map Airtable records to Lead objects
    return records.map(record => {
      const fields = record.fields;
      
      // Create Lead object with mapped fields
      return {
        id: fields.id ? parseInt(fields.id, 10) : null,
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email,
        company: fields.company,
        title: fields.title,
        phone: fields.phone, // will be mapped to phoneNumber
        website: fields.website,
        status: fields.status,
        source: fields.source,
        lastContact: fields.lastContact ? new Date(fields.lastContact) : null,
        createdAt: fields.createdAt ? new Date(fields.createdAt) : new Date(),
        updatedAt: new Date(),
        notes: fields.notes,
        priority: fields.priority,
        tags: fields.tags,
        airtableId: record.id
      } as any; // Type cast as any to bypass strict property checks
    });
  } catch (error) {
    console.error('Error syncing leads from Airtable:', error);
    throw error;
  }
}

/**
 * Sync campaigns to Airtable
 */
export async function syncCampaignsToAirtable(
  campaigns: Campaign[],
  tableName: string = 'Campaigns'
): Promise<any[]> {
  try {
    // First, check if the table exists and get existing records
    let existingRecords = [];
    try {
      const response = await callAirtableApi(`${tableName}?maxRecords=100`, 'GET', null);
      existingRecords = response.records || [];
    } catch (error) {
      // If the table doesn't exist, we'll create it when we add the first record
      console.log(`Table ${tableName} not found, will create when adding first record`);
    }
    
    // Map existing records by name for easy lookup
    const existingRecordsByName = {};
    existingRecords.forEach(record => {
      if (record.fields.name) {
        existingRecordsByName[record.fields.name] = record;
      }
    });
    
    // Prepare batches of records for update and create
    const recordsToUpdate = [];
    const recordsToCreate = [];
    
    campaigns.forEach(campaign => {
      // Map campaign data to Airtable fields
      const fields = {
        name: campaign.name,
        description: campaign.description,
        active: campaign.isActive ? 'Yes' : 'No',
        type: campaign.type,
        segmentFilters: JSON.stringify(campaign.segmentFilters),
        createdAt: campaign.createdAt.toISOString(),
        id: campaign.id.toString() // Store the PostgreSQL ID for reference
      };
      
      // Check if record exists by name
      if (existingRecordsByName[campaign.name]) {
        // Update existing record
        recordsToUpdate.push({
          id: existingRecordsByName[campaign.name].id,
          fields
        });
      } else {
        // Create new record
        recordsToCreate.push({
          fields
        });
      }
    });
    
    // Process updates
    let updatedRecords = [];
    if (recordsToUpdate.length > 0) {
      try {
        // Batch updates in groups of 10 (Airtable limit)
        for (let i = 0; i < recordsToUpdate.length; i += 10) {
          const batch = recordsToUpdate.slice(i, i + 10);
          const response = await callAirtableApi(
            tableName,
            'PATCH',
            { records: batch }
          );
          updatedRecords = updatedRecords.concat(response.records || []);
        }
      } catch (error) {
        console.error('Error updating Airtable campaign records:', error);
      }
    }
    
    // Process creates
    let createdRecords = [];
    if (recordsToCreate.length > 0) {
      try {
        // Batch creates in groups of 10 (Airtable limit)
        for (let i = 0; i < recordsToCreate.length; i += 10) {
          const batch = recordsToCreate.slice(i, i + 10);
          const response = await callAirtableApi(
            tableName,
            'POST',
            { records: batch }
          );
          createdRecords = createdRecords.concat(response.records || []);
        }
      } catch (error) {
        console.error('Error creating Airtable campaign records:', error);
      }
    }
    
    return [...updatedRecords, ...createdRecords];
  } catch (error) {
    console.error('Error syncing campaigns to Airtable:', error);
    throw error;
  }
}

/**
 * Sync campaigns from Airtable to PostgreSQL
 */
export async function syncCampaignsFromAirtable(tableName: string = 'Campaigns'): Promise<Campaign[]> {
  try {
    const records = await getAirtableRecords(tableName);
    
    // Map Airtable records to Campaign objects
    return records.map(record => {
      const fields = record.fields;
      
      // Parse segmentFilters if it exists and is a string
      let segmentFilters;
      try {
        segmentFilters = fields.segmentFilters ? JSON.parse(fields.segmentFilters) : null;
      } catch (e) {
        segmentFilters = fields.segmentFilters; // Keep as is if not valid JSON
      }
      
      // Create Campaign object with mapped fields
      return {
        id: fields.id ? parseInt(fields.id, 10) : null,
        name: fields.name,
        description: fields.description || null,
        isActive: fields.active === 'Yes',
        createdAt: fields.createdAt ? new Date(fields.createdAt) : new Date(),
        updatedAt: new Date(),
        segmentFilters
      } as any; // Type cast as any to bypass strict property checks
    });
  } catch (error) {
    console.error('Error syncing campaigns from Airtable:', error);
    throw error;
  }
}

/**
 * Validates Airtable access by checking if we can list the tables in a base
 * This helps catch permission issues early before attempting data operations
 */
export async function validateAirtableAccess(): Promise<{success: boolean, message?: string}> {
  try {
    // Hard-coded Airtable Base ID - no fallbacks or user input needed
    const AIRTABLE_BASE_ID = 'appUPDttFgRrz9YiC';
    
    if (!AIRTABLE_PAT) {
      return {
        success: false,
        message: 'Airtable Personal Access Token is not set in the environment'
      };
    }
    
    // Try to list tables to check access
    const tables = await listAirtableTables();
    
    return {
      success: true,
      message: `Successfully connected to Airtable. Found ${tables.length} tables.`
    };
  } catch (error) {
    console.error('Airtable validation error:', error);
    
    // Provide a helpful error message
    let message = 'Failed to connect to Airtable. ';
    
    if (error.response) {
      // Server returned an error response
      if (error.response.status === 401 || error.response.status === 403) {
        message += 'Invalid or expired Airtable token. Please check your AIRTABLE_PAT environment variable.';
      } else if (error.response.status === 404) {
        message += `Base with ID ${AIRTABLE_BASE_ID} not found or you don't have access to it.`;
      } else {
        message += `Server returned status ${error.response.status}: ${error.response.statusText}`;
      }
    } else if (error.request) {
      // Request was made but no response received
      message += 'No response received from Airtable. Please check your network connection.';
    } else {
      // Something else went wrong
      message += `Error: ${error.message}`;
    }
    
    return {
      success: false,
      message
    };
  }
}