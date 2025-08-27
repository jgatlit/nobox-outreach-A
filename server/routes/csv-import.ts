/**
 * Simple Intelligent CSV Import Routes
 * Uses LLM for direct transformation of CSV to leads
 */

import { Request, Response } from 'express';
import { upload } from '../middleware/upload';
import { transformCsvToLeads } from '../services/csv-mapper';
import { parseImportFile } from '../importers';
import { db } from '@db';
import { leads } from '@shared/schema';
import fs from 'fs';
import path from 'path';

/**
 * Direct CSV import with LLM intelligence
 */
export async function importCsvFile(req: Request, res: Response) {
  try {
    console.log('📋 CSV Import Request Debug:');
    console.log('- Content-Type:', req.headers['content-type']);
    console.log('- req.file:', req.file);
    console.log('- req.files:', req.files);
    console.log('- req.body:', req.body);
    
    if (!req.file) {
      console.log('❌ No file found in request');
      return res.status(400).json({ 
        success: false,
        error: "No CSV file uploaded" 
      });
    }

    const file = req.file;
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (fileExt !== '.csv') {
      fs.unlinkSync(file.path);
      return res.status(400).json({ 
        success: false,
        error: "Only CSV files are allowed" 
      });
    }

    console.log(`📁 Processing CSV file: ${file.originalname}`);

    // Parse CSV data
    const parsedData = await parseImportFile(file.path, 'csv');
    const csvData = parsedData.data as Record<string, any>[];
    
    if (!csvData || csvData.length === 0) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ 
        success: false,
        error: "No data found in CSV file" 
      });
    }

    console.log(`📊 Parsed ${csvData.length} CSV records`);

    // Transform CSV data directly to leads using LLM
    const result = await transformCsvToLeads(csvData);
    
    if (result.leads.length === 0) {
      fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        error: "No valid leads found in CSV",
        transformationErrors: result.errors
      });
    }

    // Insert leads into database
    let inserted = 0;
    let duplicates = 0;
    const dbErrors: string[] = [];

    for (const leadData of result.leads) {
      try {
        // Check for existing email
        const existing = await db.query.leads.findFirst({
          where: (leads, { eq }) => eq(leads.email, leadData.email)
        });

        if (existing) {
          duplicates++;
          continue;
        }

        // Insert lead
        await db.insert(leads).values({
          ...leadData,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        inserted++;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown database error';
        dbErrors.push(`${leadData.email}: ${errorMsg}`);
        console.error(`Database insertion failed for ${leadData.email}:`, error);
      }
    }

    // Cleanup temp file
    fs.unlinkSync(file.path);

    console.log(`✅ Successfully imported ${inserted}/${result.processed} leads`);

    return res.json({
      success: true,
      message: `Successfully imported ${inserted} leads`,
      results: {
        totalRows: csvData.length,
        processed: result.processed,
        inserted,
        duplicates,
        transformationErrors: result.errors.length,
        dbErrors: dbErrors.length,
        errorDetails: {
          transformation: result.errors.slice(0, 10),
          database: dbErrors.slice(0, 10)
        }
      }
    });

  } catch (error) {
    console.error('CSV import error:', error);
    
    // Cleanup on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      success: false,
      error: "Internal server error during CSV import",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get schema information for frontend reference
 */
export async function getSchemaFields(req: Request, res: Response) {
  const schemaFields = {
    email: { required: true, type: 'string', description: 'Contact email address' },
    firstName: { required: false, type: 'string', description: 'First name' },
    lastName: { required: false, type: 'string', description: 'Last name' },
    company: { required: false, type: 'string', description: 'Company name' },
    title: { required: false, type: 'string', description: 'Job title or position' },
    phoneNumber: { required: false, type: 'string', description: 'Phone number' },
    website: { required: false, type: 'string', description: 'Company website URL' },
    linkedinUrl: { required: false, type: 'string', description: 'LinkedIn profile URL' },
    source: { 
      required: false, 
      type: 'enum', 
      description: 'Lead source (default: import)',
      options: ['pipedrive', 'asana', 'email', 'instantly', 'cyberleads', 'linkedin', 'manual', 'airtable', 'import']
    },
    status: { 
      required: false, 
      type: 'enum', 
      description: 'Lead status (default: active)',
      options: ['active', 'inactive', 'contacted', 'responded', 'qualified', 'disqualified']
    },
    priority: { 
      required: false, 
      type: 'enum', 
      description: 'Priority level (default: medium)',
      options: ['low', 'medium', 'high', 'urgent']
    },
    notes: { required: false, type: 'string', description: 'Additional notes' },
    tags: { required: false, type: 'array', description: 'List of tags' }
  };

  return res.json({ schemaFields });
}

// Route registration function
export function registerIntelligentCsvRoutes(app: any) {
  // Single endpoint for direct CSV import
  app.post('/api/leads/import/csv', upload.single('file'), importCsvFile);
  
  // Get schema fields for reference
  app.get('/api/leads/import/csv/schema', getSchemaFields);
}