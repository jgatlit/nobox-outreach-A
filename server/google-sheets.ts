import { google } from 'googleapis';
import { log } from './vite';
import { type Lead } from '@shared/schema';

// Initialize the Google Sheets API
const sheets = google.sheets({
  version: 'v4',
  auth: process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY,
});

/**
 * Extract spreadsheet ID from a Google Sheets URL
 * @param url Google Sheets URL
 * @returns Spreadsheet ID or null if not valid
 */
export function extractSpreadsheetId(url: string): string | null {
  // Handle full URLs
  // Example: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
  const fullUrlRegex = /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;
  const fullUrlMatch = url.match(fullUrlRegex);
  if (fullUrlMatch && fullUrlMatch[1]) {
    return fullUrlMatch[1];
  }

  // Handle short URLs
  // Example: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
  const shortUrlRegex = /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;
  const shortUrlMatch = url.match(shortUrlRegex);
  if (shortUrlMatch && shortUrlMatch[1]) {
    return shortUrlMatch[1];
  }

  // Handle direct IDs
  // Example: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
  const idRegex = /^[a-zA-Z0-9_-]{20,}$/;
  if (idRegex.test(url)) {
    return url;
  }

  return null;
}

/**
 * Get sheet information from a Google Sheets spreadsheet
 * @param spreadsheetId Spreadsheet ID
 * @returns Array of sheet names and IDs
 */
export async function getSheetInfo(spreadsheetId: string): Promise<{ name: string; sheetId: number }[]> {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });

    if (!response.data.sheets) {
      return [];
    }

    return response.data.sheets.map((sheet) => {
      const properties = sheet.properties!;
      return {
        name: properties.title!,
        sheetId: properties.sheetId!,
      };
    });
  } catch (error) {
    log(`Error getting sheet info: ${error instanceof Error ? error.message : String(error)}`, 'google-sheets');
    throw new Error(`Failed to get sheet information: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get column names from the first row of a sheet
 * @param spreadsheetId Spreadsheet ID
 * @param sheetName Sheet name
 * @returns Array of column names
 */
export async function getSheetColumns(spreadsheetId: string, sheetName: string): Promise<string[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`, // First row only
    });

    if (!response.data.values || response.data.values.length === 0) {
      return [];
    }

    return response.data.values[0].map(column => String(column));
  } catch (error) {
    log(`Error getting sheet columns: ${error instanceof Error ? error.message : String(error)}`, 'google-sheets');
    throw new Error(`Failed to get sheet columns: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get data from a Google Sheets spreadsheet
 * @param spreadsheetId Spreadsheet ID
 * @param sheetName Sheet name
 * @returns Array of rows as objects with column names as keys
 */
export async function getSheetData(spreadsheetId: string, sheetName: string): Promise<Record<string, string>[]> {
  try {
    // First, get the column names from the first row
    const columns = await getSheetColumns(spreadsheetId, sheetName);
    
    if (columns.length === 0) {
      throw new Error('No columns found in the sheet');
    }

    // Then get all the data rows
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:Z1000`, // Skip header row, limit to 1000 rows
    });

    if (!response.data.values) {
      return [];
    }

    // Map each row to an object using column names as keys
    return response.data.values.map(row => {
      const rowObject: Record<string, string> = {};
      
      // Add each cell value with its corresponding column name
      columns.forEach((column, index) => {
        rowObject[column] = index < row.length ? String(row[index]) : '';
      });
      
      return rowObject;
    });
  } catch (error) {
    log(`Error getting sheet data: ${error instanceof Error ? error.message : String(error)}`, 'google-sheets');
    throw new Error(`Failed to get sheet data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert sheet data to lead objects
 * @param data Array of row objects
 * @param columnMapping Mapping of sheet columns to lead fields
 * @returns Array of lead objects
 */
export function mapSheetDataToLeads(
  data: Record<string, string>[],
  columnMapping: Record<string, string>
): Partial<Lead>[] {
  return data.map(row => {
    const lead: Partial<Lead> = {
      source: 'manual', // Default source
    };

    // Map each field using the column mapping
    Object.entries(columnMapping).forEach(([leadField, sheetColumn]) => {
      if (sheetColumn && row[sheetColumn] !== undefined) {
        // Handle special cases
        if (leadField === 'tags' && row[sheetColumn]) {
          // Convert comma-separated tags to array
          (lead as any)[leadField] = row[sheetColumn].split(',').map(tag => tag.trim());
        } else {
          (lead as any)[leadField] = row[sheetColumn];
        }
      }
    });

    return lead;
  }).filter(lead => lead.email); // Filter out leads without email (required field)
}

/**
 * Get workbook information and sheet data preview
 * @param spreadsheetId Google Sheets spreadsheet ID
 * @returns Workbook info with sheets and preview data
 */
export async function getWorkbookInfo(spreadsheetId: string): Promise<{
  title: string;
  sheets: {
    name: string;
    sheetId: number;
    columns: string[];
    previewData: Record<string, string>[];
  }[];
}> {
  try {
    // Get spreadsheet metadata
    const metadataResponse = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title,sheets.properties',
    });

    const title = metadataResponse.data.properties?.title || 'Untitled Spreadsheet';
    const sheetsList = metadataResponse.data.sheets || [];

    // Get data for each sheet
    const sheetsData = await Promise.all(
      sheetsList.map(async (sheet) => {
        const sheetName = sheet.properties!.title!;
        const sheetId = sheet.properties!.sheetId!;
        
        // Get columns (first row)
        const columns = await getSheetColumns(spreadsheetId, sheetName);
        
        // Get preview data (first 5 rows after header)
        const previewResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A2:Z6`, // Rows 2-6 (after header)
        });
        
        const previewRows = previewResponse.data.values || [];
        const previewData = previewRows.map(row => {
          const rowObject: Record<string, string> = {};
          columns.forEach((column, index) => {
            rowObject[column] = index < row.length ? String(row[index]) : '';
          });
          return rowObject;
        });
        
        return {
          name: sheetName,
          sheetId,
          columns,
          previewData,
        };
      })
    );

    return {
      title,
      sheets: sheetsData,
    };
  } catch (error) {
    log(`Error getting workbook info: ${error instanceof Error ? error.message : String(error)}`, 'google-sheets');
    throw new Error(`Failed to get workbook information: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}