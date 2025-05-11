import Airtable from 'airtable';
import { Lead, LeadEnrichment, EmailDraft, Campaign } from '../shared/schema';

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
    throw new Error('Airtable Base ID is required. Please provide it as a parameter or set AIRTABLE_BASE_ID environment variable.');
  }
  
  return airtableClient.base(baseId);
}

/**
 * List tables in an Airtable base
 */
export async function listTables(baseId?: string): Promise<string[]> {
  try {
    const base = getBase(baseId);
    
    // Note: This is a workaround as the TypeScript types for Airtable
    // don't include the tables() method, which is actually available in the API
    // @ts-ignore - tables() is available in the API but not in types
    const tables = await base.tables();
    return tables.map((table: any) => table.name);
  } catch (error: any) {
    console.error('Error listing Airtable tables:', error);
    throw new Error(`Failed to list Airtable tables: ${error.message}`);
  }
}

/**
 * Get records from an Airtable table
 */
export async function getRecords(tableName: string, baseId?: string): Promise<any[]> {
  try {
    const base = getBase(baseId);
    const records = await base(tableName).select().all();
    
    return records.map(record => ({
      id: record.id,
      ...record.fields
    }));
  } catch (error: any) {
    console.error(`Error getting records from ${tableName}:`, error);
    throw new Error(`Failed to get records from Airtable table ${tableName}: ${error.message}`);
  }
}

/**
 * Create a record in an Airtable table
 */
export async function createRecord(tableName: string, data: Record<string, any>, baseId?: string): Promise<any> {
  try {
    const base = getBase(baseId);
    const createdRecord = await base(tableName).create([{ fields: data }]);
    
    if (createdRecord && createdRecord.length > 0) {
      return {
        id: createdRecord[0].id,
        ...createdRecord[0].fields
      };
    }
    
    throw new Error('Failed to create record');
  } catch (error: any) {
    console.error(`Error creating record in ${tableName}:`, error);
    throw new Error(`Failed to create record in Airtable table ${tableName}: ${error.message}`);
  }
}

/**
 * Update a record in an Airtable table
 */
export async function updateRecord(tableName: string, recordId: string, data: Record<string, any>, baseId?: string): Promise<any> {
  try {
    const base = getBase(baseId);
    const updatedRecord = await base(tableName).update([{ id: recordId, fields: data }]);
    
    if (updatedRecord && updatedRecord.length > 0) {
      return {
        id: updatedRecord[0].id,
        ...updatedRecord[0].fields
      };
    }
    
    throw new Error('Failed to update record');
  } catch (error: any) {
    console.error(`Error updating record in ${tableName}:`, error);
    throw new Error(`Failed to update record in Airtable table ${tableName}: ${error.message}`);
  }
}

/**
 * Delete a record from an Airtable table
 */
export async function deleteRecord(tableName: string, recordId: string, baseId?: string): Promise<boolean> {
  try {
    const base = getBase(baseId);
    await base(tableName).destroy([recordId]);
    return true;
  } catch (error: any) {
    console.error(`Error deleting record from ${tableName}:`, error);
    throw new Error(`Failed to delete record from Airtable table ${tableName}: ${error.message}`);
  }
}

/**
 * Sync leads from PostgreSQL to Airtable
 */
export async function syncLeadsToAirtable(leads: Lead[], tableName: string = 'Leads', baseId?: string): Promise<any[]> {
  try {
    // First, fetch existing Airtable records to determine which to create/update
    const base = getBase(baseId);
    const existingRecords = await base(tableName).select().all();
    
    // Map existing records by email for easy lookup
    const existingRecordsByEmail = new Map();
    existingRecords.forEach(record => {
      const email = record.fields.email as string;
      if (email) {
        existingRecordsByEmail.set(email.toLowerCase(), record);
      }
    });
    
    const results = [];
    
    // Process each lead
    for (const lead of leads) {
      const leadData = {
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
      };
      
      // Check if this lead already exists in Airtable
      const existingRecord = existingRecordsByEmail.get(lead.email.toLowerCase());
      
      if (existingRecord) {
        // Update existing record
        const updatedRecord = await base(tableName).update([
          { id: existingRecord.id, fields: leadData }
        ]);
        results.push(updatedRecord[0]);
      } else {
        // Create new record
        const newRecord = await base(tableName).create([
          { fields: leadData }
        ]);
        results.push(newRecord[0]);
      }
    }
    
    return results.map(record => ({
      id: record.id,
      ...record.fields
    }));
  } catch (error: any) {
    console.error('Error syncing leads to Airtable:', error);
    throw new Error(`Failed to sync leads to Airtable: ${error.message}`);
  }
}

/**
 * Sync leads from Airtable to PostgreSQL
 */
export async function syncLeadsFromAirtable(tableName: string = 'Leads', baseId?: string): Promise<Lead[]> {
  try {
    const base = getBase(baseId);
    const records = await base(tableName).select().all();
    
    return records.map(record => {
      const fields = record.fields;
      
      // Convert Airtable record to Lead format
      return {
        id: fields.PostgreSQL_ID ? parseInt(fields.PostgreSQL_ID as string, 10) : null,
        firstName: fields.firstName as string || '',
        lastName: fields.lastName as string || '',
        email: fields.email as string || '',
        company: fields.company as string || '',
        title: fields.title as string || '',
        phone: fields.phone as string || '',
        website: fields.website as string || '',
        status: fields.status as string || 'new',
        source: fields.source as string || 'airtable',
        lastContact: fields.lastContact ? new Date(fields.lastContact as string) : null,
        createdAt: fields.createdAt ? new Date(fields.createdAt as string) : new Date(),
        updatedAt: fields.updatedAt ? new Date(fields.updatedAt as string) : new Date(),
        notes: fields.notes as string || '',
        priority: fields.priority as string || 'medium',
        tags: fields.tags as string || '',
        airtableId: record.id // Store the Airtable record ID for future syncing
      };
    });
  } catch (error: any) {
    console.error('Error syncing leads from Airtable:', error);
    throw new Error(`Failed to sync leads from Airtable: ${error.message}`);
  }
}

/**
 * Sync lead enrichment data to Airtable
 */
export async function syncLeadEnrichmentToAirtable(
  leadId: number, 
  enrichment: LeadEnrichment, 
  tableName: string = 'Lead_Enrichment',
  baseId?: string
): Promise<any> {
  try {
    const base = getBase(baseId);
    
    // First, check if this lead's enrichment already exists in Airtable
    const existingRecords = await base(tableName)
      .select({
        filterByFormula: `{PostgreSQL_Lead_ID} = '${leadId}'`
      })
      .all();
    
    const enrichmentData = {
      PostgreSQL_Lead_ID: leadId.toString(),
      company_info: JSON.stringify(enrichment.companyInfo),
      tech_stack: JSON.stringify(enrichment.techStack),
      recent_events: JSON.stringify(enrichment.recentEvents),
      insights: enrichment.insights ? JSON.stringify(enrichment.insights) : '',
      personalization_hooks: enrichment.personalizationHooks ? JSON.stringify(enrichment.personalizationHooks) : '',
      use_enhanced_scraping: enrichment.useEnhancedScraping ? 'true' : 'false'
    };
    
    if (existingRecords.length > 0) {
      // Update existing record
      const updatedRecord = await base(tableName).update([
        { id: existingRecords[0].id, fields: enrichmentData }
      ]);
      
      return {
        id: updatedRecord[0].id,
        ...updatedRecord[0].fields
      };
    } else {
      // Create new record
      const newRecord = await base(tableName).create([
        { fields: enrichmentData }
      ]);
      
      return {
        id: newRecord[0].id,
        ...newRecord[0].fields
      };
    }
  } catch (error: any) {
    console.error('Error syncing lead enrichment to Airtable:', error);
    throw new Error(`Failed to sync lead enrichment to Airtable: ${error.message}`);
  }
}

/**
 * Sync email drafts to Airtable
 */
export async function syncEmailDraftsToAirtable(
  drafts: EmailDraft[], 
  tableName: string = 'Email_Drafts',
  baseId?: string
): Promise<any[]> {
  try {
    const base = getBase(baseId);
    const results = [];
    
    for (const draft of drafts) {
      // First, check if this draft already exists in Airtable
      const existingRecords = await base(tableName)
        .select({
          filterByFormula: `{PostgreSQL_Draft_ID} = '${draft.id}'`
        })
        .all();
      
      const draftData = {
        PostgreSQL_Draft_ID: draft.id.toString(),
        PostgreSQL_Lead_ID: draft.leadId.toString(),
        subject: draft.subject || '',
        body: draft.body || '',
        campaignPurpose: draft.campaignPurpose || '',
        serviceOffering: draft.serviceOffering || '',
        status: draft.status || 'draft',
        scheduledDate: draft.scheduledDate ? new Date(draft.scheduledDate).toISOString() : null,
        sentDate: draft.sentDate ? new Date(draft.sentDate).toISOString() : null
      };
      
      if (existingRecords.length > 0) {
        // Update existing record
        const updatedRecord = await base(tableName).update([
          { id: existingRecords[0].id, fields: draftData }
        ]);
        
        results.push({
          id: updatedRecord[0].id,
          ...updatedRecord[0].fields
        });
      } else {
        // Create new record
        const newRecord = await base(tableName).create([
          { fields: draftData }
        ]);
        
        results.push({
          id: newRecord[0].id,
          ...newRecord[0].fields
        });
      }
    }
    
    return results;
  } catch (error: any) {
    console.error('Error syncing email drafts to Airtable:', error);
    throw new Error(`Failed to sync email drafts to Airtable: ${error.message}`);
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
    const base = getBase(baseId);
    const results = [];
    
    for (const campaign of campaigns) {
      // First, check if this campaign already exists in Airtable
      const existingRecords = await base(tableName)
        .select({
          filterByFormula: `{PostgreSQL_Campaign_ID} = '${campaign.id}'`
        })
        .all();
      
      const campaignData = {
        PostgreSQL_Campaign_ID: campaign.id.toString(),
        name: campaign.name || '',
        description: campaign.description || '',
        type: campaign.type || '',
        status: campaign.status || '',
        startDate: campaign.startDate ? new Date(campaign.startDate).toISOString() : null,
        endDate: campaign.endDate ? new Date(campaign.endDate).toISOString() : null,
        goal: campaign.goal || '',
        budget: campaign.budget ? campaign.budget.toString() : '',
        results: campaign.results || '',
        tags: campaign.tags || ''
      };
      
      if (existingRecords.length > 0) {
        // Update existing record
        const updatedRecord = await base(tableName).update([
          { id: existingRecords[0].id, fields: campaignData }
        ]);
        
        results.push({
          id: updatedRecord[0].id,
          ...updatedRecord[0].fields
        });
      } else {
        // Create new record
        const newRecord = await base(tableName).create([
          { fields: campaignData }
        ]);
        
        results.push({
          id: newRecord[0].id,
          ...newRecord[0].fields
        });
      }
    }
    
    return results;
  } catch (error: any) {
    console.error('Error syncing campaigns to Airtable:', error);
    throw new Error(`Failed to sync campaigns to Airtable: ${error.message}`);
  }
}

// Export the Airtable client and base for direct access if needed
export { airtableClient, getBase };