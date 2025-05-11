import { Express, Request, Response } from 'express';
import { storage } from './storage';
import { extractSpreadsheetId, getWorkbookInfo, getSheetData, mapSheetDataToLeads } from './google-sheets';
import { Lead } from '@shared/schema';
import { log } from './vite';

export function registerGoogleSheetsRoutes(app: Express): void {
  /**
   * Validate a Google Sheets URL and return spreadsheet information
   */
  app.post('/api/sheets/validate', async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({
          success: false,
          message: 'Google Sheets URL is required'
        });
      }
      
      const spreadsheetId = extractSpreadsheetId(url);
      
      if (!spreadsheetId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Google Sheets URL format'
        });
      }
      
      const workbookInfo = await getWorkbookInfo(spreadsheetId);
      
      return res.status(200).json({
        success: true,
        spreadsheetId,
        workbookInfo
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Error validating Google Sheet: ${errorMessage}`, 'sheets-routes');
      
      // Provide more specific error messages to the frontend based on the error type
      let clientMessage = 'Failed to validate Google Sheet';
      
      if (errorMessage.includes('permission')) {
        clientMessage = 'The caller does not have permission. Make sure the spreadsheet is shared with "Anyone with the link" or check your API key.';
      } else if (errorMessage.includes('not found')) {
        clientMessage = 'The specified spreadsheet could not be found. Check if the URL is correct.';
      } else if (errorMessage.includes('API key')) {
        clientMessage = 'Invalid or missing API key. Please check your Google Sheets API credentials.';
      } else {
        clientMessage = errorMessage;
      }
      
      return res.status(500).json({
        success: false,
        message: clientMessage
      });
    }
  });

  /**
   * Import leads from a Google Sheets spreadsheet
   */
  app.post('/api/sheets/import', async (req: Request, res: Response) => {
    try {
      const { spreadsheetId, sheetName, columnMapping } = req.body;
      
      if (!spreadsheetId || !sheetName || !columnMapping) {
        return res.status(400).json({
          success: false,
          message: 'Spreadsheet ID, sheet name, and column mapping are required'
        });
      }

      // Get data from the sheet
      const sheetData = await getSheetData(spreadsheetId, sheetName);
      
      if (sheetData.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No data found in the specified sheet'
        });
      }
      
      // Map sheet data to leads
      const mappedLeads = mapSheetDataToLeads(sheetData, columnMapping);
      
      if (mappedLeads.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid lead data found. Ensure email column is mapped correctly.'
        });
      }
      
      // Process results
      const importResults = {
        totalProcessed: mappedLeads.length,
        imported: 0,
        skipped: 0,
        errors: 0,
        errorDetails: [] as string[]
      };
      
      // Import each lead
      for (const leadData of mappedLeads) {
        try {
          // Validate required fields
          if (!leadData.email) {
            importResults.skipped++;
            importResults.errorDetails.push(`Skipped lead: Missing email`);
            continue;
          }
          
          // Check for duplicates
          const existingLeads = await storage.findDuplicateLeads(leadData.email);
          
          if (existingLeads.length > 0) {
            importResults.skipped++;
            importResults.errorDetails.push(`Skipped lead ${leadData.email}: Email already exists`);
            continue;
          }
          
          // Add new lead
          const finalLeadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> = {
            firstName: leadData.firstName || null,
            lastName: leadData.lastName || null,
            email: leadData.email,
            company: leadData.company || null,
            title: leadData.title || null,
            phoneNumber: leadData.phoneNumber || null,
            website: leadData.website || null,
            linkedinUrl: leadData.linkedinUrl || null,
            source: 'manual', // Default source for Google Sheets
            status: leadData.status as any || 'active',
            priority: leadData.priority as any || 'medium',
            notes: leadData.notes || null,
            tags: Array.isArray(leadData.tags) ? leadData.tags : [],
            lastContactDate: leadData.lastContactDate ? new Date(leadData.lastContactDate) : null,
            enrichmentStatus: 'not_started',
            emailStatus: 'not_started',
            priorityScore: null,
            priorityReason: null,
            priorityUpdatedAt: null
          };
          
          await storage.addLead(finalLeadData);
          importResults.imported++;
        } catch (error) {
          importResults.errors++;
          importResults.errorDetails.push(
            `Error importing lead ${leadData.email}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
      
      return res.status(200).json({
        success: true,
        results: importResults
      });
    } catch (error) {
      log(`Error importing from Google Sheet: ${error instanceof Error ? error.message : String(error)}`, 'sheets-routes');
      return res.status(500).json({
        success: false,
        message: `Failed to import from Google Sheet: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });
}