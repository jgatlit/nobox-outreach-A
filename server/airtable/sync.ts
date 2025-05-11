/**
 * Airtable Sync Module
 * 
 * This file handles the two-way synchronization between PostgreSQL and Airtable.
 * It provides functions to sync leads from PostgreSQL to Airtable and vice versa.
 */

import { db } from '../../db';
import { eq, desc, sql } from 'drizzle-orm';
import { leads, syncStatus } from '../../shared/schema';
import { AirtableRecord, LeadFields } from './schema';
import { airtableClient, createRecord, listRecords, searchRecords } from './client';

// Sync status tracking in the database
export async function getSyncStatus() {
  const pgToAirtableStatus = await db.query.syncStatus.findFirst({
    where: eq(syncStatus.type, 'leads_to_airtable'),
    orderBy: [desc(syncStatus.updatedAt)]
  });

  const airtableToPgStatus = await db.query.syncStatus.findFirst({
    where: eq(syncStatus.type, 'airtable_to_leads'),
    orderBy: [desc(syncStatus.updatedAt)]
  });

  return {
    toAirtable: pgToAirtableStatus || { 
      id: 0, 
      type: 'leads_to_airtable', 
      lastSyncTime: null, 
      totalSynced: 0, 
      lastSyncSuccess: false,
      details: 'Sync has never been run',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    fromAirtable: airtableToPgStatus || { 
      id: 0, 
      type: 'airtable_to_leads', 
      lastSyncTime: null, 
      totalSynced: 0, 
      lastSyncSuccess: false,
      details: 'Sync has never been run',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  };
}

// Update sync status in the database
async function updateSyncStatus(type: 'leads_to_airtable' | 'airtable_to_leads', success: boolean, recordsProcessed: number, message?: string) {
  try {
    // Check if a record already exists
    const existingStatus = await db.query.syncStatus.findFirst({
      where: eq(syncStatus.type, type)
    });
    
    if (existingStatus) {
      // Update existing record
      const [updated] = await db.update(syncStatus)
        .set({
          lastSyncTime: new Date(),
          lastSyncSuccess: success,
          totalSynced: existingStatus.totalSynced + recordsProcessed,
          details: message || `Processed ${recordsProcessed} records`
        })
        .where(eq(syncStatus.id, existingStatus.id))
        .returning();
      
      return updated;
    } else {
      // Create new record
      const [result] = await db.insert(syncStatus).values({
        type,
        lastSyncTime: new Date(),
        lastSyncSuccess: success,
        totalSynced: recordsProcessed,
        details: message || `Processed ${recordsProcessed} records`
      }).returning();
      
      return result;
    }
  } catch (error) {
    console.error(`[airtable-sync] Error updating sync status for ${type}:`, error);
    // Return basic status object even if save fails
    return {
      id: 0,
      type,
      lastSyncTime: new Date(),
      lastSyncSuccess: false,
      totalSynced: recordsProcessed,
      details: `Error: ${error instanceof Error ? error.message : String(error)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}

// Sync PostgreSQL leads to Airtable
export async function syncLeadsToAirtable() {
  console.log('[airtable-sync] Starting sync: PostgreSQL leads -> Airtable');
  
  try {
    if (!process.env.AIRTABLE_API_KEY) {
      throw new Error('AIRTABLE_API_KEY environment variable is not set');
    }
    
    if (!process.env.AIRTABLE_BASE_ID) {
      throw new Error('AIRTABLE_BASE_ID environment variable is not set');
    }
    
    // Get all leads for now - later we can add a lastSyncedAt column to leads table
    const leadsToSync = await db.query.leads.findMany();
    
    if (leadsToSync.length === 0) {
      console.log('[airtable-sync] No leads to sync to Airtable');
      await updateSyncStatus('leads_to_airtable', true, 0, 'No leads to sync');
      return { success: true, count: 0 };
    }
    
    // Get Airtable baseId
    const baseId = process.env.AIRTABLE_BASE_ID;
    const leadRecords = leadsToSync.map(lead => {
      // Convert PostgreSQL lead to Airtable record
      const fields: LeadFields = {
        id: lead.id,
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        email: lead.email,
        company: lead.company || undefined,
        title: lead.title || undefined,
        status: lead.status || undefined,
        source: lead.source || undefined,
        priority: lead.priority || undefined,
        website: lead.website || undefined,
        notes: lead.notes || undefined,
        tags: lead.tags as string[] || [],
        createdAt: new Date(lead.createdAt).toISOString(),
        updatedAt: new Date(lead.updatedAt).toISOString(),
        lastSyncedAt: new Date().toISOString(),
        syncSource: 'postgresql'
      };

      // Return formatted record
      return { fields };
    });
    
    // Batch update to Airtable in chunks of 10
    const chunkSize = 10;
    let processedCount = 0;
    
    for (let i = 0; i < leadRecords.length; i += chunkSize) {
      const chunk = leadRecords.slice(i, i + chunkSize);
      
      try {
        // Create or update records in Airtable one at a time
        for (const record of chunk) {
          await createRecord(baseId, 'Leads', record.fields);
          processedCount++;
        }
                  
        console.log(`[airtable-sync] Synced ${processedCount}/${leadRecords.length} leads to Airtable`);
      } catch (error) {
        console.error(`[airtable-sync] Error syncing chunk ${i}-${i+chunkSize} to Airtable:`, error);
        // Continue with next chunk despite errors
      }
    }
    
    // Update sync status
    await updateSyncStatus('leads_to_airtable', true, processedCount);
    return { success: true, count: processedCount };
  } catch (error) {
    console.error('[airtable-sync] Error syncing leads to Airtable:', error);
    await updateSyncStatus('leads_to_airtable', false, 0, error instanceof Error ? error.message : String(error));
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Sync Airtable leads to PostgreSQL
export async function syncAirtableToLeads() {
  console.log('[airtable-sync] Starting sync: Airtable -> PostgreSQL leads');
  
  try {
    if (!process.env.AIRTABLE_API_KEY) {
      throw new Error('AIRTABLE_API_KEY environment variable is not set');
    }
    
    if (!process.env.AIRTABLE_BASE_ID) {
      throw new Error('AIRTABLE_BASE_ID environment variable is not set');
    }
    
    // Get base ID
    const baseId = process.env.AIRTABLE_BASE_ID;
    
    // Get leads from Airtable that have been updated since last sync
    const lastSyncStatus = await db.query.syncStatus.findFirst({
      where: eq(syncStatus.type, 'airtable_to_leads'),
      orderBy: [desc(syncStatus.updatedAt)]
    });
    
    // Fetch all records if this is the first sync, otherwise only get updated ones
    let airtableLeads: AirtableRecord<LeadFields>[] = [];
    
    try {
      // First sync - get all records
      airtableLeads = await listRecords(baseId, 'Leads');
    } catch (error) {
      console.error('[airtable-sync] Error fetching leads from Airtable:', error);
      await updateSyncStatus('airtable_to_leads', false, 0, `Error fetching leads: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
    
    if (airtableLeads.length === 0) {
      console.log('[airtable-sync] No leads to sync from Airtable');
      await updateSyncStatus('airtable_to_leads', true, 0, 'No leads to sync');
      return { success: true, count: 0 };
    }
    
    let processedCount = 0;
    
    // Process each record from Airtable
    for (const airtableLead of airtableLeads) {
      try {
        const fields = airtableLead.fields;
        
        // Check if this is an Airtable-created lead or just a synced PostgreSQL lead
        if (fields.syncSource === 'postgresql') {
          // This record was already synced from PostgreSQL, we can skip it
          // to prevent circular updates
          continue;
        }
        
        // Check if lead already exists in PostgreSQL
        const existingLead = await db.query.leads.findFirst({
          where: eq(leads.email, fields.email)
        });
        
        if (existingLead) {
          // Update existing lead
          await db.update(leads)
            .set({
              firstName: fields.firstName || existingLead.firstName,
              lastName: fields.lastName || existingLead.lastName,
              company: fields.company || existingLead.company,
              title: fields.title || existingLead.title,
              status: fields.status as any || existingLead.status,
              source: fields.source as any || existingLead.source,
              priority: fields.priority as any || existingLead.priority,
              website: fields.website || existingLead.website,
              notes: fields.notes || existingLead.notes,
              tags: fields.tags || existingLead.tags
            })
            .where(eq(leads.id, existingLead.id));
        } else {
          // Create new lead
          await db.insert(leads).values({
            firstName: fields.firstName || null,
            lastName: fields.lastName || null,
            email: fields.email,
            company: fields.company || null,
            title: fields.title || null,
            status: fields.status as any || null,
            source: fields.source as any || 'airtable',
            priority: fields.priority as any || null,
            website: fields.website || null,
            notes: fields.notes || null,
            tags: fields.tags || []
          });
        }
        
        processedCount++;
      } catch (error) {
        console.error('[airtable-sync] Error processing lead from Airtable:', airtableLead.fields.email, error);
        // Continue with next record despite errors
      }
    }
    
    // Update sync status
    await updateSyncStatus('airtable_to_leads', true, processedCount);
    return { success: true, count: processedCount };
  } catch (error) {
    console.error('[airtable-sync] Error syncing leads from Airtable:', error);
    await updateSyncStatus('airtable_to_leads', false, 0, error instanceof Error ? error.message : String(error));
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Trigger a full two-way sync (both directions)
export async function triggerFullSync() {
  const toAirtableResult = await syncLeadsToAirtable();
  const fromAirtableResult = await syncAirtableToLeads();
  
  return {
    toAirtable: toAirtableResult,
    fromAirtable: fromAirtableResult,
    success: toAirtableResult.success && fromAirtableResult.success
  };
}

// Sync a specific lead to Airtable
export async function syncSpecificLeadToAirtable(leadId: number) {
  console.log(`[airtable-sync] Syncing specific lead: ${leadId} -> Airtable`);
  
  try {
    if (!process.env.AIRTABLE_API_KEY) {
      throw new Error('AIRTABLE_API_KEY environment variable is not set');
    }
    
    if (!process.env.AIRTABLE_BASE_ID) {
      throw new Error('AIRTABLE_BASE_ID environment variable is not set');
    }
    
    // Get the specific lead
    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId)
    });
    
    if (!lead) {
      return { 
        success: false, 
        message: `Lead with ID ${leadId} not found` 
      };
    }
    
    const baseId = process.env.AIRTABLE_BASE_ID;
    
    // Convert PostgreSQL lead to Airtable record
    const fields: LeadFields = {
      id: lead.id,
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email,
      company: lead.company || undefined,
      title: lead.title || undefined,
      status: lead.status || undefined,
      source: lead.source || undefined,
      priority: lead.priority || undefined,
      website: lead.website || undefined,
      notes: lead.notes || undefined,
      tags: lead.tags as string[] || [],
      createdAt: new Date(lead.createdAt).toISOString(),
      updatedAt: new Date(lead.updatedAt).toISOString(),
      lastSyncedAt: new Date().toISOString(),
      syncSource: 'postgresql'
    };
    
    // Create or update record in Airtable
    await createRecord(baseId, 'Leads', fields);
    
    // Update sync timestamp in PostgreSQL
    await db.update(leads)
      .set({ lastSyncedAt: new Date() })
      .where(eq(leads.id, leadId));
    
    return { 
      success: true, 
      message: `Lead ${leadId} successfully synced to Airtable` 
    };
  } catch (error) {
    console.error(`[airtable-sync] Error syncing lead ${leadId} to Airtable:`, error);
    return { 
      success: false, 
      message: `Failed to sync lead ${leadId} to Airtable`,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}