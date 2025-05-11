/**
 * Airtable API Routes
 * 
 * This file contains Express route handlers related to Airtable integration.
 */

import { Request, Response } from 'express';
import { createLeadsTable } from './schema';
import { startAirtableServer } from './server';
import { getSyncStatus, triggerFullSync } from './sync';

/**
 * Create the Leads table in Airtable for synchronization
 */
export async function createLeadsTableHandler(req: Request, res: Response) {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID;
    
    if (!baseId) {
      return res.status(400).json({
        success: false,
        message: "Airtable base ID is not configured"
      });
    }
    
    // Create the Leads table
    const result = await createLeadsTable(baseId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
    
    // If table creation was successful, trigger a full sync to populate it
    await triggerFullSync();
    
    return res.json({
      success: true,
      message: result.message,
      tableId: result.tableId
    });
  } catch (error) {
    console.error('[airtable] Table creation error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to create Airtable table",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get the current synchronization status
 */
export async function getSyncStatusHandler(req: Request, res: Response) {
  try {
    const status = await getSyncStatus();
    return res.json(status);
  } catch (error) {
    console.error('[airtable] Error getting sync status:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to get synchronization status",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Configure Airtable with API key and base ID
 */
export async function configureAirtableHandler(req: Request, res: Response) {
  try {
    const { apiKey, baseId } = req.body;
    
    if (!apiKey && !baseId) {
      return res.status(400).json({
        success: false,
        message: 'No configuration changes provided'
      });
    }
    
    // Save API key to environment
    if (apiKey) {
      // Format is "Bearer patXXXXXXXXXXXXXX" for Airtable PAT
      // or just "patXXXXXXXXXXXXXX" is also acceptable
      // Store the API key as-is
      process.env.AIRTABLE_API_KEY = apiKey;
      console.log('[airtable] API key has been updated');
    }
    
    if (baseId) {
      process.env.AIRTABLE_BASE_ID = baseId;
      console.log('[airtable] Base ID has been updated to', baseId);
    }
    
    // Test the new credentials
    try {
      const testUrl = `https://api.airtable.com/v0/${baseId || process.env.AIRTABLE_BASE_ID}/Conversations?maxRecords=1`;
      
      // Format the API key properly
      let authHeader = apiKey || process.env.AIRTABLE_API_KEY || '';
      
      // If it's a PAT (starts with "pat") but doesn't have "Bearer " prefix, add it
      if (authHeader.startsWith('pat') && !authHeader.startsWith('Bearer ')) {
        authHeader = `Bearer ${authHeader}`;
        console.log('[airtable] Added Bearer prefix to PAT for API test');
      }
      
      const testResponse = await fetch(testUrl, {
        headers: {
          'Authorization': authHeader
        }
      });
      
      if (testResponse.ok) {
        console.log('[airtable] Test connection successful');
      } else {
        const errorText = await testResponse.text();
        console.error('[airtable] Test connection failed:', errorText);
      }
      
      // Restart the Airtable server
      try {
        console.log('[airtable] Restarting Airtable MCP server with new credentials...');
        const serverStatus = await startAirtableServer();
        
        return res.json({
          success: true,
          message: 'Airtable configuration updated successfully',
          connectionTest: {
            success: testResponse.ok,
            status: testResponse.status,
            statusText: testResponse.statusText
          },
          serverRestarted: Boolean(serverStatus)
        });
      } catch (serverError: any) {
        console.error('[airtable] Error restarting Airtable server:', serverError);
        return res.json({
          success: true,
          message: 'Airtable configuration updated but server restart failed',
          connectionTest: {
            success: testResponse.ok,
            status: testResponse.status,
            statusText: testResponse.statusText
          },
          serverError: serverError?.message || String(serverError)
        });
      }
    } catch (testError: any) {
      console.error('[airtable] Error testing new credentials:', testError);
      return res.status(500).json({
        success: false,
        message: 'Failed to test new Airtable credentials',
        error: testError?.message || String(testError)
      });
    }
  } catch (error: any) {
    console.error('[airtable] Error updating configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Airtable configuration',
      error: error?.message || String(error)
    });
  }
}

/**
 * Trigger a full sync between PostgreSQL and Airtable
 */
export async function triggerFullSyncHandler(req: Request, res: Response) {
  try {
    const result = await triggerFullSync();
    return res.json({
      success: true,
      message: 'Full synchronization started',
      result
    });
  } catch (error) {
    console.error('[airtable] Error triggering full sync:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to trigger full synchronization',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}