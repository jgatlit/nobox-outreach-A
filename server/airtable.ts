import Airtable from 'airtable';
import axios from 'axios';
import { Lead, Campaign } from '../shared/schema';

/**
 * Airtable integration using Personal Access Token (PAT) authentication
 * This allows for bidirectional sync of leads and other data between PostgreSQL and Airtable
 */

// Initialize Airtable with the PAT
const airtableClient = new Airtable({
  apiKey: process.env.AIRTABLE_PAT,
});

/**
 * Get the configured base if a base ID is provided in environment variables,
 * otherwise it will expect the base ID to be provided as a parameter
 */
function getBase(explicitBaseId?: string) {
  const baseId = explicitBaseId || process.env.AIRTABLE_BASE_ID;
  
  if (!baseId) {
    throw new Error("No Airtable Base ID provided. Either set AIRTABLE_BASE_ID in environment variables or provide a baseId parameter.");
  }
  
  return airtableClient.base(baseId);
}

/**
 * Direct API call to Airtable using axios
 * This provides more flexibility than the Airtable SDK in some cases
 */
export async function callAirtableApi(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  data?: any,
  baseId?: string
): Promise<any> {
  const apiBaseId = baseId || process.env.AIRTABLE_BASE_ID;
  
  if (!apiBaseId) {
    throw new Error("No Airtable Base ID provided. Either set AIRTABLE_BASE_ID in environment variables or provide a baseId parameter.");
  }
  
  const url = `https://api.airtable.com/v0/${apiBaseId}/${endpoint}`;
  
  try {
    const response = await axios({
      method,
      url,
      data,
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_PAT}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Airtable API error (${method} ${url}):`, error.response?.data || error.message);
    throw new Error(`Failed to call Airtable API: ${error.message}`);
  }
}

/**
 * List tables in an Airtable base
 */
export async function listAirtableTables(baseId?: string): Promise<string[]> {
  try {
    // Using direct API call to get metadata
    const response = await callAirtableApi('', 'GET', null, baseId);
    return Object.keys(response.tables || {});
  } catch (error) {
    console.error('Error listing Airtable tables:', error);
    throw new Error(`Failed to list Airtable tables: ${error.message}`);
  }
}

/**
 * Get records from an Airtable table
 */
export async function getAirtableRecords(tableName: string, baseId?: string): Promise<any[]> {
  try {
    const response = await callAirtableApi(`${tableName}?maxRecords=100`, 'GET', null, baseId);
    return response.records.map(record => ({
      id: record.id,
      ...record.fields
    }));
  } catch (error) {
    console.error(`Error getting records from ${tableName}:`, error);
    throw new Error(`Failed to get records from Airtable table ${tableName}: ${error.message}`);
  }
}

/**
 * Sync leads from PostgreSQL to Airtable
 * Creates a "Leads" table if it doesn't exist, or updates existing records
 */
export async function syncLeadsToAirtable(leads: Lead[], tableName: string = 'Leads', baseId?: string): Promise<any[]> {
  try {
    // First, check if the table exists and get existing records
    let existingRecords = [];
    try {
      const response = await callAirtableApi(`${tableName}?maxRecords=100`, 'GET', null, baseId);
      existingRecords = response.records || [];
    } catch (error) {
      // If the table doesn't exist, we'll create it when we add the first record
      console.log(`Table ${tableName} not found, will create when adding first record`);
    }
    
    // Map existing records by email for easy lookup
    const existingRecordsByEmail = new Map();
    existingRecords.forEach(record => {
      const email = record.fields.email;
      if (email) {
        existingRecordsByEmail.set(email.toLowerCase(), record);
      }
    });
    
    const results = [];
    
    // Process each lead
    for (const lead of leads) {
      const leadData = {
        fields: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          company: lead.company || '',
          title: lead.title || '',
          phone: lead.phone || '',
          status: lead.status || '',
          source: lead.source || '',
          lastContact: lead.lastContact ? new Date(lead.lastContact).toISOString() : null,
          notes: lead.notes || '',
          priority: lead.priority || '',
          tags: lead.tags || '',
          PostgreSQL_ID: lead.id.toString(),
        }
      };
      
      // Check if this lead already exists in Airtable
      const existingRecord = existingRecordsByEmail.get(lead.email.toLowerCase());
      
      if (existingRecord) {
        // Update existing record
        const updatedRecord = await callAirtableApi(
          `${tableName}/${existingRecord.id}`,
          'PATCH',
          leadData,
          baseId
        );
        results.push(updatedRecord);
      } else {
        // Create new record
        const newRecord = await callAirtableApi(
          `${tableName}`,
          'POST',
          { records: [leadData] },
          baseId
        );
        results.push(newRecord.records[0]);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error syncing leads to Airtable:', error);
    throw new Error(`Failed to sync leads to Airtable: ${error.message}`);
  }
}

/**
 * Sync leads from Airtable to PostgreSQL
 */
export async function syncLeadsFromAirtable(tableName: string = 'Leads', baseId?: string): Promise<Lead[]> {
  try {
    const records = await getAirtableRecords(tableName, baseId);
    
    return records.map(record => {
      const fields = record;
      
      // Convert Airtable record to Lead format
      return {
        id: fields.PostgreSQL_ID ? parseInt(fields.PostgreSQL_ID, 10) : null,
        firstName: fields.firstName || '',
        lastName: fields.lastName || '',
        email: fields.email || '',
        company: fields.company || '',
        title: fields.title || '',
        phone: fields.phone || '',
        website: fields.website || '',
        status: fields.status || 'new',
        source: fields.source || 'airtable',
        lastContact: fields.lastContact ? new Date(fields.lastContact) : null,
        createdAt: fields.createdAt ? new Date(fields.createdAt) : new Date(),
        updatedAt: fields.updatedAt ? new Date(fields.updatedAt) : new Date(),
        notes: fields.notes || '',
        priority: fields.priority || 'medium',
        tags: fields.tags || '',
        airtableId: record.id // Store the Airtable record ID for future syncing
      };
    });
  } catch (error) {
    console.error('Error syncing leads from Airtable:', error);
    throw new Error(`Failed to sync leads from Airtable: ${error.message}`);
  }
}

/**
 * Sync campaigns to Airtable
 */
export async function syncCampaignsToAirtable(
  campaigns: Campaign[], 
  tableName: string = 'Campaigns',
  baseId?: string
): Promise<any[]> {
  try {
    // First, check if the table exists and get existing records
    let existingRecords = [];
    try {
      const response = await callAirtableApi(`${tableName}?maxRecords=100`, 'GET', null, baseId);
      existingRecords = response.records || [];
    } catch (error) {
      // If the table doesn't exist, we'll create it when we add the first record
      console.log(`Table ${tableName} not found, will create when adding first record`);
    }
    
    // Map existing records by PostgreSQL ID for easy lookup
    const existingRecordsById = new Map();
    existingRecords.forEach(record => {
      const postgresId = record.fields.PostgreSQL_Campaign_ID;
      if (postgresId) {
        existingRecordsById.set(postgresId, record);
      }
    });
    
    const results = [];
    
    // Process each campaign
    for (const campaign of campaigns) {
      const campaignData = {
        fields: {
          PostgreSQL_Campaign_ID: campaign.id.toString(),
          name: campaign.name || '',
          description: campaign.description || '',
          type: campaign.type || '',
          status: campaign.isActive ? 'active' : 'inactive',
          startDate: campaign.createdAt ? new Date(campaign.createdAt).toISOString() : null,
          endDate: null, // This field doesn't exist in our schema but we'll include it for completeness
          goal: '', // Not in our schema but a useful field in Airtable
          budget: '0', // Not in our schema but a useful field in Airtable
          results: '', // Not in our schema but a useful field in Airtable
          tags: Array.isArray(campaign.segmentFilters) ? JSON.stringify(campaign.segmentFilters) : ''
        }
      };
      
      // Check if this campaign already exists in Airtable
      const existingRecord = existingRecordsById.get(campaign.id.toString());
      
      if (existingRecord) {
        // Update existing record
        const updatedRecord = await callAirtableApi(
          `${tableName}/${existingRecord.id}`,
          'PATCH',
          campaignData,
          baseId
        );
        results.push(updatedRecord);
      } else {
        // Create new record
        const newRecord = await callAirtableApi(
          `${tableName}`,
          'POST',
          { records: [campaignData] },
          baseId
        );
        results.push(newRecord.records[0]);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error syncing campaigns to Airtable:', error);
    throw new Error(`Failed to sync campaigns to Airtable: ${error.message}`);
  }
}

/**
 * Sync campaigns from Airtable to PostgreSQL
 */
export async function syncCampaignsFromAirtable(tableName: string = 'Campaigns', baseId?: string): Promise<Campaign[]> {
  try {
    const records = await getAirtableRecords(tableName, baseId);
    
    return records.map(record => {
      const fields = record;
      
      // Convert Airtable record to Campaign format
      return {
        id: fields.PostgreSQL_Campaign_ID ? parseInt(fields.PostgreSQL_Campaign_ID, 10) : 0,
        name: fields.name || '',
        description: fields.description || '',
        isActive: fields.status === 'active',
        createdAt: fields.startDate ? new Date(fields.startDate) : new Date(),
        updatedAt: new Date(), // Current timestamp for the update
        segmentFilters: fields.tags 
          ? (typeof fields.tags === 'string' ? JSON.parse(fields.tags) : fields.tags) 
          : null,
        airtableId: record.id // Store the Airtable record ID for future syncing
      };
    });
  } catch (error) {
    console.error('Error syncing campaigns from Airtable:', error);
    throw new Error(`Failed to sync campaigns from Airtable: ${error.message}`);
  }
}

/**
 * Validates Airtable access by checking if we can list the tables in a base
 * This helps catch permission issues early before attempting data operations
 */
export async function validateAirtableAccess(baseId?: string): Promise<{success: boolean, message?: string}> {
  try {
    // If no base ID is provided or available in env, fail early with a clear message
    const effectiveBaseId = baseId || process.env.AIRTABLE_BASE_ID;
    if (!effectiveBaseId) {
      return {
        success: false,
        message: "No Airtable Base ID provided. Either set AIRTABLE_BASE_ID in environment variables or provide a baseId parameter."
      };
    }

    if (!process.env.AIRTABLE_PAT) {
      return {
        success: false,
        message: "Airtable Personal Access Token not found in environment variables (AIRTABLE_PAT)"
      };
    }

    // Test API access by listing tables
    await listAirtableTables(effectiveBaseId);
    
    return { success: true };
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Airtable validation error:", errorMsg);
    
    if (errorMsg.includes("403") || errorMsg.includes("INVALID_PERMISSIONS")) {
      return {
        success: false,
        message: "Invalid permissions to access Airtable base. Please check your Airtable PAT and Base ID."
      };
    } else if (errorMsg.includes("404") || errorMsg.includes("NOT_FOUND")) {
      return {
        success: false,
        message: "Airtable base not found. Please verify the Base ID is correct."
      };
    }
    
    return {
      success: false,
      message: `Failed to validate Airtable access: ${errorMsg}`
    };
  }
}

export { airtableClient, getBase };