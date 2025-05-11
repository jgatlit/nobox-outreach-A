import { Express, Request, Response } from 'express';
import { syncLeadsToAirtable, getLeadsFromAirtable } from './airtable-simple';
import { storage } from './storage';
import { insertLeadSchema } from '../shared/schema';
import { z } from 'zod';

/**
 * Register Airtable-specific routes to the Express app
 */
export function registerAirtableRoutes(app: Express): void {
  // Check Airtable connection
  app.get('/api/airtable/check-connection', async (req: Request, res: Response) => {
    try {
      if (!process.env.AIRTABLE_PAT || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({
          success: false,
          message: 'Airtable credentials are not configured. Please set AIRTABLE_PAT and AIRTABLE_BASE_ID.'
        });
      }
      
      try {
        // Try to fetch leads to verify connection works
        const leads = await getLeadsFromAirtable();
        
        return res.status(200).json({
          success: true,
          message: 'Successfully connected to Airtable',
          recordCount: leads.length,
          baseId: process.env.AIRTABLE_BASE_ID
        });
      } catch (error) {
        // Check if this is a field name error
        if (error.message && error.message.includes('Unknown field name')) {
          return res.status(200).json({
            success: true,
            message: 'Connected to Airtable, but the Leads table structure needs to be set up. Sync to Airtable to create the necessary fields.',
            baseId: process.env.AIRTABLE_BASE_ID,
            needsSetup: true
          });
        }
        
        // Check if this is a table not found error
        if (error.message && error.message.includes('not found')) {
          return res.status(200).json({
            success: true,
            message: 'Connected to Airtable, but the Leads table doesn\'t exist. Create a Leads table in your Airtable base first.',
            baseId: process.env.AIRTABLE_BASE_ID,
            needsTable: true
          });
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Airtable connection check failed:', error);
      return res.status(500).json({
        success: false,
        message: `Failed to connect to Airtable: ${error.message}`
      });
    }
  });

  // Sync leads from PostgreSQL to Airtable
  app.post('/api/airtable/sync-to-airtable', async (req: Request, res: Response) => {
    try {
      // Get all leads from PostgreSQL
      const leads = await storage.getAllLeads();
      
      if (leads.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No leads to sync to Airtable'
        });
      }
      
      try {
        // Sync leads to Airtable
        const syncedCount = await syncLeadsToAirtable(leads);
        
        return res.status(200).json({
          success: true,
          message: `Successfully synced ${syncedCount} leads to Airtable`,
          syncedCount
        });
      } catch (error) {
        // Check if this is a field name error
        if (error.message && error.message.includes('Unknown field name')) {
          return res.status(400).json({
            success: false,
            message: `Airtable sync failed: ${error.message}. Create a field in your Airtable Leads table with this name.`,
            fieldError: true,
            missingField: error.message.split('"')[1] || ''
          });
        }
        
        // Check if table doesn't exist
        if (error.message && error.message.toLowerCase().includes('not found')) {
          return res.status(400).json({
            success: false,
            message: `Airtable sync failed: The "Leads" table doesn't exist in your Airtable base. Please create it first.`,
            tableError: true
          });
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Error syncing to Airtable:', error);
      return res.status(500).json({
        success: false,
        message: `Failed to sync leads to Airtable: ${error.message}`
      });
    }
  });

  // Sync leads from Airtable to PostgreSQL
  app.post('/api/airtable/sync-from-airtable', async (req: Request, res: Response) => {
    try {
      // Get leads from Airtable
      const airtableLeads = await getLeadsFromAirtable();
      
      if (airtableLeads.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No leads found in Airtable to sync'
        });
      }
      
      // Process each lead from Airtable
      const results = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0
      };
      
      for (const airtableLead of airtableLeads) {
        try {
          // If lead has PostgreSQL ID, it's an update
          if (airtableLead.id) {
            // Check if lead exists
            const existingLead = await storage.getLeadById(airtableLead.id);
            
            if (existingLead) {
              // Update existing lead
              await storage.updateLead(airtableLead.id, {
                firstName: airtableLead.firstName,
                lastName: airtableLead.lastName,
                email: airtableLead.email,
                company: airtableLead.company,
                title: airtableLead.title,
                phone: airtableLead.phone,
                website: airtableLead.website,
                status: airtableLead.status,
                source: airtableLead.source,
                notes: airtableLead.notes,
                priority: airtableLead.priority,
                tags: airtableLead.tags,
                lastContact: airtableLead.lastContact
              });
              results.updated++;
            } else {
              // Lead ID doesn't exist in PostgreSQL, so create new
              // First check if we have a lead with this email already
              const existingByEmail = await storage.findDuplicateLeads(airtableLead.email);
              
              if (existingByEmail.length > 0) {
                // Skip, this is a duplicate
                results.skipped++;
                continue;
              }
              
              // Create as new lead without ID constraint
              const leadData = {
                firstName: airtableLead.firstName,
                lastName: airtableLead.lastName,
                email: airtableLead.email,
                company: airtableLead.company || '',
                title: airtableLead.title || '',
                phone: airtableLead.phone || '',
                website: airtableLead.website || '',
                status: airtableLead.status || 'new',
                source: 'airtable',
                notes: airtableLead.notes || '',
                priority: airtableLead.priority || 'medium',
                tags: airtableLead.tags || '',
                lastContact: airtableLead.lastContact
              };
              
              // Validate and insert
              const validLead = insertLeadSchema.parse(leadData);
              await storage.addLead(validLead);
              results.created++;
            }
          } else {
            // This is a new lead from Airtable without PostgreSQL ID
            // Check for duplication by email
            const existingByEmail = await storage.findDuplicateLeads(airtableLead.email);
            
            if (existingByEmail.length > 0) {
              // Skip, this is a duplicate
              results.skipped++;
              continue;
            }
            
            // Create as new lead
            const leadData = {
              firstName: airtableLead.firstName,
              lastName: airtableLead.lastName,
              email: airtableLead.email,
              company: airtableLead.company || '',
              title: airtableLead.title || '',
              phone: airtableLead.phone || '',
              website: airtableLead.website || '',
              status: airtableLead.status || 'new',
              source: 'airtable',
              notes: airtableLead.notes || '',
              priority: airtableLead.priority || 'medium',
              tags: airtableLead.tags || '',
              lastContact: airtableLead.lastContact
            };
            
            // Validate and insert
            const validLead = insertLeadSchema.parse(leadData);
            await storage.addLead(validLead);
            results.created++;
          }
        } catch (error) {
          console.error(`Error processing Airtable lead ${airtableLead.email}:`, error);
          results.errors++;
          
          // Continue with next lead
          continue;
        }
      }
      
      return res.status(200).json({
        success: true,
        message: `Airtable sync completed: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped, ${results.errors} errors`,
        results
      });
    } catch (error) {
      console.error('Error syncing from Airtable:', error);
      return res.status(500).json({
        success: false,
        message: `Failed to sync leads from Airtable: ${error.message}`
      });
    }
  });
}