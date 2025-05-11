/**
 * This module handles two-way synchronization between PostgreSQL
 * leads table and Airtable Leads table.
 */

import { db } from "../../db";
import { leads, syncStatus } from "../../shared/schema";
import { eq, gt, and, sql } from "drizzle-orm";
import { airtableClient } from "./client";
import { TABLES, LeadFields, AirtableRecord } from "./schema";
import { Lead } from "../../shared/schema";
import { log } from "../vite";

// Constants
const SYNC_TYPES = {
  LEADS_TO_AIRTABLE: 'leads_to_airtable',
  AIRTABLE_TO_LEADS: 'airtable_to_leads',
};

/**
 * Get the last synchronization timestamp for a specific sync type
 */
export async function getLastSyncTimestamp(syncType: string): Promise<Date> {
  try {
    // Get from settings/sync_status table
    const syncRecord = await db.query.syncStatus.findFirst({
      where: eq(syncStatus.type, syncType)
    });
    
    return syncRecord ? new Date(syncRecord.lastSyncTime) : new Date(0);
  } catch (error) {
    console.error('Error getting sync timestamp:', error);
    // Return epoch time if no sync has happened yet
    return new Date(0);
  }
}

/**
 * Update the synchronization timestamp and status
 */
export async function updateSyncStatus(
  syncType: string, 
  timestamp: Date, 
  success: boolean = true, 
  totalSynced: number = 0,
  details?: string
): Promise<void> {
  try {
    const exists = await db.query.syncStatus.findFirst({
      where: eq(syncStatus.type, syncType)
    });
    
    if (exists) {
      await db.update(syncStatus)
        .set({ 
          lastSyncTime: timestamp,
          lastSyncSuccess: success,
          totalSynced: exists.totalSynced + totalSynced,
          details: details || exists.details,
          updatedAt: new Date()
        })
        .where(eq(syncStatus.type, syncType));
    } else {
      await db.insert(syncStatus).values({
        type: syncType,
        lastSyncTime: timestamp,
        lastSyncSuccess: success,
        totalSynced: totalSynced,
        details: details,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating sync status:', error);
    throw error;
  }
}

/**
 * Map a PostgreSQL lead record to Airtable fields format
 */
function mapLeadToAirtableFields(lead: Lead): Partial<LeadFields> {
  return {
    id: lead.id,
    firstName: lead.firstName || "",
    lastName: lead.lastName || "",
    email: lead.email,
    company: lead.company || undefined,
    title: lead.title || undefined,
    status: lead.status || undefined,
    source: lead.source,
    priority: lead.priority || undefined,
    lastActivityDate: lead.lastActivityDate ? lead.lastActivityDate.toISOString() : undefined,
    website: lead.website || undefined,
    notes: lead.notes || undefined,
    tags: lead.tags || undefined,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    lastSyncedAt: new Date().toISOString(),
    syncSource: "postgresql"
  };
}

/**
 * Map an Airtable record to PostgreSQL lead format
 */
function mapAirtableRecordToLead(record: AirtableRecord<LeadFields>): Partial<Lead> {
  const fields = record.fields;
  return {
    firstName: fields.firstName,
    lastName: fields.lastName,
    email: fields.email,
    company: fields.company || null,
    title: fields.title || null,
    status: fields.status || null,
    source: fields.source as any,  // Type cast to match the enum
    priority: fields.priority as any,  // Type cast to match the enum
    lastActivityDate: fields.lastActivityDate ? new Date(fields.lastActivityDate) : null,
    website: fields.website || null,
    notes: fields.notes || null,
    tags: fields.tags || [],
    // Preserve the original creation date
    updatedAt: new Date(),
  };
}

/**
 * Resolve conflicts between PostgreSQL and Airtable lead records
 * Strategy: Use the most recently updated record
 */
function resolveConflict(pgLead: Lead, airtableLead: LeadFields): Partial<Lead> {
  const pgUpdatedAt = new Date(pgLead.updatedAt);
  const airtableUpdatedAt = new Date(airtableLead.updatedAt);
  
  // Use the most recently updated record
  if (pgUpdatedAt > airtableUpdatedAt) {
    return { ...pgLead };
  } else {
    return mapAirtableRecordToLead({ 
      id: String(airtableLead.id), 
      fields: airtableLead, 
      createdTime: airtableLead.createdAt 
    });
  }
}

/**
 * Synchronize leads from PostgreSQL to Airtable
 */
export async function syncLeadsToAirtable() {
  log("Starting sync: PostgreSQL leads -> Airtable", "airtable-sync");
  const startTime = new Date();
  let syncedCount = 0;
  
  try {
    // Get last sync timestamp
    const lastSync = await getLastSyncTimestamp(SYNC_TYPES.LEADS_TO_AIRTABLE);
    
    // Get leads updated since last sync
    const updatedLeads = await db.query.leads.findMany({
      where: gt(leads.updatedAt, lastSync)
    });
    
    if (updatedLeads.length === 0) {
      log("No leads to sync to Airtable", "airtable-sync");
      await updateSyncStatus(SYNC_TYPES.LEADS_TO_AIRTABLE, startTime, true, 0, "No leads to sync");
      return { success: true, count: 0, message: "No leads to sync" };
    }
    
    log(`Found ${updatedLeads.length} leads to sync to Airtable`, "airtable-sync");
    
    // Check if Leads table exists in Airtable
    try {
      const baseId = process.env.AIRTABLE_BASE_ID || "";
      await airtableClient.query(baseId, TABLES.LEADS, { maxRecords: 1 });
    } catch (error) {
      // If the table doesn't exist, create it (user needs to create it manually in Airtable)
      log("Error accessing Leads table in Airtable. Please ensure it exists.", "airtable-sync");
      await updateSyncStatus(
        SYNC_TYPES.LEADS_TO_AIRTABLE, 
        startTime, 
        false, 
        0, 
        "Failed to access Leads table in Airtable. Please ensure it exists."
      );
      return { 
        success: false, 
        error: "Failed to access Leads table in Airtable. Please ensure it exists." 
      };
    }
    
    // Process leads in batches (Airtable has limits)
    const BATCH_SIZE = 10;
    for (let i = 0; i < updatedLeads.length; i += BATCH_SIZE) {
      const batch = updatedLeads.slice(i, i + BATCH_SIZE);
      const records = [];
      
      for (const lead of batch) {
        // Check if record already exists in Airtable
        const baseId = process.env.AIRTABLE_BASE_ID || "";
        const existingRecords = await airtableClient.query(
          baseId, 
          TABLES.LEADS,
          {
            filterByFormula: `{id} = ${lead.id}`
          }
        );
        
        if (existingRecords && existingRecords.length > 0) {
          // Update existing record
          records.push({
            id: existingRecords[0].id,
            fields: mapLeadToAirtableFields(lead)
          });
        } else {
          // Create new record
          records.push({
            fields: mapLeadToAirtableFields(lead)
          });
        }
      }
      
      // Update or create records in Airtable
      if (records.length > 0) {
        // Process each record individually with the client interface
        for (const record of records) {
          if (record.id) {
            // Update existing record
            await airtableClient.update(baseId, TABLES.LEADS, record.id, record.fields);
          } else {
            // Create new record
            await airtableClient.create(baseId, TABLES.LEADS, record.fields);
          }
        }
        syncedCount += records.length;
        log(`Synced ${records.length} leads to Airtable (batch ${i/BATCH_SIZE + 1})`, "airtable-sync");
      }
    }
    
    // Update sync timestamp
    await updateSyncStatus(
      SYNC_TYPES.LEADS_TO_AIRTABLE, 
      startTime, 
      true, 
      syncedCount,
      `Successfully synced ${syncedCount} leads to Airtable`
    );
    
    log(`Completed sync: PostgreSQL leads -> Airtable. Synced ${syncedCount} leads.`, "airtable-sync");
    return { success: true, count: syncedCount };
  } catch (error) {
    console.error('Error syncing leads to Airtable:', error);
    await updateSyncStatus(
      SYNC_TYPES.LEADS_TO_AIRTABLE, 
      startTime, 
      false, 
      0, 
      `Error: ${error.message}`
    );
    return { success: false, error: error.message };
  }
}

/**
 * Synchronize leads from Airtable to PostgreSQL
 */
export async function syncLeadsFromAirtable() {
  log("Starting sync: Airtable -> PostgreSQL leads", "airtable-sync");
  const startTime = new Date();
  let syncedCount = 0;
  
  try {
    // Get last sync timestamp
    const lastSync = await getLastSyncTimestamp(SYNC_TYPES.AIRTABLE_TO_LEADS);
    
    // Format the date for Airtable's filterByFormula
    const lastSyncFormatted = lastSync.toISOString();
    
    // Get Airtable records updated since last sync
    const baseId = process.env.AIRTABLE_BASE_ID || "";
    const records = await airtableClient.query(
      baseId,
      TABLES.LEADS,
      {
        filterByFormula: `IS_AFTER({updatedAt}, '${lastSyncFormatted}')`
      }
    );
    
    if (records.length === 0) {
      log("No leads to sync from Airtable", "airtable-sync");
      await updateSyncStatus(SYNC_TYPES.AIRTABLE_TO_LEADS, startTime, true, 0, "No leads to sync");
      return { success: true, count: 0, message: "No leads to sync" };
    }
    
    log(`Found ${records.length} leads to sync from Airtable`, "airtable-sync");
    
    // Process each record
    for (const record of records) {
      const fields = record.fields as LeadFields;
      
      // Skip records created by PostgreSQL sync to avoid circular updates
      if (fields.syncSource === "postgresql") {
        continue;
      }
      
      // Check if lead exists in PostgreSQL
      const leadId = fields.id;
      if (!leadId) {
        log(`Skipping Airtable record without PostgreSQL ID: ${record.id}`, "airtable-sync");
        continue;
      }
      
      const existingLead = await db.query.leads.findFirst({
        where: eq(leads.id, leadId)
      });
      
      let leadData = mapAirtableRecordToLead(record as AirtableRecord<LeadFields>);
      
      if (existingLead) {
        // Resolve conflicts if both records have been updated
        leadData = resolveConflict(existingLead, fields);
        
        // Update existing lead
        await db.update(leads)
          .set(leadData)
          .where(eq(leads.id, leadId));
      } else {
        // Create new lead
        // For new leads from Airtable, we need to ensure it has all required fields
        if (!leadData.email) {
          log(`Skipping Airtable record without email: ${record.id}`, "airtable-sync");
          continue;
        }
        
        await db.insert(leads).values({
          ...leadData,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }
      
      syncedCount++;
    }
    
    // Update sync timestamp
    await updateSyncStatus(
      SYNC_TYPES.AIRTABLE_TO_LEADS, 
      startTime, 
      true, 
      syncedCount,
      `Successfully synced ${syncedCount} leads from Airtable`
    );
    
    log(`Completed sync: Airtable -> PostgreSQL leads. Synced ${syncedCount} leads.`, "airtable-sync");
    return { success: true, count: syncedCount };
  } catch (error) {
    console.error('Error syncing leads from Airtable:', error);
    await updateSyncStatus(
      SYNC_TYPES.AIRTABLE_TO_LEADS, 
      startTime, 
      false, 
      0, 
      `Error: ${error.message}`
    );
    return { success: false, error: error.message };
  }
}

/**
 * Sync a specific lead from PostgreSQL to Airtable
 * Used for webhook or direct API call scenarios
 */
export async function syncSpecificLeadToAirtable(leadId: number) {
  try {
    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId)
    });
    
    if (!lead) {
      return { success: false, error: "Lead not found" };
    }
    
    // Check if record already exists in Airtable
    const baseId = process.env.AIRTABLE_BASE_ID || "";
    const existingRecords = await airtableClient.query(
      baseId,
      TABLES.LEADS,
      {
        filterByFormula: `{id} = ${lead.id}`
      }
    );
    
    if (existingRecords && existingRecords.length > 0) {
      // Update existing record
      await airtableClient.update(
        baseId,
        TABLES.LEADS, 
        existingRecords[0].id,
        mapLeadToAirtableFields(lead)
      );
    } else {
      // Create new record
      await airtableClient.create(
        baseId,
        TABLES.LEADS,
        mapLeadToAirtableFields(lead)
      );
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Error syncing lead ${leadId} to Airtable:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current sync status information
 */
export async function getSyncStatus() {
  try {
    const statuses = await db.query.syncStatus.findMany({
      where: sql`type LIKE '%leads%'`
    });
    
    const toAirtableStatus = statuses.find(s => s.type === SYNC_TYPES.LEADS_TO_AIRTABLE);
    const fromAirtableStatus = statuses.find(s => s.type === SYNC_TYPES.AIRTABLE_TO_LEADS);
    
    return {
      toAirtable: toAirtableStatus || null,
      fromAirtable: fromAirtableStatus || null,
      lastSyncTime: toAirtableStatus?.lastSyncTime || fromAirtableStatus?.lastSyncTime || null,
      lastSyncSuccess: toAirtableStatus?.lastSyncSuccess && fromAirtableStatus?.lastSyncSuccess,
      totalSynced: (toAirtableStatus?.totalSynced || 0) + (fromAirtableStatus?.totalSynced || 0)
    };
  } catch (error) {
    console.error('Error getting sync status:', error);
    return null;
  }
}

/**
 * Trigger a complete two-way sync
 */
export async function triggerFullSync() {
  try {
    const toAirtableResult = await syncLeadsToAirtable();
    const fromAirtableResult = await syncLeadsFromAirtable();
    
    return {
      success: toAirtableResult.success && fromAirtableResult.success,
      toAirtable: toAirtableResult,
      fromAirtable: fromAirtableResult,
      totalSynced: (toAirtableResult.count || 0) + (fromAirtableResult.count || 0)
    };
  } catch (error) {
    console.error('Error triggering full sync:', error);
    return { success: false, error: error.message };
  }
}