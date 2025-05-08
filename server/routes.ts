import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertLeadSchema, insertWorkflowSchema, insertLeadEnrichmentSchema, updateLeadSchema } from "@shared/schema";
import { generatePersonalizedEmail, generateMidjourneyPrompt, generateCampaignSuggestions, generatePersonalizationHooks, enhanceWebsiteDataWithAI, summarizeScrapingResultsWithAI } from "./openai";
import { processWebsite, convertToCompanyContext } from "./apify";
import { upload } from "./middleware/upload";
import { importAsanaData, importGmailData, importLeadsFromCSV } from "./importers";
import { isAirtableConfigured, searchRecords, listRecords, createRecord, updateRecord, deleteRecord } from "./airtable";
import path from "path";
import fs from "fs";
import * as https from 'node:https';

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve CSV templates
  app.get("/api/templates/csv/:templateName", (req: Request, res: Response) => {
    const { templateName } = req.params;
    const allowedTemplates = ["leads", "gmail", "asana", "proposals"];
    
    if (!allowedTemplates.includes(templateName)) {
      return res.status(404).send("Template not found");
    }
    
    const templatePath = `./uploads/csv/${templateName}_import_template.csv`;
    
    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      return res.status(404).send("Template file not found");
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${templateName}_import_template.csv`);
    const fileStream = fs.createReadStream(templatePath);
    fileStream.pipe(res);
  });
  
  // Serve README markdown
  app.get("/api/templates/csv/readme", (req: Request, res: Response) => {
    const readmePath = "./uploads/csv/README.md";
    
    // Check if file exists
    if (!fs.existsSync(readmePath)) {
      return res.status(404).send("README file not found");
    }
    
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename=csv_import_instructions.md');
    const fileStream = fs.createReadStream(readmePath);
    fileStream.pipe(res);
  });

  // Lead Management Routes
  app.get("/api/leads", async (req, res) => {
    try {
      const segment = req.query.segment as string;
      
      if (segment) {
        const leads = await storage.getLeadsBySegment(segment);
        return res.json(leads);
      } else {
        const leads = await storage.getAllLeads();
        return res.json(leads);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/leads/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      const leads = await storage.searchLeads(query);
      return res.json(leads);
    } catch (error) {
      console.error("Error searching leads:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/leads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      
      const leadWithEnrichment = await storage.getLeadWithEnrichment(id);
      
      // Add sample historical data if query param is present and no historical data exists
      if (req.query.addHistoricalData === 'true' && leadWithEnrichment.enrichment) {
        // Sample Asana project history data
        const projectHistory = {
          pastProjects: [
            {
              name: "Website Redesign",
              description: "Complete overhaul of company website with new CMS integration",
              status: "Completed",
              completionDate: "2024-02-15",
              keyOutcomes: ["40% increase in page load speed", "25% improvement in conversion rate", "Modernized UI/UX"]
            },
            {
              name: "SEO Optimization",
              description: "Technical SEO improvements and content strategy",
              status: "Completed",
              completionDate: "2024-03-10",
              keyOutcomes: ["Improved SERP ranking for 15 key terms", "52% increase in organic traffic"]
            }
          ],
          currentProjects: [
            {
              name: "Marketing Automation",
              description: "Implementation of automated email sequences and lead scoring",
              status: "In Progress",
              milestones: ["Requirements gathering completed", "Platform selection phase", "Pending implementation kickoff"]
            }
          ]
        };
        
        // Sample email history data
        const emailHistory = {
          recentThreads: [
            {
              topic: "Q1 Marketing Strategy Discussion",
              summary: "Reviewed campaign performance and discussed next quarter priorities",
              sentiment: "Positive",
              date: "2024-03-25"
            },
            {
              topic: "Website Launch Timeline",
              summary: "Negotiated revised timeline for website launch due to scope changes",
              sentiment: "Neutral",
              date: "2024-02-08"
            },
            {
              topic: "Budget Approval for Q2",
              summary: "Received confirmation on budget allocation for upcoming projects",
              sentiment: "Positive",
              date: "2024-03-30"
            }
          ],
          keyContacts: ["john.smith@example.com", "finance@example.com", "marketing.team@example.com"]
        };
        
        // Sample previous proposals data
        const previousProposals = [
          {
            title: "Enterprise SEO Package",
            date: "2023-12-05",
            value: "$45,000",
            status: "Accepted",
            services: ["Technical SEO Audit", "Content Strategy", "Link Building", "Monthly Reporting"]
          },
          {
            title: "Social Media Management",
            date: "2023-09-15",
            value: "$28,000",
            status: "Rejected",
            services: ["Content Creation", "Community Management", "Paid Advertising", "Analytics"]
          },
          {
            title: "Website Development Project",
            date: "2024-01-10",
            value: "$75,000",
            status: "Pending",
            services: ["UI/UX Design", "Frontend Development", "CMS Integration", "SEO Setup"]
          }
        ];
        
        // Update the enrichment data with historical context
        await storage.updateLeadEnrichment(id, {
          projectHistory: projectHistory,
          emailHistory: emailHistory,
          previousProposals: previousProposals,
          relationshipContext: [
            "Long-term client since 2022",
            "Prefers email communication over calls",
            "Budget-conscious but values quality",
            "Decision making typically takes 2-3 weeks"
          ]
        });
        
        // Fetch the updated data
        const updatedLeadWithEnrichment = await storage.getLeadWithEnrichment(id);
        return res.json(updatedLeadWithEnrichment);
      }
      
      return res.json(leadWithEnrichment);
    } catch (error) {
      console.error(`Error fetching lead ${req.params.id}:`, error);
      
      if ((error as Error).message.includes("not found")) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      
      // Check for duplicate email
      const existingLeads = await storage.findDuplicateLeads(leadData.email);
      
      if (existingLeads.length > 0) {
        return res.status(409).json({ 
          error: "A lead with this email already exists",
          existingLead: existingLeads[0]
        });
      }
      
      const newLead = await storage.addLead(leadData);
      return res.status(201).json(newLead);
    } catch (error) {
      console.error("Error creating lead:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/leads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      
      const leadData = updateLeadSchema.parse(req.body);
      const updatedLead = await storage.updateLead(id, leadData);
      
      return res.json(updatedLead);
    } catch (error) {
      console.error(`Error updating lead ${req.params.id}:`, error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/leads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      
      await storage.deleteLead(id);
      return res.json({ success: true });
    } catch (error) {
      console.error(`Error deleting lead ${req.params.id}:`, error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Lead Enrichment Routes
  
  // Update Lead Enrichment Settings
  app.post("/api/leads/:id/enrichment-settings", async (req, res) => {
    try {
      const leadId = parseInt(req.params.id, 10);
      
      if (isNaN(leadId)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      
      // Get the lead first
      const leadWithEnrichment = await storage.getLeadWithEnrichment(leadId);
      
      if (!leadWithEnrichment.lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      if (!leadWithEnrichment.enrichment) {
        return res.status(404).json({ error: "Enrichment data not found for this lead" });
      }
      
      const { useEnhancedScraping } = req.body;
      
      if (typeof useEnhancedScraping !== 'boolean') {
        return res.status(400).json({ error: "useEnhancedScraping must be a boolean value" });
      }
      
      // Update the enrichment setting
      await storage.updateLeadEnrichment(leadId, { useEnhancedScraping });
      
      // Get the updated enrichment data
      const { enrichment } = await storage.getLeadWithEnrichment(leadId);
      
      return res.status(200).json({ 
        success: true, 
        message: `AI-enhanced scraping ${useEnhancedScraping ? 'enabled' : 'disabled'}.`,
        enrichment
      });
    } catch (error) {
      console.error(`Error updating lead enrichment settings ${req.params.id}:`, error);
      return res.status(500).json({ error: "Failed to update lead enrichment settings" });
    }
  });
  
  app.post("/api/leads/:id/refresh-enrichment", async (req, res) => {
    try {
      const leadId = parseInt(req.params.id, 10);
      
      if (isNaN(leadId)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      
      // Get the lead first
      const lead = await storage.getLeadById(leadId);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      if (!lead.website) {
        return res.status(400).json({ 
          error: "Lead has no website URL for scraping. Please add a website URL first." 
        });
      }
      
      // Update lead enrichment status to in_progress
      await storage.updateLead(leadId, { enrichmentStatus: "in_progress" });
      
      try {
        console.log(`Starting website scraping process for ${lead.website}`);
        
        // Process website using Apify integration
        const scrapingResult = await processWebsite(lead.website);
        
        console.log(`Successfully scraped website data for ${lead.website}`);
        
        // Convert scraped data to enrichment format
        const updatedData = {
          companyInfo: JSON.stringify({
            industry: scrapingResult.companyInfo.industry || "Unknown",
            employeeCount: scrapingResult.companyInfo.employeeCount || "Unknown",
            location: scrapingResult.companyInfo.location || "Unknown",
            founded: scrapingResult.companyInfo.founded || "Unknown",
            description: scrapingResult.companyInfo.description || ""
          }),
          techStack: JSON.stringify(scrapingResult.techStack || {
            frontend: [],
            backend: [],
            database: [],
            cloud: []
          }),
          recentEvents: JSON.stringify({
            news: scrapingResult.recentEvents.news || [],
            blogPosts: scrapingResult.recentEvents.blogPosts || []
          }),
          personalizationHooks: [], 
          insights: [],
          lastUpdated: new Date()
        };
        
        // Get existing enrichment to check useEnhancedScraping setting
        const { enrichment: existingEnrichment } = await storage.getLeadWithEnrichment(leadId);
        const useEnhancedScraping = existingEnrichment?.useEnhancedScraping !== false; // Default to true if not set
        
        try {
          // STEP 1: Initial AI summary of Apify scraping results
          console.log(`Step 1: Generating initial AI summary for ${lead.company || lead.website}`);
          
          const initialSummary = await summarizeScrapingResultsWithAI(
            scrapingResult,
            lead.company || "the company",
            lead.website
          );
          
          console.log(`Successfully generated initial AI summary`);
          
          // Update the enrichment data with initial summary information
          const enrichedCompanyInfo = JSON.parse(updatedData.companyInfo);
          if (initialSummary.industry) enrichedCompanyInfo.industry = initialSummary.industry;
          if (initialSummary.location) enrichedCompanyInfo.location = initialSummary.location;
          if (initialSummary.employeeCount) enrichedCompanyInfo.employeeCount = initialSummary.employeeCount;
          if (initialSummary.serviceOffering) enrichedCompanyInfo.serviceOffering = initialSummary.serviceOffering;
          if (initialSummary.campaignPurpose) enrichedCompanyInfo.campaignPurpose = initialSummary.campaignPurpose;
          
          updatedData.companyInfo = JSON.stringify(enrichedCompanyInfo);
          
          // Update tech stack if initial summary provided any
          if (initialSummary.techStack && initialSummary.techStack.length > 0) {
            const techStackData = JSON.parse(updatedData.techStack);
            // Add any technology found to the appropriate category
            initialSummary.techStack.forEach((tech: string) => {
              // This is a simplistic approach; in a real-world scenario,
              // you might want to categorize technologies more accurately
              if (!techStackData.frontend) techStackData.frontend = [];
              if (!techStackData.frontend.includes(tech)) {
                techStackData.frontend.push(tech);
              }
            });
            updatedData.techStack = JSON.stringify(techStackData);
          }
          
          // Update recent events if initial summary provided any
          if (initialSummary.recentEvents && initialSummary.recentEvents.length > 0) {
            const recentEventsData = JSON.parse(updatedData.recentEvents);
            recentEventsData.news = initialSummary.recentEvents;
            updatedData.recentEvents = JSON.stringify(recentEventsData);
          }
          
          // Use insights from initial summary
          if (initialSummary.additionalContext && initialSummary.additionalContext.length > 0) {
            updatedData.insights = initialSummary.additionalContext;
          }
          
          // Create CompanyContext format for the next steps
          let companyContext: any = {
            name: lead.company || "the company",
            website: lead.website,
            industry: enrichedCompanyInfo.industry || undefined,
            location: enrichedCompanyInfo.location || undefined,
            employeeCount: enrichedCompanyInfo.employeeCount || undefined,
            recentEvents: initialSummary.recentEvents || undefined,
            techStack: initialSummary.techStack || undefined,
            serviceOffering: enrichedCompanyInfo.serviceOffering || undefined,
            campaignPurpose: enrichedCompanyInfo.campaignPurpose || undefined
          };
          
          // STEP 2: Enhanced AI processing (if enabled)
          // This step performs deeper analysis on the full content
          if (useEnhancedScraping) {
            console.log(`Step 2: Performing enhanced AI analysis for ${lead.company || lead.website}`);
            
            try {
              // Get the full text content for deeper analysis
              const allScrapedText = scrapingResult.recentEvents.blogPosts?.join('\n') || '';
              const companyDescription = scrapingResult.companyInfo.description || '';
              const allContent = companyDescription + '\n\n' + allScrapedText;
              
              // Only proceed if we have substantial content
              if (allContent.length > 200) {
                const enhancedData = await enhanceWebsiteDataWithAI(
                  allContent,
                  lead.company || "the company",
                  companyContext
                );
                
                console.log(`Successfully enhanced website data with AI`);
                
                // Update company context with enhanced data
                companyContext = {
                  ...companyContext,
                  ...enhancedData
                };
                
                // Merge enhanced data with initial summary
                if (enhancedData.industry) enrichedCompanyInfo.industry = enhancedData.industry;
                if (enhancedData.location) enrichedCompanyInfo.location = enhancedData.location;
                if (enhancedData.serviceOffering) enrichedCompanyInfo.serviceOffering = enhancedData.serviceOffering;
                if (enhancedData.campaignPurpose) enrichedCompanyInfo.campaignPurpose = enhancedData.campaignPurpose;
                
                updatedData.companyInfo = JSON.stringify(enrichedCompanyInfo);
                
                // Add or update recent events
                if (enhancedData.recentEvents && enhancedData.recentEvents.length > 0) {
                  const recentEventsData = JSON.parse(updatedData.recentEvents);
                  // Merge with existing events, avoiding duplicates
                  const existingEvents = recentEventsData.news || [];
                  enhancedData.recentEvents.forEach((event: string) => {
                    if (!existingEvents.includes(event)) {
                      existingEvents.push(event);
                    }
                  });
                  recentEventsData.news = existingEvents;
                  updatedData.recentEvents = JSON.stringify(recentEventsData);
                  
                  // If we didn't get insights from the initial summary,
                  // use recent events from enhanced data as insights
                  if (!updatedData.insights || updatedData.insights.length === 0) {
                    updatedData.insights = enhancedData.recentEvents.slice(0, 3).map((event: string) => {
                      return `Recent event: ${event}`;
                    });
                  }
                }
              } else {
                console.log(`Skipping enhanced analysis - insufficient content (${allContent.length} chars)`);
              }
            } catch (aiError) {
              console.error("Error in enhanced AI analysis:", aiError);
              // Continue with initial summary data if enhanced analysis fails
            }
          } else {
            console.log(`Enhanced AI analysis skipped for ${lead.company || lead.website} (disabled by user setting)`);
          }
          
          // STEP 3: Generate personalization hooks separately
          console.log(`Step 3: Generating personalization hooks for ${lead.company || lead.website}`);
          const leadData = {
            firstName: lead.firstName || "",
            lastName: lead.lastName || "",
            title: lead.title || "",
            email: lead.email
          };
          
          const personalizationHooks = await generatePersonalizationHooks(
            leadData,
            companyContext
          );
          
          if (personalizationHooks && personalizationHooks.length > 0) {
            updatedData.personalizationHooks = personalizationHooks;
            console.log(`Generated ${personalizationHooks.length} personalization hooks`);
          }
          
          // If we still don't have any insights, use a basic insight based on industry
          if (!updatedData.insights || updatedData.insights.length === 0) {
            const companyInfo = JSON.parse(updatedData.companyInfo);
            if (companyInfo.industry && companyInfo.industry !== "Unknown") {
              updatedData.insights = [`Company is in the ${companyInfo.industry} industry`];
            }
          }
          
        } catch (aiError) {
          console.error("Error in lead enrichment AI process:", aiError);
          // Continue with the scraped data even if AI enhancement fails
        }
        
        // Update the enrichment data or create if doesn't exist
        const enrichmentData = (await storage.getLeadWithEnrichment(leadId)).enrichment;
        
        if (enrichmentData) {
          await storage.updateLeadEnrichment(leadId, updatedData);
        } else {
          await storage.addLeadEnrichment({
            ...updatedData,
            leadId,
            projectHistory: "{}", // Initialize empty structures
            emailHistory: "{}",
            relationshipContext: [],
            previousProposals: "{}",
            useEnhancedScraping: useEnhancedScraping
          });
        }
        
      } catch (scrapingError) {
        console.error(`Error during website scraping for ${lead.website}:`, scrapingError);
        // Update lead with error status
        await storage.updateLead(leadId, { enrichmentStatus: "failed" });
        return res.status(500).json({ 
          error: "Failed to scrape website data", 
          message: scrapingError instanceof Error ? scrapingError.message : 'Unknown error' 
        });
      }
      
      // Update lead enrichment status
      await storage.updateLead(leadId, { enrichmentStatus: "complete" });
      
      // Get the updated enrichment data
      const { enrichment } = await storage.getLeadWithEnrichment(leadId);
      
      return res.status(200).json({ 
        success: true, 
        message: "Lead enrichment data refreshed successfully using Apify scraping",
        enrichment
      });
    } catch (error) {
      console.error(`Error refreshing lead enrichment ${req.params.id}:`, error);
      return res.status(500).json({ error: "Failed to refresh lead enrichment data" });
    }
  });
  
  // Bulk refresh leads enrichment
  app.post("/api/leads/bulk-refresh-enrichment", async (req, res) => {
    try {
      const { leadIds } = req.body;
      
      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: "No lead IDs provided for bulk refresh" });
      }
      
      // Limit the number of leads that can be refreshed at once
      if (leadIds.length > 10) {
        return res.status(400).json({ error: "Cannot refresh more than 10 leads at once" });
      }
      
      const results = [];
      
      // Process each lead
      for (const id of leadIds) {
        const leadId = parseInt(id, 10);
        
        if (isNaN(leadId)) {
          results.push({ id, success: false, message: "Invalid lead ID" });
          continue;
        }
        
        // Get the lead
        const lead = await storage.getLeadById(leadId);
        
        if (!lead) {
          results.push({ id: leadId, success: false, message: "Lead not found" });
          continue;
        }
        
        if (!lead.website) {
          results.push({ 
            id: leadId, 
            success: false, 
            message: "No website URL available for scraping" 
          });
          continue;
        }
        
        // Update lead enrichment status
        await storage.updateLead(leadId, { enrichmentStatus: "in_progress" });
        
        try {
          console.log(`Bulk refresh: Starting website scraping for ${lead.website}`);
          
          // Process website using Apify integration
          const scrapingResult = await processWebsite(lead.website);
          
          console.log(`Bulk refresh: Successfully scraped website data for ${lead.website}`);
          
          // Convert scraped data to enrichment format
          const updatedData = {
            companyInfo: JSON.stringify({
              industry: scrapingResult.companyInfo.industry || "Unknown",
              employeeCount: scrapingResult.companyInfo.employeeCount || "Unknown",
              location: scrapingResult.companyInfo.location || "Unknown",
              founded: scrapingResult.companyInfo.founded || "Unknown",
              description: scrapingResult.companyInfo.description || ""
            }),
            techStack: JSON.stringify(scrapingResult.techStack || {
              frontend: [],
              backend: [],
              database: [],
              cloud: []
            }),
            recentEvents: JSON.stringify({
              news: scrapingResult.recentEvents.news || [],
              blogPosts: scrapingResult.recentEvents.blogPosts || []
            }),
            personalizationHooks: [], 
            insights: [],
            lastUpdated: new Date()
          };
          
          // Get existing enrichment to check useEnhancedScraping setting
          const { enrichment: enrichmentSettings } = await storage.getLeadWithEnrichment(leadId);
          const useEnhancedScraping = enrichmentSettings?.useEnhancedScraping !== false; // Default to true if not set
          
          try {
            // STEP 1: Initial AI summary of Apify scraping results
            console.log(`Bulk refresh: Step 1: Generating initial AI summary for ${lead.company || lead.website}`);
            
            const initialSummary = await summarizeScrapingResultsWithAI(
              scrapingResult,
              lead.company || "the company",
              lead.website
            );
            
            console.log(`Bulk refresh: Successfully generated initial AI summary`);
            
            // Update the enrichment data with initial summary information
            const enrichedCompanyInfo = JSON.parse(updatedData.companyInfo);
            if (initialSummary.industry) enrichedCompanyInfo.industry = initialSummary.industry;
            if (initialSummary.location) enrichedCompanyInfo.location = initialSummary.location;
            if (initialSummary.employeeCount) enrichedCompanyInfo.employeeCount = initialSummary.employeeCount;
            if (initialSummary.serviceOffering) enrichedCompanyInfo.serviceOffering = initialSummary.serviceOffering;
            if (initialSummary.campaignPurpose) enrichedCompanyInfo.campaignPurpose = initialSummary.campaignPurpose;
            
            updatedData.companyInfo = JSON.stringify(enrichedCompanyInfo);
            
            // Update tech stack if initial summary provided any
            if (initialSummary.techStack && initialSummary.techStack.length > 0) {
              const techStackData = JSON.parse(updatedData.techStack);
              // Add any technology found to the appropriate category
              initialSummary.techStack.forEach((tech: string) => {
                // This is a simplistic approach; in a real-world scenario,
                // you might want to categorize technologies more accurately
                if (!techStackData.frontend) techStackData.frontend = [];
                if (!techStackData.frontend.includes(tech)) {
                  techStackData.frontend.push(tech);
                }
              });
              updatedData.techStack = JSON.stringify(techStackData);
            }
            
            // Update recent events if initial summary provided any
            if (initialSummary.recentEvents && initialSummary.recentEvents.length > 0) {
              const recentEventsData = JSON.parse(updatedData.recentEvents);
              recentEventsData.news = initialSummary.recentEvents;
              updatedData.recentEvents = JSON.stringify(recentEventsData);
            }
            
            // Use insights from initial summary
            if (initialSummary.additionalContext && initialSummary.additionalContext.length > 0) {
              updatedData.insights = initialSummary.additionalContext;
            }
            
            // Create CompanyContext format for the next steps
            let companyContext: any = {
              name: lead.company || "the company",
              website: lead.website,
              industry: enrichedCompanyInfo.industry || undefined,
              location: enrichedCompanyInfo.location || undefined,
              employeeCount: enrichedCompanyInfo.employeeCount || undefined,
              recentEvents: initialSummary.recentEvents || undefined,
              techStack: initialSummary.techStack || undefined,
              serviceOffering: enrichedCompanyInfo.serviceOffering || undefined,
              campaignPurpose: enrichedCompanyInfo.campaignPurpose || undefined
            };
            
            // STEP 2: Enhanced AI processing (if enabled)
            // This step performs deeper analysis on the full content
            if (useEnhancedScraping) {
              console.log(`Bulk refresh: Step 2: Performing enhanced AI analysis for ${lead.company || lead.website}`);
              
              try {
                // Get the full text content for deeper analysis
                const allScrapedText = scrapingResult.recentEvents.blogPosts?.join('\n') || '';
                const companyDescription = scrapingResult.companyInfo.description || '';
                const allContent = companyDescription + '\n\n' + allScrapedText;
                
                // Only proceed if we have substantial content
                if (allContent.length > 200) {
                  const enhancedData = await enhanceWebsiteDataWithAI(
                    allContent,
                    lead.company || "the company",
                    companyContext
                  );
                  
                  console.log(`Bulk refresh: Successfully enhanced website data with AI`);
                  
                  // Update company context with enhanced data
                  companyContext = {
                    ...companyContext,
                    ...enhancedData
                  };
                  
                  // Merge enhanced data with initial summary
                  if (enhancedData.industry) enrichedCompanyInfo.industry = enhancedData.industry;
                  if (enhancedData.location) enrichedCompanyInfo.location = enhancedData.location;
                  if (enhancedData.serviceOffering) enrichedCompanyInfo.serviceOffering = enhancedData.serviceOffering;
                  if (enhancedData.campaignPurpose) enrichedCompanyInfo.campaignPurpose = enhancedData.campaignPurpose;
                  
                  updatedData.companyInfo = JSON.stringify(enrichedCompanyInfo);
                  
                  // Add or update recent events
                  if (enhancedData.recentEvents && enhancedData.recentEvents.length > 0) {
                    const recentEventsData = JSON.parse(updatedData.recentEvents);
                    // Merge with existing events, avoiding duplicates
                    const existingEvents = recentEventsData.news || [];
                    enhancedData.recentEvents.forEach((event: string) => {
                      if (!existingEvents.includes(event)) {
                        existingEvents.push(event);
                      }
                    });
                    recentEventsData.news = existingEvents;
                    updatedData.recentEvents = JSON.stringify(recentEventsData);
                    
                    // If we didn't get insights from the initial summary,
                    // use recent events from enhanced data as insights
                    if (!updatedData.insights || updatedData.insights.length === 0) {
                      updatedData.insights = enhancedData.recentEvents.slice(0, 3).map((event: string) => {
                        return `Recent event: ${event}`;
                      });
                    }
                  }
                } else {
                  console.log(`Bulk refresh: Skipping enhanced analysis - insufficient content (${allContent.length} chars)`);
                }
              } catch (aiError) {
                console.error("Bulk refresh: Error in enhanced AI analysis:", aiError);
                // Continue with initial summary data if enhanced analysis fails
              }
            } else {
              console.log(`Bulk refresh: Enhanced AI analysis skipped for ${lead.company || lead.website} (disabled by user setting)`);
            }
            
            // STEP 3: Generate personalization hooks separately
            console.log(`Bulk refresh: Step 3: Generating personalization hooks for ${lead.company || lead.website}`);
            const leadData = {
              firstName: lead.firstName || "",
              lastName: lead.lastName || "",
              title: lead.title || "",
              email: lead.email
            };
            
            const personalizationHooks = await generatePersonalizationHooks(
              leadData,
              companyContext
            );
            
            if (personalizationHooks && personalizationHooks.length > 0) {
              updatedData.personalizationHooks = personalizationHooks;
              console.log(`Bulk refresh: Generated ${personalizationHooks.length} personalization hooks`);
            }
            
            // If we still don't have any insights, use a basic insight based on industry
            if (!updatedData.insights || updatedData.insights.length === 0) {
              const companyInfo = JSON.parse(updatedData.companyInfo);
              if (companyInfo.industry && companyInfo.industry !== "Unknown") {
                updatedData.insights = [`Company is in the ${companyInfo.industry} industry`];
              }
            }
          } catch (aiError) {
            console.error(`Error generating AI insights for lead ${leadId}:`, aiError);
            // Continue with the scraped data even if AI enhancement fails
          }
          
          // Update the enrichment data or create if doesn't exist
          if (enrichmentSettings) {
            await storage.updateLeadEnrichment(leadId, updatedData);
          } else {
            await storage.addLeadEnrichment({
              ...updatedData,
              leadId,
              projectHistory: "{}", // Initialize empty structures
              emailHistory: "{}",
              relationshipContext: [],
              previousProposals: "{}",
              useEnhancedScraping: useEnhancedScraping
            });
          }
          
          // Update lead enrichment status
          await storage.updateLead(leadId, { enrichmentStatus: "complete" });
          
          results.push({ 
            id: leadId, 
            success: true, 
            message: "Enrichment data refreshed successfully with Apify" 
          });
        } catch (scrapingError) {
          console.error(`Error during website scraping for ${lead.website}:`, scrapingError);
          // Update lead with error status
          await storage.updateLead(leadId, { enrichmentStatus: "failed" });
          results.push({ 
            id: leadId, 
            success: false, 
            message: `Failed to scrape website data: ${scrapingError instanceof Error ? scrapingError.message : 'Unknown error'}` 
          });
        }
      }
      
      return res.status(200).json({ 
        success: true, 
        message: `Processed ${results.length} leads with Apify integration`,
        results
      });
    } catch (error) {
      console.error("Error in bulk refreshing lead enrichment:", error);
      return res.status(500).json({ error: "Failed to process bulk enrichment refresh" });
    }
  });
  
  // Bulk delete leads
  app.post("/api/leads/bulk-delete", async (req, res) => {
    try {
      const { leadIds } = req.body;
      
      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: "No lead IDs provided for bulk delete" });
      }
      
      // Limit the number of leads that can be deleted at once
      if (leadIds.length > 50) {
        return res.status(400).json({ error: "Cannot delete more than 50 leads at once" });
      }
      
      const result = await storage.bulkDeleteLeads(leadIds);
      
      return res.json({
        success: result.success,
        message: `Successfully deleted ${result.count} lead(s)`
      });
    } catch (error) {
      console.error("Error in bulk delete:", error);
      return res.status(500).json({ 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error occurred" 
      });
    }
  });

  app.post("/api/leads/:id/enrichment", async (req, res) => {
    try {
      const leadId = parseInt(req.params.id, 10);
      
      if (isNaN(leadId)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      
      const enrichmentData = insertLeadEnrichmentSchema.parse({
        ...req.body,
        leadId
      });
      
      const enrichment = await storage.addLeadEnrichment(enrichmentData);
      
      // Update lead enrichment status
      await storage.updateLead(leadId, { enrichmentStatus: "complete" });
      
      return res.status(201).json(enrichment);
    } catch (error) {
      console.error(`Error adding enrichment for lead ${req.params.id}:`, error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/leads/:id/enrichment", async (req, res) => {
    try {
      const leadId = parseInt(req.params.id, 10);
      
      if (isNaN(leadId)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      
      const enrichment = await storage.updateLeadEnrichment(leadId, req.body);
      return res.json(enrichment);
    } catch (error) {
      console.error(`Error updating enrichment for lead ${req.params.id}:`, error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Email Generation Routes
  app.post("/api/leads/:id/generate-email", async (req, res) => {
    try {
      const leadId = parseInt(req.params.id, 10);
      
      if (isNaN(leadId)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      
      const { 
        campaignPurpose, 
        serviceOffering, 
        tone = "professional",
        formality = 3,
        usePersonalizedHooks = true,
        customHooks = "",
        includeRecentEvents = true,
        subjectLineStyle = "direct",
        emailLength = "medium",
        callToAction = "",
        styleParams = {},
        // New parameters for historical context
        useHistoricalContext = false,
        includeProjectHistory = true,
        includeEmailHistory = true,
        includeProposalHistory = true
      } = req.body;
      
      if (!campaignPurpose || !serviceOffering) {
        return res.status(400).json({ 
          error: "Missing required fields: campaignPurpose and serviceOffering are required" 
        });
      }
      
      // Get lead with enrichment data
      const { lead, enrichment } = await storage.getLeadWithEnrichment(leadId);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      // Prepare personalization hooks based on settings
      let personalizedHooks = [];
      
      if (usePersonalizedHooks && enrichment?.personalizationHooks) {
        personalizedHooks = [...enrichment.personalizationHooks];
      }
      
      if (customHooks) {
        personalizedHooks.push(customHooks);
      }
      
      // Prepare historical context if enabled
      let historicalContext = null;
      if (useHistoricalContext) {
        historicalContext = {
          projectHistory: includeProjectHistory ? enrichment?.projectHistory || {} : {},
          emailHistory: includeEmailHistory ? enrichment?.emailHistory || {} : {},
          previousProposals: includeProposalHistory ? enrichment?.previousProposals || [] : [],
          relationshipContext: enrichment?.relationshipContext || []
        };
      }

      // Generate email with additional style parameters and historical context
      const emailContent = await generatePersonalizedEmail({
        lead: {
          firstName: lead.firstName || "",
          lastName: lead.lastName || "",
          title: lead.title,
          email: lead.email
        },
        company: {
          name: lead.company || "",
          industry: enrichment?.companyInfo?.industry,
          website: lead.website,
          recentEvents: includeRecentEvents ? enrichment?.recentEvents?.news : [],
          techStack: enrichment?.techStack?.backend,
          employeeCount: enrichment?.companyInfo?.employeeCount,
          location: enrichment?.companyInfo?.location
        },
        personalizationHooks: personalizedHooks,
        campaignPurpose,
        serviceOffering,
        callToAction,
        styleOptions: {
          tone,
          formality,
          subjectLineStyle,
          emailLength,
          ...styleParams
        },
        // Include historical context if enabled
        historicalContext: historicalContext,
        useHistoricalContext: useHistoricalContext
      });
      
      // Save email draft
      const emailDraft = await storage.addEmailDraft({
        leadId,
        campaignId: null,
        subject: emailContent.subject,
        body: emailContent.body,
        googleDocUrl: null
      });
      
      // Update lead email status
      await storage.updateLead(leadId, { emailStatus: "draft_generated" });
      
      return res.status(201).json(emailDraft);
    } catch (error) {
      console.error(`Error generating email for lead ${req.params.id}:`, error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Generate campaign suggestions for a lead
  app.get("/api/leads/:id/campaign-suggestions", async (req, res) => {
    try {
      const leadId = parseInt(req.params.id, 10);
      
      if (isNaN(leadId)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      
      const { lead, enrichment } = await storage.getLeadWithEnrichment(leadId);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      // Use the company info from enrichment data to generate campaign suggestions
      const companyInfo = enrichment?.companyInfo || {};
      const suggestions = await generateCampaignSuggestions({
        name: lead.company || "",
        industry: companyInfo.industry,
        techStack: enrichment?.techStack?.frontend || enrichment?.techStack?.backend,
        recentEvents: enrichment?.recentEvents?.news,
        employeeCount: companyInfo.employeeCount,
        location: companyInfo.location,
        campaignPurpose: companyInfo.campaignPurpose,
        serviceOffering: companyInfo.serviceOffering
      });
      
      return res.json(suggestions);
    } catch (error) {
      console.error(`Error generating campaign suggestions for lead ${req.params.id}:`, error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get email drafts for a lead
  app.get("/api/leads/:id/email-drafts", async (req, res) => {
    try {
      const leadId = parseInt(req.params.id, 10);
      
      if (isNaN(leadId)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      
      const drafts = await storage.getEmailDraftsForLead(leadId);
      return res.json(drafts);
    } catch (error) {
      console.error(`Error fetching email drafts for lead ${req.params.id}:`, error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Update an email draft
  app.patch("/api/leads/email-drafts/:id", async (req, res) => {
    try {
      const draftId = parseInt(req.params.id, 10);
      
      if (isNaN(draftId)) {
        return res.status(400).json({ error: "Invalid draft ID" });
      }
      
      const { subject, body } = req.body;
      
      if (!subject || !body) {
        return res.status(400).json({ error: "Subject and body are required" });
      }
      
      const updatedDraft = await storage.updateEmailDraft(draftId, { subject, body });
      return res.json(updatedDraft);
    } catch (error) {
      console.error(`Error updating email draft ${req.params.id}:`, error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Ad Generation Routes
  app.post("/api/generate-midjourney-prompt", async (req, res) => {
    try {
      const { industry, campaignPurpose, targetAudience, style, mood } = req.body;
      
      if (!industry || !campaignPurpose || !targetAudience) {
        return res.status(400).json({ 
          error: "Missing required fields: industry, campaignPurpose, and targetAudience are required" 
        });
      }
      
      const prompt = await generateMidjourneyPrompt({
        industry,
        campaignPurpose,
        targetAudience,
        style,
        mood
      });
      
      return res.json({ prompt });
    } catch (error) {
      console.error("Error generating Midjourney prompt:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Workflow Management Routes
  app.get("/api/workflows", async (req, res) => {
    try {
      const workflows = await storage.getAllWorkflows();
      return res.json(workflows);
    } catch (error) {
      console.error("Error fetching workflows:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/workflows/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid workflow ID" });
      }
      
      const { status, processedCount, totalCount } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      
      const workflow = await storage.updateWorkflowStatus(id, status, processedCount, totalCount);
      return res.json(workflow);
    } catch (error) {
      console.error(`Error updating workflow ${req.params.id}:`, error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/workflows/:id/log-run", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid workflow ID" });
      }
      
      const { processedCount, totalCount } = req.body;
      
      if (processedCount === undefined || totalCount === undefined) {
        return res.status(400).json({ 
          error: "Missing required fields: processedCount and totalCount are required" 
        });
      }
      
      const workflow = await storage.logWorkflowRun(id, processedCount, totalCount);
      return res.json(workflow);
    } catch (error) {
      console.error(`Error logging workflow run ${req.params.id}:`, error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Dashboard Routes
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      return res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Integration Management Routes
  app.get("/api/integrations", async (req, res) => {
    try {
      const integrations = await storage.getAllIntegrations();
      return res.json(integrations);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/integrations/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid integration ID" });
      }
      
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      
      const integration = await storage.updateIntegrationStatus(id, status);
      return res.json(integration);
    } catch (error) {
      console.error(`Error updating integration ${req.params.id}:`, error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Campaign Management Routes
  app.get("/api/campaigns", async (req, res) => {
    try {
      const onlyActive = req.query.active === 'true';
      
      if (onlyActive) {
        const campaigns = await storage.getActiveCampaigns();
        return res.json(campaigns);
      } else {
        const campaigns = await storage.getAllCampaigns();
        return res.json(campaigns);
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/ad-campaigns", async (req, res) => {
    try {
      const adCampaigns = await storage.getAllAdCampaigns();
      return res.json(adCampaigns);
    } catch (error) {
      console.error("Error fetching ad campaigns:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/ad-campaigns/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ad campaign ID" });
      }
      
      const adCampaignWithVariants = await storage.getAdCampaignWithVariants(id);
      return res.json(adCampaignWithVariants);
    } catch (error) {
      console.error(`Error fetching ad campaign ${req.params.id}:`, error);
      
      if ((error as Error).message.includes("not found")) {
        return res.status(404).json({ error: "Ad campaign not found" });
      }
      
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Import routes for Asana and Gmail
  
  // Import Asana data in various formats (CSV, JSON, XML, MD)
  app.post("/api/leads/:id/import/asana", upload.single('file'), async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id, 10);
      
      if (isNaN(leadId)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Get file extension to determine file type
      const fileExt = path.extname(file.originalname).toLowerCase();
      let fileType: 'csv' | 'json' | 'xml' | 'md';
      
      switch (fileExt) {
        case '.csv':
          fileType = 'csv';
          break;
        case '.json':
          fileType = 'json';
          break;
        case '.xml':
          fileType = 'xml';
          break;
        case '.md':
          fileType = 'md';
          break;
        default:
          return res.status(400).json({ error: "Unsupported file type. Supported types: CSV, JSON, XML, MD" });
      }
      
      // Process the file and import the data
      const result = await importAsanaData(file.path, fileType, leadId);
      
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      
      if (result.success) {
        return res.status(200).json({ message: result.message });
      } else {
        return res.status(400).json({ error: result.message });
      }
    } catch (error) {
      console.error(`Error importing Asana data for lead ${req.params.id}:`, error);
      return res.status(500).json({ error: "Failed to import Asana data" });
    }
  });
  
  // Import Gmail data in various formats (CSV, JSON, XML, MD)
  // Bulk CSV import for leads
  app.post("/api/leads/import/csv", upload.single('file'), async (req: Request, res: Response) => {
    try {
      // Check if file is uploaded
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const file = req.file;
      const fileExt = path.extname(file.originalname).toLowerCase();
      
      // Validate file type
      if (fileExt !== '.csv') {
        return res.status(400).json({ error: "Only CSV files are allowed for bulk lead import" });
      }
      
      // Process the file and import the data
      const result = await importLeadsFromCSV(file.path);
      
      // Remove the temporary file
      fs.unlinkSync(file.path);
      
      return res.status(result.success ? 200 : 422).json(result);
    } catch (error) {
      console.error(`Error importing leads from CSV:`, error);
      return res.status(500).json({ error: "Failed to import leads from CSV" });
    }
  });

  app.post("/api/leads/:id/import/gmail", upload.single('file'), async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id, 10);
      
      if (isNaN(leadId)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Get file extension to determine file type
      const fileExt = path.extname(file.originalname).toLowerCase();
      let fileType: 'csv' | 'json' | 'xml' | 'md';
      
      switch (fileExt) {
        case '.csv':
          fileType = 'csv';
          break;
        case '.json':
          fileType = 'json';
          break;
        case '.xml':
          fileType = 'xml';
          break;
        case '.md':
          fileType = 'md';
          break;
        default:
          return res.status(400).json({ error: "Unsupported file type. Supported types: CSV, JSON, XML, MD" });
      }
      
      // Process the file and import the data
      const result = await importGmailData(file.path, fileType, leadId);
      
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      
      if (result.success) {
        return res.status(200).json({ message: result.message });
      } else {
        return res.status(400).json({ error: result.message });
      }
    } catch (error) {
      console.error(`Error importing Gmail data for lead ${req.params.id}:`, error);
      return res.status(500).json({ error: "Failed to import Gmail data" });
    }
  });

  // Airtable Integration Routes
  app.get("/api/airtable/status", async (req, res) => {
    try {
      const { isAirtableConfigured } = await import("./airtable");
      const { airtableConfig } = await import("./airtable/config");
      
      // Add debug logs
      console.log("AIRTABLE_API_KEY exists:", !!process.env.AIRTABLE_API_KEY);
      console.log("AIRTABLE_BASE_ID:", process.env.AIRTABLE_BASE_ID);
      
      const isConfigured = isAirtableConfigured();
      console.log("isAirtableConfigured returned:", isConfigured);
      
      return res.json({
        configured: isConfigured,
        baseId: process.env.AIRTABLE_BASE_ID,
        baseIdExists: !!process.env.AIRTABLE_BASE_ID,
        tables: isConfigured && airtableConfig.bases[0] ? airtableConfig.bases[0].tables : [],
        apiKeyConfigured: !!process.env.AIRTABLE_API_KEY
      });
    } catch (error) {
      console.error("Error checking Airtable status:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // API endpoint to validate and diagnose Airtable integration
  app.get("/api/airtable/validate", async (req, res) => {
    try {
      const { setupAirtableIntegration } = await import('./airtable/setup');
      const validationResult = await setupAirtableIntegration();
      
      return res.json(validationResult);
    } catch (error) {
      console.error("Error validating Airtable integration:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to validate Airtable integration",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // API endpoints for Airtable Conversations
  
  // Get all conversations for a user
  app.get("/api/airtable/conversations", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }
      
      const user = req.query.user as string;
      if (!user) {
        return res.status(400).json({ error: "User parameter is required" });
      }
      
      const { getUserConversations } = await import("./airtable/conversations");
      const conversations = await getUserConversations(process.env.AIRTABLE_BASE_ID, user);
      
      return res.json(conversations);
    } catch (error) {
      console.error("Error getting conversations from Airtable:", error);
      return res.status(500).json({ 
        error: "Failed to retrieve conversations from Airtable",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get a single conversation by ID
  app.get("/api/airtable/conversations/:id", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }
      
      const conversationId = req.params.id;
      
      const { getConversation } = await import("./airtable/conversations");
      const conversation = await getConversation(process.env.AIRTABLE_BASE_ID, conversationId);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      return res.json(conversation);
    } catch (error) {
      console.error("Error getting conversation from Airtable:", error);
      return res.status(500).json({ 
        error: "Failed to retrieve conversation from Airtable",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create a new conversation
  app.post("/api/airtable/conversations", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }
      
      const conversationData = req.body;
      
      if (!conversationData.id || !conversationData.title || !conversationData.user) {
        return res.status(400).json({ error: "Conversation requires id, title, and user fields" });
      }
      
      const { createConversation } = await import("./airtable/conversations");
      const result = await createConversation(process.env.AIRTABLE_BASE_ID, conversationData);
      
      return res.status(201).json(result);
    } catch (error) {
      console.error("Error creating conversation in Airtable:", error);
      return res.status(500).json({ 
        error: "Failed to create conversation in Airtable",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Update an existing conversation
  app.patch("/api/airtable/conversations/:id", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }
      
      const conversationId = req.params.id;
      const updates = req.body;
      
      const { updateConversation } = await import("./airtable/conversations");
      const result = await updateConversation(process.env.AIRTABLE_BASE_ID, conversationId, updates);
      
      return res.json(result);
    } catch (error) {
      console.error("Error updating conversation in Airtable:", error);
      return res.status(500).json({ 
        error: "Failed to update conversation in Airtable",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Add a message to a conversation
  app.post("/api/airtable/conversations/:id/messages", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }
      
      const conversationId = req.params.id;
      const message = req.body;
      
      if (!message.role || !message.content) {
        return res.status(400).json({ error: "Message requires role and content fields" });
      }
      
      // Add timestamp if not provided
      if (!message.timestamp) {
        message.timestamp = new Date().toISOString();
      }
      
      const { addMessageToConversation } = await import("./airtable/conversations");
      const result = await addMessageToConversation(process.env.AIRTABLE_BASE_ID, conversationId, message);
      
      return res.json(result);
    } catch (error) {
      console.error("Error adding message to conversation in Airtable:", error);
      return res.status(500).json({ 
        error: "Failed to add message to conversation in Airtable",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Delete a conversation (soft delete)
  app.delete("/api/airtable/conversations/:id", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }
      
      const conversationId = req.params.id;
      const hardDelete = req.query.hard === 'true';
      
      if (hardDelete) {
        const { hardDeleteConversation } = await import("./airtable/conversations");
        await hardDeleteConversation(process.env.AIRTABLE_BASE_ID, conversationId);
      } else {
        const { softDeleteConversation } = await import("./airtable/conversations");
        await softDeleteConversation(process.env.AIRTABLE_BASE_ID, conversationId);
      }
      
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting conversation from Airtable:", error);
      return res.status(500).json({ 
        error: "Failed to delete conversation from Airtable",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // API endpoints for Airtable Tool Executions
  
  // Get tool executions for a conversation
  app.get("/api/airtable/tool-executions", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }
      
      const conversationId = req.query.conversationId as string;
      const toolName = req.query.toolName as string;
      
      if (!conversationId && !toolName) {
        return res.status(400).json({ error: "Either conversationId or toolName parameter is required" });
      }
      
      if (conversationId) {
        const { getConversationToolExecutions } = await import("./airtable/toolExecutions");
        const executions = await getConversationToolExecutions(process.env.AIRTABLE_BASE_ID, conversationId);
        return res.json(executions);
      } else {
        const { getToolExecutionsByName } = await import("./airtable/toolExecutions");
        const maxRecords = req.query.max ? parseInt(req.query.max as string) : 100;
        const executions = await getToolExecutionsByName(process.env.AIRTABLE_BASE_ID, toolName, maxRecords);
        return res.json(executions);
      }
    } catch (error) {
      console.error("Error getting tool executions from Airtable:", error);
      return res.status(500).json({ 
        error: "Failed to retrieve tool executions from Airtable",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get a single tool execution by ID
  app.get("/api/airtable/tool-executions/:id", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }
      
      const executionId = req.params.id;
      
      const { getToolExecution } = await import("./airtable/toolExecutions");
      const execution = await getToolExecution(process.env.AIRTABLE_BASE_ID, executionId);
      
      if (!execution) {
        return res.status(404).json({ error: "Tool execution not found" });
      }
      
      return res.json(execution);
    } catch (error) {
      console.error("Error getting tool execution from Airtable:", error);
      return res.status(500).json({ 
        error: "Failed to retrieve tool execution from Airtable",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create a new tool execution
  app.post("/api/airtable/tool-executions", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }
      
      const executionData = req.body;
      
      if (!executionData.id || !executionData.conversationId || !executionData.toolName) {
        return res.status(400).json({ error: "Tool execution requires id, conversationId, and toolName fields" });
      }
      
      // Set default values if not provided
      if (!executionData.status) executionData.status = 'pending';
      if (!executionData.createdAt) executionData.createdAt = new Date().toISOString();
      
      const { createToolExecution } = await import("./airtable/toolExecutions");
      const result = await createToolExecution(process.env.AIRTABLE_BASE_ID, executionData);
      
      return res.status(201).json(result);
    } catch (error) {
      console.error("Error creating tool execution in Airtable:", error);
      return res.status(500).json({ 
        error: "Failed to create tool execution in Airtable",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Update a tool execution
  app.patch("/api/airtable/tool-executions/:id", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }
      
      const executionId = req.params.id;
      const updates = req.body;
      
      const { updateToolExecution } = await import("./airtable/toolExecutions");
      const result = await updateToolExecution(process.env.AIRTABLE_BASE_ID, executionId, updates);
      
      return res.json(result);
    } catch (error) {
      console.error("Error updating tool execution in Airtable:", error);
      return res.status(500).json({ 
        error: "Failed to update tool execution in Airtable",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Complete a tool execution
  app.post("/api/airtable/tool-executions/:id/complete", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }
      
      const executionId = req.params.id;
      const { success, outputs, executionTime, errorMessage } = req.body;
      
      if (success === undefined) {
        return res.status(400).json({ error: "Success parameter is required" });
      }
      
      const { completeToolExecution } = await import("./airtable/toolExecutions");
      const result = await completeToolExecution(
        process.env.AIRTABLE_BASE_ID, 
        executionId, 
        success, 
        outputs, 
        executionTime, 
        errorMessage
      );
      
      return res.json(result);
    } catch (error) {
      console.error("Error completing tool execution in Airtable:", error);
      return res.status(500).json({ 
        error: "Failed to complete tool execution in Airtable",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Delete a tool execution
  app.delete("/api/airtable/tool-executions/:id", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }
      
      const executionId = req.params.id;
      
      const { deleteToolExecution } = await import("./airtable/toolExecutions");
      await deleteToolExecution(process.env.AIRTABLE_BASE_ID, executionId);
      
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tool execution from Airtable:", error);
      return res.status(500).json({ 
        error: "Failed to delete tool execution from Airtable",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/airtable/tables", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }

      const { isAirtableConfigured } = await import("./airtable");
      const { airtableConfig } = await import("./airtable/config");
      
      if (!isAirtableConfigured()) {
        return res.status(400).json({ error: "Airtable not configured correctly" });
      }

      try {
        // Get tables from config
        const baseId = process.env.AIRTABLE_BASE_ID;
        const base = airtableConfig.bases.find(b => b.id === baseId);
        
        if (!base) {
          return res.status(404).json({ 
            error: "Base not found", 
            message: "The configured base ID was not found in your configuration",
            configuredBaseId: baseId
          });
        }
        
        // Return the table names from the configuration
        const tables = base.tables.map(table => ({
          id: table.id,
          name: table.name,
          description: table.description
        }));
        
        return res.json({ 
          baseId: baseId,
          tables: tables
        });
      } catch (error) {
        return res.status(400).json({ error: "Could not retrieve Airtable tables" });
      }
    } catch (error) {
      console.error("Error listing Airtable tables:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Endpoint to fetch information about the Airtable connection status
  app.get("/api/airtable/status", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({
          configured: false,
          error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables."
        });
      }
      
      const { isAirtableConfigured } = await import("./airtable");
      const isConfigured = await isAirtableConfigured();
      
      if (isConfigured) {
        // Try to list available tables as a connection test
        try {
          const baseId = process.env.AIRTABLE_BASE_ID;
          const { listRecords } = await import("./airtable");
          // Just try to connect and query - we don't actually need the results
          await listRecords(baseId, "Leads");
          
          return res.json({
            configured: true,
            baseId: process.env.AIRTABLE_BASE_ID,
            status: "connected",
            message: "Successfully connected to Airtable API"
          });
        } catch (queryError) {
          console.error("Error querying Airtable:", queryError);
          return res.json({
            configured: true,
            baseId: process.env.AIRTABLE_BASE_ID,
            status: "error",
            message: "Connected to Airtable API but error querying tables",
            error: queryError instanceof Error ? queryError.message : String(queryError)
          });
        }
      } else {
        return res.json({
          configured: false,
          message: "Airtable API not properly configured"
        });
      }
    } catch (error) {
      console.error("Error checking Airtable status:", error);
      return res.status(500).json({
        configured: false,
        error: "Failed to check Airtable configuration status"
      });
    }
  });
  
  // Endpoint to list all available tables in the Airtable base
  app.get("/api/airtable/tables", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({
          error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables."
        });
      }
      
      const baseId = process.env.AIRTABLE_BASE_ID;
      
      // Import the Airtable methods
      const { getAvailableTables } = await import("./airtable");
      
      // Get the list of available tables
      const tables = await getAvailableTables(baseId);
      
      return res.json({
        baseId,
        tables
      });
    } catch (error) {
      console.error("Error getting Airtable tables:", error);
      return res.status(500).json({
        error: "Failed to retrieve Airtable tables",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/airtable/:baseId/:tableName", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }

      const { baseId, tableName } = req.params;
      const { listRecords } = await import("./airtable");
      
      const records = await listRecords(baseId, tableName);
      return res.json(records);
    } catch (error) {
      console.error(`Error listing records from Airtable table ${req.params.tableName}:`, error);
      return res.status(500).json({ error: "Failed to retrieve records from Airtable" });
    }
  });

  app.get("/api/airtable/:baseId/:tableName/search", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }

      const { baseId, tableName } = req.params;
      const query = req.query.q as string;
      
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      const { searchRecords } = await import("./airtable");
      
      const records = await searchRecords(baseId, tableName, query);
      return res.json(records);
    } catch (error) {
      console.error(`Error searching Airtable table ${req.params.tableName}:`, error);
      return res.status(500).json({ error: "Failed to search records in Airtable" });
    }
  });

  app.post("/api/airtable/:baseId/:tableName", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }

      const { baseId, tableName } = req.params;
      const fields = req.body;
      
      if (!fields || Object.keys(fields).length === 0) {
        return res.status(400).json({ error: "Record data is required" });
      }
      
      const { createRecord } = await import("./airtable");
      
      const record = await createRecord(baseId, tableName, fields);
      return res.status(201).json(record);
    } catch (error) {
      console.error(`Error creating record in Airtable table ${req.params.tableName}:`, error);
      return res.status(500).json({ error: "Failed to create record in Airtable" });
    }
  });

  app.put("/api/airtable/:baseId/:tableName/:recordId", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }

      const { baseId, tableName, recordId } = req.params;
      const fields = req.body;
      
      if (!fields || Object.keys(fields).length === 0) {
        return res.status(400).json({ error: "Record data is required" });
      }
      
      const { updateRecord } = await import("./airtable");
      
      const record = await updateRecord(baseId, tableName, recordId, fields);
      return res.json(record);
    } catch (error) {
      console.error(`Error updating record in Airtable table ${req.params.tableName}:`, error);
      return res.status(500).json({ error: "Failed to update record in Airtable" });
    }
  });

  app.delete("/api/airtable/:baseId/:tableName/:recordId", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." });
      }

      const { baseId, tableName, recordId } = req.params;
      const { deleteRecord } = await import("./airtable");
      
      await deleteRecord(baseId, tableName, recordId);
      return res.json({ success: true });
    } catch (error) {
      console.error(`Error deleting record from Airtable table ${req.params.tableName}:`, error);
      return res.status(500).json({ error: "Failed to delete record from Airtable" });
    }
  });
  
  // Endpoint to sync a lead to Airtable
  app.post("/api/leads/:id/sync-to-airtable", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        return res.status(400).json({ 
          error: "Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables." 
        });
      }
      
      const leadId = parseInt(req.params.id, 10);
      
      if (isNaN(leadId)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      
      // Get the lead with enrichment data
      const { lead, enrichment } = await storage.getLeadWithEnrichment(leadId);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      const baseId = process.env.AIRTABLE_BASE_ID;
      const tableName = "Leads"; // Using the Leads table from our configuration
      
      const { createRecord, searchRecords, updateRecord } = await import("./airtable");
      
      // Check if the lead already exists in Airtable by email
      const searchQuery = `{Email} = "${lead.email}"`;
      const existingRecords = await searchRecords(baseId, tableName, searchQuery);
      
      // Map our lead data to Airtable fields
      // Using a record type to allow for dynamic field names
      const airtableFields: Record<string, any> = {
        'First Name': lead.firstName || '',
        'Last Name': lead.lastName || '',
        'Email': lead.email,
        'Company': lead.company || '',
        'Title': lead.title || '',
        'Phone': lead.phoneNumber || '',
        'Website': lead.website || '',
        'LinkedIn URL': lead.linkedinUrl || '',
        'Source': lead.source,
        'Status': lead.status || 'active',
        'Priority': lead.priority || 'medium',
        'Notes': lead.notes || '',
        'Tags': lead.tags ? lead.tags.join(', ') : '',
        'Last Contact Date': lead.lastContactDate ? new Date(lead.lastContactDate).toISOString() : '',
        'Created At': new Date(lead.createdAt).toISOString(),
        'Updated At': new Date(lead.updatedAt).toISOString(),
        'Email Status': lead.emailStatus || 'not_started',
      };
      
      // Include enrichment data if available
      if (enrichment) {
        try {
          // Instead of trying to parse the JSON, let's just check if the properties exist
          const companyInfo = typeof enrichment.companyInfo === 'object' && enrichment.companyInfo 
            ? enrichment.companyInfo 
            : typeof enrichment.companyInfo === 'string' 
              ? JSON.parse(enrichment.companyInfo) 
              : {};
          
          const techStack = typeof enrichment.techStack === 'object' && enrichment.techStack 
            ? enrichment.techStack 
            : typeof enrichment.techStack === 'string'
              ? JSON.parse(enrichment.techStack)
              : {};
          
          // Handle possible nesting
          if (companyInfo && companyInfo.industry) airtableFields['Industry'] = companyInfo.industry;
          if (companyInfo && companyInfo.employeeCount) airtableFields['Employee Count'] = companyInfo.employeeCount;
          if (companyInfo && companyInfo.location) airtableFields['Location'] = companyInfo.location;
          
          // Convert tech stack to a comma-separated string
          const techStackArray = [];
          if (techStack && techStack.frontend && Array.isArray(techStack.frontend)) {
            techStackArray.push(...techStack.frontend);
          }
          if (techStack && techStack.backend && Array.isArray(techStack.backend)) {
            techStackArray.push(...techStack.backend);
          }
          if (techStack && techStack.database && Array.isArray(techStack.database)) {
            techStackArray.push(...techStack.database);
          }
          if (techStack && techStack.cloud && Array.isArray(techStack.cloud)) {
            techStackArray.push(...techStack.cloud);
          }
          
          if (techStackArray.length > 0) {
            airtableFields['Tech Stack'] = techStackArray.join(', ');
          }
          
          // Add insights as a note
          if (enrichment.insights && Array.isArray(enrichment.insights) && enrichment.insights.length > 0) {
            airtableFields['Insights'] = enrichment.insights.join('\n');
          }
          
          // Add personalization hooks
          if (enrichment.personalizationHooks && Array.isArray(enrichment.personalizationHooks) && enrichment.personalizationHooks.length > 0) {
            airtableFields['Personalization Hooks'] = enrichment.personalizationHooks.join('\n');
          }
        } catch (parseError) {
          console.error("Error parsing enrichment data:", parseError);
          // Continue with the sync even if enrichment parsing fails
        }
      }
      
      let result;
      
      // If record exists, update it, otherwise create a new one
      if (existingRecords && existingRecords.length > 0) {
        const recordId = existingRecords[0].id;
        result = await updateRecord(baseId, tableName, recordId, airtableFields);
        return res.json({
          success: true,
          message: "Lead successfully updated in Airtable",
          recordId: result.id,
          operation: "update"
        });
      } else {
        result = await createRecord(baseId, tableName, airtableFields);
        return res.json({
          success: true,
          message: "Lead successfully created in Airtable",
          recordId: result.id,
          operation: "create"
        });
      }
    } catch (error) {
      console.error("Error syncing lead to Airtable:", error);
      return res.status(500).json({ 
        error: "Failed to sync lead to Airtable",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
