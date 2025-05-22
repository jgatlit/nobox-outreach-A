import { log } from './vite';
import { syncLeadsToAirtable, getLeadsFromAirtable } from './airtable-simple';
import { storage } from './storage';

/**
 * Time interval for Airtable sync (in milliseconds)
 * 1 hour = 60 * 60 * 1000 = 3600000 ms
 */
const SYNC_INTERVAL_MS = 60 * 60 * 1000; // Changed from 5 minutes to 1 hour

// Track pending changes to sync
interface PendingChange {
  leadId: number;
  timestamp: number;
}

// Store IDs of leads that need to be synced
const pendingChanges: PendingChange[] = [];

// Track the running sync interval
let syncIntervalId: NodeJS.Timeout | null = null;

// Track the last time we did a full sync
let lastFullSyncTime = 0;

/**
 * Perform a bi-directional sync between PostgreSQL and Airtable
 * This is the main sync function that will be called periodically
 */
async function performBidirectionalSync(): Promise<void> {
  try {
    // Check if we're hitting this too frequently - avoid rate limiting
    const now = Date.now();
    const timeSinceLastSync = now - lastFullSyncTime;
    const minimumInterval = 30 * 60 * 1000; // 30 minutes minimum between full syncs
    
    if (timeSinceLastSync < minimumInterval) {
      const waitTime = Math.ceil((minimumInterval - timeSinceLastSync) / (60 * 1000));
      log(`Skipping full sync - last sync was only ${Math.floor(timeSinceLastSync / (60 * 1000))} minutes ago. Will sync again in ${waitTime} minutes.`, 'sync-manager');
      return; // Skip this sync cycle
    }
    
    // Update the last sync time
    lastFullSyncTime = now;
    
    log('Starting bidirectional sync with Airtable...', 'sync-manager');

    // Step 1: Check if we have any pending changes first
    if (pendingChanges.length > 0) {
      await syncPendingChanges();
    }
    
    // For the full sync, we'll optimize to avoid unnecessary API calls:
    
    // 1. Get the last updated leads from PostgreSQL (those updated in the last day)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    try {
      // Get only leads updated in the last 24 hours to reduce sync volume
      const recentLeads = await storage.getLeadsUpdatedSince(oneDayAgo);
      
      if (recentLeads.length > 0) {
        log(`Syncing ${recentLeads.length} recently updated leads to Airtable...`, 'sync-manager');
        const result = await syncLeadsToAirtable(recentLeads);
        log(`Successfully synced ${result.count} leads to Airtable`, 'sync-manager');
      } else {
        log('No recently updated leads to sync to Airtable', 'sync-manager');
      }
    } catch (error) {
      log(`Error syncing to Airtable: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
      // Continue with the next step even if this fails
    }

    // Step 2: Sync from Airtable to PostgreSQL (only fetch recently updated records)
    try {
      const airtableLeads = await getLeadsFromAirtable();
      
      if (airtableLeads.length === 0) {
        log('No new or updated leads found in Airtable', 'sync-manager');
        log('Bidirectional sync completed', 'sync-manager');
        return;
      }
      
      log(`Syncing ${airtableLeads.length} leads from Airtable...`, 'sync-manager');
      
      // Process results - actual import is handled in the function
      const results = {
        created: 0,
        updated: 0,
        skipped: 0, 
        errors: 0
      };
      
      // Process in batches of 5 to reduce database load
      const batchSize = 5;
      for (let i = 0; i < airtableLeads.length; i += batchSize) {
        const batch = airtableLeads.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (lead) => {
          try {
            // If lead has PostgreSQL ID, it's an update
            if (lead.id) {
              // Check if lead exists
              const existingLead = await storage.getLeadById(lead.id);
              
              if (existingLead) {
                // Handle tags: convert string to array if necessary
                let tagsArray: string[] = [];
                if (Array.isArray(lead.tags)) {
                  tagsArray = lead.tags;
                } else if (typeof lead.tags === 'string' && lead.tags) {
                  // Split by comma if it's a CSV string
                  tagsArray = lead.tags.split(',').map(tag => tag.trim()).filter(Boolean);
                }
                
                // Update existing lead
                await storage.updateLead(lead.id, {
                  firstName: lead.firstName,
                  lastName: lead.lastName,
                  email: lead.email,
                  company: lead.company,
                  title: lead.title,
                  phoneNumber: lead.phoneNumber,
                  website: lead.website,
                  status: lead.status as any, // Type cast needed due to enum constraints
                  source: lead.source as any, // Type cast needed due to enum constraints
                  notes: lead.notes,
                  priority: lead.priority as any, // Type cast needed due to enum constraints
                  tags: tagsArray,
                  lastContactDate: lead.lastContactDate
                });
                results.updated++;
              } else {
                // Skip if the ID doesn't exist in our system
                results.skipped++;
              }
            } else if (lead.email) {
              // This is a new lead from Airtable without PostgreSQL ID
              // Check for duplication by email
              const existingByEmail = await storage.findDuplicateLeads(lead.email);
              
              if (existingByEmail.length > 0) {
                // Skip, this is a duplicate
                results.skipped++;
                return;
              }
              
              // Create as new lead with source "airtable"
              // Handle tags: convert string to array if necessary
              let tagsArray: string[] = [];
              if (Array.isArray(lead.tags)) {
                tagsArray = lead.tags;
              } else if (typeof lead.tags === 'string' && lead.tags) {
                // Split by comma if it's a CSV string
                tagsArray = lead.tags.split(',').map(tag => tag.trim()).filter(Boolean);
              }
              
              const leadData = {
                firstName: lead.firstName || null,
                lastName: lead.lastName || null,
                email: lead.email,
                company: lead.company || null,
                title: lead.title || null,
                phoneNumber: lead.phoneNumber || null,
                website: lead.website || null,
                status: (lead.status || 'active') as any, // Map to our schema enum
                source: 'airtable' as const, // Set source to airtable
                notes: lead.notes || null,
                priority: (lead.priority || 'medium') as any, // Map to our schema enum
                tags: tagsArray,
                lastContactDate: lead.lastContactDate || null,
                linkedinUrl: null, // Required fields that weren't in Airtable
                enrichmentStatus: 'not_started' as const,
                emailStatus: 'not_started' as const,
                priorityScore: null,
                priorityReason: null,
                priorityUpdatedAt: null
              };
              
              // Add the lead
              await storage.addLead(leadData);
              results.created++;
            } else {
              // Skip leads without email
              results.skipped++;
            }
          } catch (error) {
            log(`Error processing Airtable lead ${lead.email || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
            results.errors++;
          }
        }));
        
        // Add a small delay between batches to prevent rate limiting
        if (i + batchSize < airtableLeads.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      log(`Airtable sync completed: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped, ${results.errors} errors`, 'sync-manager');
    } catch (error) {
      log(`Error syncing from Airtable: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
    }
    
    log('Bidirectional sync completed', 'sync-manager');
  } catch (error) {
    log(`Error in bidirectional sync: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
  }
}

/**
 * Queue a lead for syncing to Airtable
 * Instead of syncing immediately, this adds the lead to a queue 
 * that will be processed during the next sync cycle
 */
export async function syncLeadToAirtable(leadId: number): Promise<void> {
  // Check if this lead is already in the pending changes
  const existingIndex = pendingChanges.findIndex(change => change.leadId === leadId);
  
  if (existingIndex >= 0) {
    // Update the timestamp if it's already pending
    pendingChanges[existingIndex].timestamp = Date.now();
    log(`Updated pending sync for lead ${leadId}`, 'sync-manager');
  } else {
    // Add to pending changes
    pendingChanges.push({
      leadId,
      timestamp: Date.now()
    });
    log(`Queued lead ${leadId} for next Airtable sync`, 'sync-manager');
  }
  
  // If the queue has more than 10 changes or the oldest change is older than 10 minutes,
  // and we're not already in the middle of a sync, trigger a sync for the queued changes only
  const shouldTriggerSync = 
    pendingChanges.length >= 10 || 
    (pendingChanges.length > 0 && 
     Date.now() - pendingChanges[0].timestamp > 10 * 60 * 1000);
  
  if (shouldTriggerSync) {
    log(`Triggering batch sync for ${pendingChanges.length} pending changes`, 'sync-manager');
    syncPendingChanges();
  }
}

/**
 * Process only the leads that have pending changes
 */
async function syncPendingChanges(): Promise<void> {
  if (pendingChanges.length === 0) return;
  
  try {
    // Get a copy of the current pending changes
    const changesToSync = [...pendingChanges];
    
    // Clear the pending changes list
    pendingChanges.length = 0;
    
    // Get all the leads that need syncing
    const leadIds = changesToSync.map(change => change.leadId);
    log(`Processing batch sync for ${leadIds.length} leads`, 'sync-manager');
    
    // Fetch leads data
    const leads = await Promise.all(
      leadIds.map(async (id) => {
        try {
          return await storage.getLeadById(id);
        } catch (error) {
          log(`Cannot get lead ${id} for sync: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
          return null;
        }
      })
    );
    
    // Filter out nulls (leads that couldn't be found)
    const validLeads = leads.filter(lead => lead !== null);
    
    if (validLeads.length === 0) {
      log('No valid leads to sync in this batch', 'sync-manager');
      return;
    }
    
    // Sync the batch to Airtable
    log(`Syncing batch of ${validLeads.length} leads to Airtable`, 'sync-manager');
    const result = await syncLeadsToAirtable(validLeads);
    log(`Successfully synced batch of ${validLeads.length} leads to Airtable`, 'sync-manager');
    
  } catch (error) {
    log(`Error in batch sync: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
  }
}

/**
 * Start the Airtable sync scheduler
 */
export function startSyncScheduler(): void {
  if (syncIntervalId) {
    log('Sync scheduler is already running', 'sync-manager');
    return;
  }
  
  log(`Starting Airtable sync scheduler (every ${SYNC_INTERVAL_MS / 1000} seconds)`, 'sync-manager');
  
  // Schedule the next sync rather than running immediately
  const nextSyncDelay = 5 * 60 * 1000; // Wait 5 minutes before first sync after restart
  log(`Scheduling first sync in ${nextSyncDelay / 1000} seconds`, 'sync-manager');
  
  // Schedule the regular interval sync
  syncIntervalId = setInterval(() => {
    // Process any pending changes first
    if (pendingChanges.length > 0) {
      syncPendingChanges()
        .then(() => performBidirectionalSync())
        .catch(error => {
          log(`Error in scheduled sync: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
        });
    } else {
      // Just perform the regular sync
      performBidirectionalSync();
    }
  }, SYNC_INTERVAL_MS);
}

/**
 * Stop the Airtable sync scheduler
 */
export function stopSyncScheduler(): void {
  if (!syncIntervalId) {
    log('Sync scheduler is not running', 'sync-manager');
    return;
  }
  
  clearInterval(syncIntervalId);
  syncIntervalId = null;
  log('Airtable sync scheduler stopped', 'sync-manager');
}