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
      // Convert all null values to empty strings or other appropriate defaults
      // since Airtable doesn't accept null values in its API
      const leadData = {
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        email: lead.email,
        company: lead.company || '',
        title: lead.title || '',
        phoneNumber: lead.phoneNumber || '',
        status: lead.status || 'new',
        source: lead.source || 'manual',
        lastContactDate: lead.lastContactDate ? new Date(lead.lastContactDate).toISOString() : '',
        website: lead.website || '',
        notes: lead.notes || '',
        priority: lead.priority || 'medium',
        tags: Array.isArray(lead.tags) 
          ? lead.tags.join(',') 
          : (typeof lead.tags === 'string' ? lead.tags : ''),
        PostgreSQL_ID: lead.id.toString(),
      };
      
      // Check if this lead already exists in Airtable
      const existingRecord = existingRecordsByEmail.get(lead.email.toLowerCase());
      
      if (existingRecord) {
        // Update existing record
        try {
          const updatedRecord = await base(tableName).update([
            { id: existingRecord.id, fields: leadData }
          ]);
          
          // The Airtable API returns an array of records
          if (updatedRecord && updatedRecord.length > 0) {
            results.push({
              id: updatedRecord[0].id,
              ...updatedRecord[0].fields
            });
          }
        } catch (error: any) {
          console.error(`Error updating lead ${lead.email} in Airtable:`, error);
          // Continue with next lead instead of failing the entire batch
          continue;
        }
      } else {
        // Create new record
        try {
          const newRecord = await base(tableName).create([
            { fields: leadData }
          ]);
          
          // The Airtable API returns an array of records
          if (newRecord && newRecord.length > 0) {
            results.push({
              id: newRecord[0].id,
              ...newRecord[0].fields
            });
          }
        } catch (error: any) {
          console.error(`Error creating lead ${lead.email} in Airtable:`, error);
          // Continue with next lead instead of failing the entire batch
          continue;
        }
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
export async function syncLeadsFromAirtable(tableName: string = 'Leads', baseId?: string): Promise<Partial<Lead>[]> {
  try {
    const base = getBase(baseId);
    const records = await base(tableName).select().all();
    
    return records.map(record => {
      const fields = record.fields;
      
      // Safely extract and convert fields from Airtable
      const extractString = (fieldName: string): string | null => {
        const value = fields[fieldName];
        return value ? String(value) : null;
      };
      
      const extractDate = (fieldName: string): Date | null => {
        const value = fields[fieldName];
        if (!value) return null;
        
        try {
          return new Date(String(value));
        } catch {
          return null;
        }
      };
      
      // Map Airtable record to our Lead schema format
      // Handle any field name differences and data type conversions
      const idStr = extractString('PostgreSQL_ID');
      
      // Build a properly typed Lead object
      const lead: Partial<Lead> = {
        // Use existing PostgreSQL ID if available, otherwise it will be a new lead
        id: idStr ? parseInt(idStr, 10) : undefined,
        firstName: extractString('firstName'),
        lastName: extractString('lastName'),
        email: extractString('email') || '',  // email is required in our schema
        company: extractString('company'),
        title: extractString('title'),
        phoneNumber: extractString('phoneNumber') || extractString('phone'),
        website: extractString('website'),
        linkedinUrl: extractString('linkedinUrl'),
        
        // Map status, ensuring it fits our enum values
        status: (() => {
          const status = extractString('status');
          if (status && ['active', 'inactive', 'contacted', 'responded', 'qualified', 'disqualified'].includes(status)) {
            return status as any; // Cast to allow assignment to Lead.status
          }
          return 'contacted'; // Default status
        })(),
        
        // Map source, ensuring it fits our enum values
        source: (() => {
          const source = extractString('source');
          if (source && ['email', 'pipedrive', 'asana', 'instantly', 'cyberleads', 'linkedin', 'manual'].includes(source)) {
            return source as any; // Cast to allow assignment to Lead.source
          }
          return 'manual'; // Default source
        })(),
        
        // Date conversions
        lastContactDate: extractDate('lastContactDate') || extractDate('lastContact'),
        // Use current date if not provided
        createdAt: extractDate('createdAt') || new Date(),
        updatedAt: extractDate('updatedAt') || new Date(),
        
        // Other fields
        notes: extractString('notes'),
        
        // Map priority, ensuring it fits our enum values
        priority: (() => {
          const priority = extractString('priority');
          if (priority && ['high', 'medium', 'low'].includes(priority)) {
            return priority as any; // Cast to allow assignment to Lead.priority
          }
          return 'medium'; // Default priority
        })(),
        
        // Handle tags - could be string or array in Airtable
        tags: (() => {
          const tags = fields.tags;
          if (!tags) return null;
          if (Array.isArray(tags)) return tags.join(',');
          return String(tags);
        })(),
        
        // Store Airtable record ID for reference
        // This isn't in our Lead schema, but we can add it in the route handler if needed
        // airtableId: record.id
      };
      
      return lead;
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
    
    // Safely convert potential null/undefined values to appropriate defaults
    // Airtable API doesn't accept null values
    const safeStringify = (obj: any): string => {
      if (!obj) return '{}';
      return typeof obj === 'string' ? obj : JSON.stringify(obj);
    };
    
    const safeArrayStringify = (arr: string[] | null): string => {
      if (!arr) return '[]';
      if (!Array.isArray(arr)) return '[]';
      return JSON.stringify(arr);
    };
    
    // First, check if this lead's enrichment already exists in Airtable
    const existingRecords = await base(tableName)
      .select({
        filterByFormula: `{PostgreSQL_Lead_ID} = '${leadId}'`
      })
      .all();
    
    // Create a properly formatted object for Airtable
    const enrichmentData = {
      PostgreSQL_Lead_ID: leadId.toString(),
      PostgreSQL_Enrichment_ID: enrichment.id ? enrichment.id.toString() : '',
      company_info: safeStringify(enrichment.companyInfo),
      tech_stack: safeStringify(enrichment.techStack),
      recent_events: safeStringify(enrichment.recentEvents),
      insights: safeArrayStringify(enrichment.insights),
      personalization_hooks: safeArrayStringify(enrichment.personalizationHooks),
      relationship_context: enrichment.relationshipContext ? safeArrayStringify(enrichment.relationshipContext) : '[]',
      project_history: enrichment.projectHistory ? safeStringify(enrichment.projectHistory) : '{}',
      email_history: enrichment.emailHistory ? safeStringify(enrichment.emailHistory) : '{}',
      previous_proposals: enrichment.previousProposals ? safeStringify(enrichment.previousProposals) : '{}',
      use_enhanced_scraping: enrichment.useEnhancedScraping ? 'true' : 'false',
      created_at: enrichment.createdAt ? enrichment.createdAt.toISOString() : new Date().toISOString(),
      updated_at: enrichment.updatedAt ? enrichment.updatedAt.toISOString() : new Date().toISOString()
    };
    
    // Use try/catch for each operation to ensure robust error handling
    if (existingRecords.length > 0) {
      try {
        // Update existing record
        const updatedRecord = await base(tableName).update([
          { id: existingRecords[0].id, fields: enrichmentData }
        ]);
        
        if (updatedRecord && updatedRecord.length > 0) {
          return {
            id: updatedRecord[0].id,
            ...updatedRecord[0].fields
          };
        }
        throw new Error('Update operation did not return expected record');
      } catch (updateError: any) {
        console.error(`Error updating enrichment for lead ID ${leadId}:`, updateError);
        throw new Error(`Failed to update lead enrichment: ${updateError.message}`);
      }
    } else {
      try {
        // Create new record
        const newRecord = await base(tableName).create([
          { fields: enrichmentData }
        ]);
        
        if (newRecord && newRecord.length > 0) {
          return {
            id: newRecord[0].id,
            ...newRecord[0].fields
          };
        }
        throw new Error('Create operation did not return expected record');
      } catch (createError: any) {
        console.error(`Error creating enrichment for lead ID ${leadId}:`, createError);
        throw new Error(`Failed to create lead enrichment: ${createError.message}`);
      }
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
      
      // Convert dates to strings and null/undefined values to empty strings
      // Airtable API doesn't accept null values
      const draftData = {
        PostgreSQL_Draft_ID: draft.id.toString(),
        PostgreSQL_Lead_ID: draft.leadId.toString(),
        subject: draft.subject || '',
        body: draft.body || '',
        campaign_purpose: draft.campaignPurpose || '',
        service_offering: draft.serviceOffering || '',
        status: draft.status || 'draft',
        scheduled_date: draft.scheduledDate ? new Date(draft.scheduledDate).toISOString() : '',
        sent_date: draft.sentDate ? new Date(draft.sentDate).toISOString() : '',
        created_at: draft.createdAt ? new Date(draft.createdAt).toISOString() : new Date().toISOString(),
        updated_at: draft.updatedAt ? new Date(draft.updatedAt).toISOString() : new Date().toISOString(),
        google_doc_url: draft.googleDocUrl || ''
      };
      
      if (existingRecords.length > 0) {
        // Update existing record - use try/catch for error handling
        try {
          const updatedRecord = await base(tableName).update([
            { id: existingRecords[0].id, fields: draftData }
          ]);
          
          // Make sure we have a valid response
          if (updatedRecord && updatedRecord.length > 0) {
            results.push({
              id: updatedRecord[0].id,
              ...updatedRecord[0].fields
            });
          } else {
            console.error(`Error updating email draft ID ${draft.id} - Update operation returned no records`);
          }
        } catch (updateError: any) {
          console.error(`Error updating email draft ID ${draft.id} in Airtable:`, updateError);
          // Continue with next draft instead of failing the entire batch
        }
      } else {
        // Create new record - use try/catch for error handling
        try {
          const newRecord = await base(tableName).create([
            { fields: draftData }
          ]);
          
          // Make sure we have a valid response
          if (newRecord && newRecord.length > 0) {
            results.push({
              id: newRecord[0].id,
              ...newRecord[0].fields
            });
          } else {
            console.error(`Error creating email draft for lead ID ${draft.leadId} - Create operation returned no records`);
          }
        } catch (createError: any) {
          console.error(`Error creating email draft for lead ID ${draft.leadId} in Airtable:`, createError);
          // Continue with next draft instead of failing the entire batch
        }
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