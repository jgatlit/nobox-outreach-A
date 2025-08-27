/**
 * Intelligent CSV Import Service
 * Uses LLM to directly transform CSV data to leads
 */

import OpenAI from 'openai';
import { z } from 'zod';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Lead transformation result schema
const TransformationResultSchema = z.object({
  leads: z.array(z.object({
    email: z.string(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    linkedinUrl: z.string().nullable().optional(),
    source: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    notes: z.string().nullable().optional(),
    tags: z.array(z.string()).nullable().optional()
  })),
  processed: z.number(),
  errors: z.array(z.string())
});

type TransformationResult = z.infer<typeof TransformationResultSchema>;

/**
 * Transform CSV data directly to leads using LLM intelligence
 */
export async function transformCsvToLeads(
  csvData: Record<string, any>[]
): Promise<TransformationResult> {
  if (!csvData || csvData.length === 0) {
    return { leads: [], processed: 0, errors: ['No CSV data provided'] };
  }

  const prompt = `
Transform this CSV data into clean lead records. Intelligently map CSV columns to lead fields regardless of naming conventions.

**CSV Data** (${csvData.length} records):
${JSON.stringify(csvData, null, 2)}

**Output Schema - Transform each CSV row to this exact format**:
{
  "email": "required - contact email address",
  "firstName": "optional - first name", 
  "lastName": "optional - last name",
  "company": "optional - company name",
  "title": "optional - job title",
  "phoneNumber": "optional - phone number",
  "website": "optional - website URL",
  "linkedinUrl": "optional - LinkedIn profile URL",
  "source": "optional - default 'import'",
  "status": "optional - default 'active'", 
  "priority": "optional - default 'medium'",
  "notes": "optional - additional notes",
  "tags": "optional - array of tags"
}

**INTELLIGENT MAPPING RULES**:
- Find email fields: "email", "Email Address", "E-mail", "contact_email", etc.
- Find name fields: "First Name"/"Last Name", "fname"/"lname", or split "Full Name"
- Find company: "Company", "Company Name", "Organization", "Business", etc.
- Find title: "Job Title", "Title", "Position", "Role", etc.
- Find phone: "Phone", "Direct Phone Number", "Mobile", "Telephone", etc.
- Find website: "Website", "URL", "Company Website", etc.
- Find LinkedIn: "LinkedIn", "LinkedIn Profile URL", "LinkedIn Contact Profile URL", etc.

**CRITICAL REQUIREMENTS**:
- Every lead MUST have a valid email address
- Clean and format phone numbers, URLs, names
- Use defaults: source="import", status="active", priority="medium"
- Return ONLY valid JSON matching this exact structure:

{
  "leads": [
    {
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "company": "Acme Corp",
      "title": "CEO",
      "phoneNumber": "(555) 123-4567",
      "website": "https://example.com",
      "linkedinUrl": "https://linkedin.com/in/johndoe",
      "source": "import",
      "status": "active",
      "priority": "medium",
      "notes": null,
      "tags": null
    }
  ],
  "processed": 1,
  "errors": []
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert data transformation specialist. Transform CSV data directly to lead records with intelligent field mapping. Return only valid JSON responses. Ensure all JSON strings are properly terminated and escaped.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const rawContent = response.choices[0].message.content || '{}';
    
    // Enhanced JSON parsing with better error handling
    let result;
    try {
      result = JSON.parse(rawContent);
    } catch (jsonError) {
      console.error('JSON parsing failed, attempting to clean content:', jsonError);
      
      // Try to clean common JSON issues
      let cleanedContent = rawContent;
      
      // Remove any trailing incomplete strings or objects
      const lastValidBrace = cleanedContent.lastIndexOf('}');
      if (lastValidBrace > 0) {
        cleanedContent = cleanedContent.substring(0, lastValidBrace + 1);
      }
      
      // Try parsing the cleaned content
      try {
        result = JSON.parse(cleanedContent);
        console.log('✅ Successfully parsed cleaned JSON');
      } catch (secondError) {
        console.error('Even cleaned JSON parsing failed, using fallback:', secondError);
        throw new Error('JSON parsing completely failed');
      }
    }

    // Validate the result schema
    const validatedResult = TransformationResultSchema.parse(result);
    console.log(`✅ LLM transformation successful: ${validatedResult.leads.length} leads processed`);
    return validatedResult;

  } catch (error) {
    console.error('LLM transformation failed:', error);
    console.log('🔄 Falling back to rule-based transformation');
    
    // Fallback to simple mapping
    return fallbackTransformation(csvData);
  }
}

/**
 * Fallback transformation when LLM fails
 */
function fallbackTransformation(csvData: Record<string, any>[]): TransformationResult {
  const leads: any[] = [];
  const errors: string[] = [];

  csvData.forEach((row, index) => {
    try {
      const lead: any = {
        source: 'import',
        status: 'active', 
        priority: 'medium'
      };

      // Find email field
      const emailField = Object.keys(row).find(key => 
        /email/i.test(key) || key.toLowerCase().includes('e-mail')
      );
      if (emailField && row[emailField]) {
        lead.email = String(row[emailField]).trim().toLowerCase();
      }

      // Find name fields
      const firstNameField = Object.keys(row).find(key => 
        /first.*name|fname/i.test(key)
      );
      const lastNameField = Object.keys(row).find(key => 
        /last.*name|lname|surname/i.test(key)
      );
      if (firstNameField) lead.firstName = String(row[firstNameField]).trim();
      if (lastNameField) lead.lastName = String(row[lastNameField]).trim();

      // Find company
      const companyField = Object.keys(row).find(key => 
        /company|organization|business/i.test(key)
      );
      if (companyField) lead.company = String(row[companyField]).trim();

      // Find title
      const titleField = Object.keys(row).find(key => 
        /title|position|role/i.test(key)
      );
      if (titleField) lead.title = String(row[titleField]).trim();

      // Find phone
      const phoneField = Object.keys(row).find(key => 
        /phone|mobile|tel/i.test(key)
      );
      if (phoneField) lead.phoneNumber = String(row[phoneField]).trim();

      // Find website
      const websiteField = Object.keys(row).find(key => 
        /website|url/i.test(key) && !/linkedin/i.test(key)
      );
      if (websiteField) {
        const website = String(row[websiteField]).trim();
        lead.website = website.startsWith('http') ? website : `https://${website}`;
      }

      // Find LinkedIn
      const linkedinField = Object.keys(row).find(key => 
        /linkedin/i.test(key)
      );
      if (linkedinField) lead.linkedinUrl = String(row[linkedinField]).trim();

      if (!lead.email) {
        throw new Error('Email is required');
      }

      leads.push(lead);

    } catch (error) {
      errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  return { leads, processed: leads.length, errors };
}