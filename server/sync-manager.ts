import { log } from './vite';
import { syncLeadsToAirtable, getLeadsFromAirtable } from './airtable-simple';
import { storage } from './storage';

/**
 * Time interval for Airtable sync (in milliseconds)
 * 5 minutes = 5 * 60 * 1000 = 300000 ms
 */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

// Track the running sync interval
let syncIntervalId: NodeJS.Timeout | null = null;

/**
 * Perform a bi-directional sync between PostgreSQL and Airtable
 * This is the main sync function that will be called periodically
 */
async function performBidirectionalSync(): Promise<void> {
  try {
    log('Starting bidirectional sync with Airtable...', 'sync-manager');

    // Step 1: Sync from PostgreSQL to Airtable
    try {
      const leads = await storage.getAllLeads();
      log(`Syncing ${leads.length} leads to Airtable...`, 'sync-manager');
      const result = await syncLeadsToAirtable(leads);
      log(`Successfully synced ${result.count} leads to Airtable`, 'sync-manager');
    } catch (error) {
      log(`Error syncing to Airtable: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
      // Continue with the next step even if this fails
    }

    // Step 2: Sync from Airtable to PostgreSQL
    try {
      const airtableLeads = await getLeadsFromAirtable();
      log(`Syncing ${airtableLeads.length} leads from Airtable...`, 'sync-manager');
      
      // Process results - actual import is handled in the function
      const results = {
        created: 0,
        updated: 0,
        skipped: 0, 
        errors: 0
      };
      
      for (const lead of airtableLeads) {
        try {
          // If lead has PostgreSQL ID, it's an update
          if (lead.id) {
            // Check if lead exists
            const existingLead = await storage.getLeadById(lead.id);
            
            if (existingLead) {
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
                tags: lead.tags,
                lastContactDate: lead.lastContactDate
              });
              results.updated++;
            } else {
              // Skip if the ID doesn't exist in our system
              results.skipped++;
            }
          } else {
            // This is a new lead from Airtable without PostgreSQL ID
            // Check for duplication by email
            const existingByEmail = await storage.findDuplicateLeads(lead.email);
            
            if (existingByEmail.length > 0) {
              // Skip, this is a duplicate
              results.skipped++;
              continue;
            }
            
            // Create as new lead with source "airtable"
            const leadData = {
              firstName: lead.firstName,
              lastName: lead.lastName,
              email: lead.email,
              company: lead.company || '',
              title: lead.title || '',
              phoneNumber: lead.phoneNumber || '',
              website: lead.website || '',
              status: (lead.status || 'active') as any, // Map to our schema enum
              source: 'airtable' as const, // Set source to airtable
              notes: lead.notes || '',
              priority: (lead.priority || 'medium') as any, // Map to our schema enum
              tags: Array.isArray(lead.tags) ? lead.tags : typeof lead.tags === 'string' ? [lead.tags] : [], // Ensure tags is an array
              lastContactDate: lead.lastContactDate || null
            };
            
            // Add the lead
            await storage.addLead(leadData);
            results.created++;
          }
        } catch (error) {
          log(`Error processing Airtable lead ${lead.email}: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
          results.errors++;
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
 * Sync a single lead to Airtable
 * This can be called when a new lead is added to PostgreSQL
 */
export async function syncLeadToAirtable(leadId: number): Promise<void> {
  try {
    const lead = await storage.getLeadById(leadId);
    if (!lead) {
      log(`Cannot sync lead ${leadId} to Airtable: Lead not found`, 'sync-manager');
      return;
    }
    
    log(`Syncing single lead ${lead.id} (${lead.email}) to Airtable...`, 'sync-manager');
    const result = await syncLeadsToAirtable([lead]);
    log(`Successfully synced lead ${lead.id} to Airtable`, 'sync-manager');
  } catch (error) {
    log(`Error syncing lead ${leadId} to Airtable: ${error instanceof Error ? error.message : String(error)}`, 'sync-manager');
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
  
  // Run an initial sync
  performBidirectionalSync();
  
  // Set up the interval
  syncIntervalId = setInterval(performBidirectionalSync, SYNC_INTERVAL_MS);
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