import { parse as parseCsv } from 'papaparse';
import { z } from 'zod';
import { db } from '@/db';
import { leadEnrichment } from '@/shared/schema';
import fs from 'fs';
import { eq } from 'drizzle-orm';

// Generic file parser based on file extension
export async function parseImportFile(
  filePath: string,
  fileType: 'csv' | 'json' | 'xml' | 'md'
): Promise<Record<string, any>> {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    switch (fileType) {
      case 'csv':
        const result = parseCsv(fileContent, {
          header: true,
          skipEmptyLines: true,
        });
        return { data: result.data, errors: result.errors };
      
      case 'json':
        return JSON.parse(fileContent);
      
      case 'xml':
        // Simple XML parsing - for production, use a dedicated XML parser
        const xmlData = {};
        // Extract content between tags using regex
        const tagMatches = fileContent.match(/<([^>]+)>([^<]+)<\/[^>]+>/g);
        if (tagMatches) {
          tagMatches.forEach(match => {
            const tagMatch = match.match(/<([^>]+)>([^<]+)<\/[^>]+>/);
            if (tagMatch && tagMatch.length === 3) {
              xmlData[tagMatch[1]] = tagMatch[2].trim();
            }
          });
        }
        return xmlData;
      
      case 'md':
        // Simple markdown parsing for structured data
        const mdData = { sections: {} };
        const sections = fileContent.split('## ');
        
        // Process the header section (without ##)
        if (sections[0] && !sections[0].startsWith('##')) {
          mdData['header'] = sections[0].trim();
        }
        
        // Process other sections
        for (let i = 1; i < sections.length; i++) {
          const section = sections[i];
          const lines = section.split('\n');
          const sectionName = lines[0].trim();
          const sectionContent = lines.slice(1).join('\n').trim();
          mdData.sections[sectionName] = sectionContent;
        }
        
        return mdData;
      
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error('Error parsing import file:', error);
    throw new Error(`Failed to parse ${fileType} file: ${error.message}`);
  }
}

// Asana project data import
export async function importAsanaData(
  filePath: string,
  fileType: 'csv' | 'json' | 'xml' | 'md',
  leadId: number
): Promise<{ success: boolean; message: string }> {
  try {
    const parsedData = await parseImportFile(filePath, fileType);
    
    // Process Asana data into our format
    const projectHistory = {
      pastProjects: [],
      currentProjects: [],
    };
    
    // Process the data based on file type
    if (fileType === 'csv') {
      const projects = parsedData.data as any[];
      
      // Map CSV data to project structure
      projects.forEach(project => {
        const projectData = {
          name: project.name || project.project_name || 'Unnamed Project',
          description: project.description || project.notes || '',
          status: project.status || 'unknown',
          completionDate: project.completion_date || project.completed_at || '',
          keyOutcomes: project.key_outcomes ? project.key_outcomes.split(',').map(item => item.trim()) : [],
          milestones: project.milestones ? project.milestones.split(',').map(item => item.trim()) : [],
        };
        
        // Add to past or current projects based on status
        if (['completed', 'done', 'finished', 'closed'].includes(projectData.status.toLowerCase())) {
          projectHistory.pastProjects.push(projectData);
        } else {
          projectHistory.currentProjects.push(projectData);
        }
      });
    } else if (fileType === 'json') {
      // Assume JSON has pastProjects and currentProjects arrays
      if (Array.isArray(parsedData.projects) || Array.isArray(parsedData.tasks)) {
        const projects = parsedData.projects || parsedData.tasks || [];
        
        projects.forEach(project => {
          const projectData = {
            name: project.name || project.title || 'Unnamed Project',
            description: project.description || project.notes || '',
            status: project.status || 'unknown',
            completionDate: project.completed_at || project.completion_date || '',
            keyOutcomes: Array.isArray(project.key_outcomes) ? project.key_outcomes : [],
            milestones: Array.isArray(project.milestones) ? project.milestones : [],
          };
          
          // Add to past or current projects based on status
          if (['completed', 'done', 'finished', 'closed'].includes(projectData.status.toLowerCase())) {
            projectHistory.pastProjects.push(projectData);
          } else {
            projectHistory.currentProjects.push(projectData);
          }
        });
      } else {
        // Direct structure mapping
        if (parsedData.pastProjects) {
          projectHistory.pastProjects = parsedData.pastProjects;
        }
        if (parsedData.currentProjects) {
          projectHistory.currentProjects = parsedData.currentProjects;
        }
      }
    } else if (fileType === 'md') {
      // Parse markdown structure
      const sections = parsedData.sections;
      
      if (sections['Past Projects']) {
        const pastProjectsText = sections['Past Projects'];
        const projectEntries = pastProjectsText.split('### ').filter(entry => entry.trim().length > 0);
        
        projectEntries.forEach(entry => {
          const lines = entry.split('\n');
          const name = lines[0].trim();
          let description = '';
          let status = 'completed';
          let completionDate = '';
          const keyOutcomes = [];
          
          lines.slice(1).forEach(line => {
            if (line.startsWith('- Status:')) {
              status = line.replace('- Status:', '').trim();
            } else if (line.startsWith('- Completed:')) {
              completionDate = line.replace('- Completed:', '').trim();
            } else if (line.startsWith('- Description:')) {
              description = line.replace('- Description:', '').trim();
            } else if (line.startsWith('- Outcome:')) {
              keyOutcomes.push(line.replace('- Outcome:', '').trim());
            }
          });
          
          projectHistory.pastProjects.push({
            name,
            description,
            status,
            completionDate,
            keyOutcomes
          });
        });
      }
      
      if (sections['Current Projects']) {
        const currentProjectsText = sections['Current Projects'];
        const projectEntries = currentProjectsText.split('### ').filter(entry => entry.trim().length > 0);
        
        projectEntries.forEach(entry => {
          const lines = entry.split('\n');
          const name = lines[0].trim();
          let description = '';
          let status = 'in_progress';
          const milestones = [];
          
          lines.slice(1).forEach(line => {
            if (line.startsWith('- Status:')) {
              status = line.replace('- Status:', '').trim();
            } else if (line.startsWith('- Description:')) {
              description = line.replace('- Description:', '').trim();
            } else if (line.startsWith('- Milestone:')) {
              milestones.push(line.replace('- Milestone:', '').trim());
            }
          });
          
          projectHistory.currentProjects.push({
            name,
            description,
            status,
            milestones
          });
        });
      }
    }
    
    // Get existing enrichment data
    const existingEnrichment = await db.query.leadEnrichment.findFirst({
      where: eq(leadEnrichment.leadId, leadId)
    });
    
    // Update or create enrichment record with project history
    if (existingEnrichment) {
      // Update existing record
      await db.update(leadEnrichment)
        .set({
          projectHistory: JSON.stringify(projectHistory)
        })
        .where(eq(leadEnrichment.leadId, leadId));
    } else {
      // Create new enrichment record
      await db.insert(leadEnrichment).values({
        leadId: leadId,
        projectHistory: JSON.stringify(projectHistory),
        companyInfo: '{}',
        techStack: '{}',
        recentEvents: '{}',
        insights: null,
        personalizationHooks: null,
        emailHistory: '{}',
        relationshipContext: null,
        previousProposals: '{}'
      });
    }
    
    return {
      success: true,
      message: `Successfully imported ${projectHistory.pastProjects.length} past projects and ${projectHistory.currentProjects.length} current projects from Asana for lead ${leadId}`
    };
  } catch (error) {
    console.error('Error importing Asana data:', error);
    return {
      success: false,
      message: `Failed to import Asana data: ${error.message}`
    };
  }
}

// Gmail/email history import
export async function importGmailData(
  filePath: string,
  fileType: 'csv' | 'json' | 'xml' | 'md',
  leadId: number
): Promise<{ success: boolean; message: string }> {
  try {
    const parsedData = await parseImportFile(filePath, fileType);
    
    // Process email data into our format
    const emailHistory = {
      recentThreads: [],
      keyContacts: [],
    };
    
    // Process the data based on file type
    if (fileType === 'csv') {
      const emails = parsedData.data as any[];
      
      // Extract unique contacts
      const contacts = new Set<string>();
      
      // Map CSV data to email structure
      emails.forEach(email => {
        const threadData = {
          topic: email.subject || email.topic || 'No Subject',
          summary: email.summary || email.body || email.content || 'No content',
          sentiment: email.sentiment || 'neutral',
          date: email.date || email.sent_date || new Date().toISOString(),
        };
        
        emailHistory.recentThreads.push(threadData);
        
        // Add contacts
        if (email.from) contacts.add(email.from);
        if (email.to) contacts.add(email.to);
        if (email.cc) email.cc.split(',').forEach(cc => contacts.add(cc.trim()));
      });
      
      emailHistory.keyContacts = Array.from(contacts);
      
    } else if (fileType === 'json') {
      // Handle direct JSON structure
      if (Array.isArray(parsedData.emails) || Array.isArray(parsedData.threads)) {
        const emails = parsedData.emails || parsedData.threads || [];
        const contacts = new Set<string>();
        
        emails.forEach(email => {
          const threadData = {
            topic: email.subject || email.topic || 'No Subject',
            summary: email.summary || email.body || email.content || 'No content',
            sentiment: email.sentiment || 'neutral',
            date: email.date || email.sent_date || new Date().toISOString(),
          };
          
          emailHistory.recentThreads.push(threadData);
          
          // Add contacts
          if (email.from) contacts.add(email.from);
          if (email.to) contacts.add(email.to);
          if (email.cc && Array.isArray(email.cc)) {
            email.cc.forEach(cc => contacts.add(cc));
          }
        });
        
        emailHistory.keyContacts = Array.from(contacts);
      } else {
        // Direct structure mapping
        if (parsedData.recentThreads) {
          emailHistory.recentThreads = parsedData.recentThreads;
        }
        if (parsedData.keyContacts) {
          emailHistory.keyContacts = parsedData.keyContacts;
        }
      }
    } else if (fileType === 'md') {
      // Parse markdown structure
      const sections = parsedData.sections;
      
      if (sections['Email Threads']) {
        const threadsText = sections['Email Threads'];
        const threadEntries = threadsText.split('### ').filter(entry => entry.trim().length > 0);
        
        threadEntries.forEach(entry => {
          const lines = entry.split('\n');
          const topic = lines[0].trim();
          let summary = '';
          let sentiment = 'neutral';
          let date = new Date().toISOString();
          
          lines.slice(1).forEach(line => {
            if (line.startsWith('- Summary:')) {
              summary = line.replace('- Summary:', '').trim();
            } else if (line.startsWith('- Sentiment:')) {
              sentiment = line.replace('- Sentiment:', '').trim();
            } else if (line.startsWith('- Date:')) {
              date = line.replace('- Date:', '').trim();
            }
          });
          
          emailHistory.recentThreads.push({
            topic,
            summary,
            sentiment,
            date
          });
        });
      }
      
      if (sections['Key Contacts']) {
        const contactsText = sections['Key Contacts'];
        emailHistory.keyContacts = contactsText
          .split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.replace('-', '').trim());
      }
    }
    
    // Get existing enrichment data
    const existingEnrichment = await db.query.leadEnrichment.findFirst({
      where: eq(leadEnrichment.leadId, leadId)
    });
    
    // Update or create enrichment record with email history
    if (existingEnrichment) {
      // Update existing record
      await db.update(leadEnrichment)
        .set({
          emailHistory: JSON.stringify(emailHistory)
        })
        .where(eq(leadEnrichment.leadId, leadId));
    } else {
      // Create new enrichment record
      await db.insert(leadEnrichment).values({
        leadId: leadId,
        emailHistory: JSON.stringify(emailHistory),
        companyInfo: '{}',
        techStack: '{}',
        recentEvents: '{}',
        insights: null,
        personalizationHooks: null,
        projectHistory: '{}',
        relationshipContext: null,
        previousProposals: '{}'
      });
    }
    
    return {
      success: true,
      message: `Successfully imported ${emailHistory.recentThreads.length} email threads and ${emailHistory.keyContacts.length} key contacts for lead ${leadId}`
    };
  } catch (error) {
    console.error('Error importing Gmail data:', error);
    return {
      success: false,
      message: `Failed to import Gmail data: ${error.message}`
    };
  }
}
