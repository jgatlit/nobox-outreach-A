/**
 * This module handles scheduled tasks for the application
 */

import { syncLeadsToAirtable, syncAirtableToLeads } from './airtable/sync';
import { log } from './vite';

// Constants
const SYNC_INTERVALS = {
  // Time between syncs in milliseconds
  LEADS: 5 * 60 * 1000, // 5 minutes
};

// Timers for each scheduled task
const timers: Record<string, NodeJS.Timeout> = {};

/**
 * Start the lead synchronization scheduler
 */
export function startLeadSyncScheduler() {
  log('Starting lead sync scheduler', 'scheduler');
  
  // Cancel any existing timers
  if (timers.leadSync) {
    clearInterval(timers.leadSync);
  }
  
  // Initial sync on startup
  runLeadSync();
  
  // Schedule regular syncs
  timers.leadSync = setInterval(runLeadSync, SYNC_INTERVALS.LEADS);
  
  return {
    success: true,
    message: `Lead sync scheduled every ${SYNC_INTERVALS.LEADS / 1000 / 60} minutes`,
  };
}

/**
 * Stop the lead synchronization scheduler
 */
export function stopLeadSyncScheduler() {
  log('Stopping lead sync scheduler', 'scheduler');
  
  if (timers.leadSync) {
    clearInterval(timers.leadSync);
    delete timers.leadSync;
  }
  
  return {
    success: true,
    message: 'Lead sync scheduler stopped',
  };
}

/**
 * Run the lead synchronization process
 */
async function runLeadSync() {
  log('Running scheduled lead sync', 'scheduler');
  
  try {
    // Sync in both directions
    const toAirtableResult = await syncLeadsToAirtable();
    const fromAirtableResult = await syncAirtableToLeads();
    
    log(`Completed scheduled lead sync. To Airtable: ${toAirtableResult.count || 0} leads. From Airtable: ${fromAirtableResult.count || 0} leads.`, 'scheduler');
    
    return {
      success: toAirtableResult.success && fromAirtableResult.success,
      toAirtable: toAirtableResult,
      fromAirtable: fromAirtableResult,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error in scheduled lead sync: ${errorMessage}`, 'scheduler');
    return { success: false, error: errorMessage };
  }
}

/**
 * Start all schedulers
 */
export function startAllSchedulers() {
  startLeadSyncScheduler();
  // Add more schedulers as needed
}