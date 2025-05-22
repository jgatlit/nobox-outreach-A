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

// Track if a sync operation is currently in progress
let syncInProgress = false;

/**
 * Sync a lead immediately to Airtable
 * This is called when a lead is added or modified in the database
 */
export async function syncLeadToAirtable(leadId: number): Promise<void> {
  try {
    // Rate limiting protection
    if (syncInProgress) {
      // If a sync is already in progress, add to pending changes instead
      const existingIndex = pendingChanges.findIndex(change => change.leadId === leadId);
      if (existingIndex >= 0) {
        pendingChanges[existingIndex].timestamp = Date.now();
        log(`Added to pending sync queue - lead ${leadId} (sync in progress)`, 'sync-manager');
      } else {
        pendingChanges.push({
          leadId,
          timestamp: Date.now()
        });
        log(`Added to pending sync queue - lead ${leadId} (sync in progress)`, 'sync-manager');
      }
      return;
    }
    
    // Set the sync flag
    syncInProgress = true;
    
    // Get the lead data
    log(`Syncing single lead ${leadId} to Airtable...`, 'sync-manager');
    const lead = await storage.getLeadById(leadId);
    
    if (!lead) {
      log(`Cannot sync lead ${leadId} to Airtable: Lead not found`, 'sync-manager');
      syncInProgress = false;
      return;
    }
    
    // Sync the single lead to Airtable
    const result = await syncLeadsToAirtable([lead]);
    log(`Successfully synced lead ${leadId} to Airtable`, 'sync-manager');
    
    // Reset sync flag
    syncInProgress = false;
    
    // If we have pending changes, process them in a queue
    if (pendingChanges.length > 0) {
      // We'll only process a maximum of 3 pending changes at a time
      // to avoid hitting rate limits
      const batchSize = Math.min(3, pendingChanges.length);
      log(`Processing ${batchSize} pending lead changes`, 'sync-manager');
      
      // Process the first few changes
      const changesToProcess = pendingChanges.splice(0, batchSize);
      processPendingLeads(changesToProcess.map(change => change.leadId));
    }
  } catch (error) {
    log(`Error syncing lead ${leadId} to Airtable: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
    syncInProgress = false;
  }
}

/**
 * Process a small batch of pending lead changes
 */
async function processPendingLeads(leadIds: number[]): Promise<void> {
  try {
    // Get the leads data
    const leads = await Promise.all(
      leadIds.map(async (id) => {
        try {
          return await storage.getLeadById(id);
        } catch (error) {
          log(`Error fetching lead ${id} for sync: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
          return null;
        }
      })
    );
    
    // Filter out nulls
    const validLeads = leads.filter(lead => lead !== null);
    
    if (validLeads.length === 0) {
      log('No valid leads to process', 'sync-manager');
      syncInProgress = false;
      return;
    }
    
    // Sync the batch
    await syncLeadsToAirtable(validLeads);
    log(`Successfully processed batch of ${validLeads.length} pending leads`, 'sync-manager');
    
    // Reset sync flag
    syncInProgress = false;
  } catch (error) {
    log(`Error processing pending leads: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
    syncInProgress = false;
  }
}

// This function has been replaced with more specific implementations
// and is kept here for compatibility with any existing code that might call it
async function syncPendingChanges(): Promise<void> {
  if (pendingChanges.length === 0) return;
  
  try {
    // Get a batch of pending changes
    const batchSize = Math.min(5, pendingChanges.length);
    const changesToProcess = pendingChanges.splice(0, batchSize);
    
    // Process them
    await processPendingLeads(changesToProcess.map(change => change.leadId));
  } catch (error) {
    log(`Error in batch sync: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
    syncInProgress = false;
  }
}

/**
 * Start the Airtable sync scheduler
 * - Immediate syncs happen for lead changes
 * - Bidirectional sync happens hourly to check for Airtable changes
 */
export function startSyncScheduler(): void {
  if (syncIntervalId) {
    log('Sync scheduler is already running', 'sync-manager');
    return;
  }
  
  log(`Starting Airtable sync scheduler (every ${SYNC_INTERVAL_MS / 1000} seconds)`, 'sync-manager');
  
  // Schedule the regular interval sync for bidirectional checking (check for Airtable changes)
  syncIntervalId = setInterval(() => {
    log('Running scheduled hourly Airtable sync check...', 'sync-manager');
    
    // If there's a sync already in progress, we'll skip this cycle
    if (syncInProgress) {
      log('Skipping scheduled sync - another sync is already in progress', 'sync-manager');
      return;
    }
    
    // Process any pending changes first if there are any
    if (pendingChanges.length > 0) {
      // Process a batch of up to 5 pending leads
      const batchSize = Math.min(5, pendingChanges.length);
      const changesToProcess = pendingChanges.splice(0, batchSize);
      
      syncInProgress = true;
      processPendingLeads(changesToProcess.map(change => change.leadId))
        .then(() => {
          // After processing pending changes, check for Airtable changes
          return checkForAirtableChanges();
        })
        .catch(error => {
          log(`Error processing pending changes: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
          syncInProgress = false;
        });
    } else {
      // No pending changes, just check for Airtable changes
      checkForAirtableChanges();
    }
  }, SYNC_INTERVAL_MS);
}

/**
 * Check for changes in Airtable that need to be synced back to PostgreSQL
 * This is a more focused version of the bidirectional sync that only 
 * looks for changes in Airtable, not the other way around
 */
async function checkForAirtableChanges(): Promise<void> {
  try {
    syncInProgress = true;
    log('Checking for changes in Airtable...', 'sync-manager');
    
    // Get leads from Airtable
    const airtableLeads = await getLeadsFromAirtable();
    
    if (airtableLeads.length === 0) {
      log('No leads found in Airtable', 'sync-manager');
      syncInProgress = false;
      return;
    }
    
    // Process in smaller batches to reduce load
    const batchSize = 5;
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };
    
    // Process in batches
    for (let i = 0; i < airtableLeads.length; i += batchSize) {
      const batch = airtableLeads.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (lead) => {
        try {
          // If lead has PostgreSQL ID, it's an update
          if (lead.id) {
            // Check if lead exists
            const existingLead = await storage.getLeadById(lead.id);
            
            if (existingLead) {
              // Convert tags properly
              let tagsArray: string[] = [];
              if (Array.isArray(lead.tags)) {
                tagsArray = lead.tags;
              } else if (typeof lead.tags === 'string' && lead.tags) {
                tagsArray = lead.tags.split(',').map(t => t.trim()).filter(Boolean);
              }
              
              // Update the lead
              await storage.updateLead(lead.id, {
                firstName: lead.firstName,
                lastName: lead.lastName,
                email: lead.email,
                company: lead.company,
                title: lead.title,
                phoneNumber: lead.phoneNumber,
                website: lead.website,
                status: lead.status as any,
                source: lead.source as any,
                notes: lead.notes,
                priority: lead.priority as any,
                tags: tagsArray,
                lastContactDate: lead.lastContactDate
              });
              
              results.updated++;
            } else {
              results.skipped++;
            }
          } else if (lead.email) {
            // New lead, check for duplicates by email
            const existingByEmail = await storage.findDuplicateLeads(lead.email);
            
            if (existingByEmail.length > 0) {
              results.skipped++;
              return;
            }
            
            // Convert tags properly
            let tagsArray: string[] = [];
            if (Array.isArray(lead.tags)) {
              tagsArray = lead.tags;
            } else if (typeof lead.tags === 'string' && lead.tags) {
              tagsArray = lead.tags.split(',').map(t => t.trim()).filter(Boolean);
            }
            
            // Create new lead
            const leadData = {
              firstName: lead.firstName || null,
              lastName: lead.lastName || null,
              email: lead.email,
              company: lead.company || null,
              title: lead.title || null,
              phoneNumber: lead.phoneNumber || null,
              website: lead.website || null,
              status: (lead.status || 'active') as any,
              source: 'airtable' as const,
              notes: lead.notes || null,
              priority: (lead.priority || 'medium') as any,
              tags: tagsArray,
              lastContactDate: lead.lastContactDate || null,
              linkedinUrl: null,
              enrichmentStatus: 'not_started' as const,
              emailStatus: 'not_started' as const,
              priorityScore: null,
              priorityReason: null,
              priorityUpdatedAt: null
            };
            
            await storage.addLead(leadData);
            results.created++;
          } else {
            results.skipped++;
          }
        } catch (error) {
          log(`Error processing Airtable lead: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
          results.errors++;
        }
      }));
      
      // Add a small delay between batches
      if (i + batchSize < airtableLeads.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    log(`Airtable check completed: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped, ${results.errors} errors`, 'sync-manager');
    syncInProgress = false;
  } catch (error) {
    log(`Error checking for Airtable changes: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
    syncInProgress = false;
  }
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