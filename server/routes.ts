import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertLeadSchema, insertWorkflowSchema, insertLeadEnrichmentSchema, updateLeadSchema } from "@shared/schema";
import { generatePersonalizedEmail, generateMidjourneyPrompt, generateCampaignSuggestions, generatePersonalizationHooks, enhanceWebsiteDataWithAI } from "./openai";
import { processWebsite, convertToCompanyContext } from "./apify";
import { upload } from "./middleware/upload";
import { importAsanaData, importGmailData, importLeadsFromCSV } from "./importers";
import path from "path";
import fs from "fs";

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
        
        // Get scraped content for AI enhancement
        const allScrapedText = scrapingResult.recentEvents.blogPosts?.join('\n') || '';
        const companyDescription = scrapingResult.companyInfo.description || '';
        const allContent = companyDescription + '\n\n' + allScrapedText;
        
        // Generate personalization hooks using OpenAI
        try {
          // Convert to CompanyContext format expected by OpenAI
          let companyContext = convertToCompanyContext(
            scrapingResult, 
            lead.website, 
            lead.company || "the company"
          );
          
          // Enhance the scraped data with OpenAI for better insights
          console.log(`Enhancing scraped data with OpenAI for ${lead.company || lead.website}`);
          if (allContent.length > 200) { // Only if we have meaningful content
            try {
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
              
              // Update the enrichment data with AI-enhanced information
              const enrichedCompanyInfo = JSON.parse(updatedData.companyInfo);
              if (enhancedData.industry) enrichedCompanyInfo.industry = enhancedData.industry;
              if (enhancedData.location) enrichedCompanyInfo.location = enhancedData.location;
              if (enhancedData.serviceOffering) enrichedCompanyInfo.serviceOffering = enhancedData.serviceOffering;
              if (enhancedData.campaignPurpose) enrichedCompanyInfo.campaignPurpose = enhancedData.campaignPurpose;
              
              updatedData.companyInfo = JSON.stringify(enrichedCompanyInfo);
              
              // Update recent events if enhanced data provided any
              if (enhancedData.recentEvents && enhancedData.recentEvents.length > 0) {
                const recentEventsData = JSON.parse(updatedData.recentEvents);
                recentEventsData.news = enhancedData.recentEvents;
                updatedData.recentEvents = JSON.stringify(recentEventsData);
              }
            } catch (enhanceError) {
              console.error(`Error enhancing website data with AI: ${enhanceError}`);
              // Continue with original scraped data if enhancement fails
            }
          }
          
          // Generate campaign suggestions
          const campaignSuggestions = await generateCampaignSuggestions(companyContext);
          
          if (campaignSuggestions) {
            // Add suggested campaign purpose and service offering to enrichment data
            const enrichedCompanyInfo = JSON.parse(updatedData.companyInfo);
            enrichedCompanyInfo.campaignPurpose = campaignSuggestions.campaignPurpose;
            enrichedCompanyInfo.serviceOffering = campaignSuggestions.serviceOffering;
            updatedData.companyInfo = JSON.stringify(enrichedCompanyInfo);
            
            // Generate personalization hooks
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
              
              // Extract insights from personalization hooks (first 3 items)
              updatedData.insights = personalizationHooks.slice(0, 3).map(hook => {
                return hook.startsWith("Their ") ? hook : `They ${hook.toLowerCase().startsWith('are') ? hook : 'are ' + hook}`;
              });
            }
          }
        } catch (aiError) {
          console.error("Error generating AI insights:", aiError);
          // Continue with the scraped data even if AI enhancement fails
        }
        
        // Update the enrichment data or create if doesn't exist
        const existingEnrichment = (await storage.getLeadWithEnrichment(leadId)).enrichment;
        
        if (existingEnrichment) {
          await storage.updateLeadEnrichment(leadId, updatedData);
        } else {
          await storage.addLeadEnrichment({
            ...updatedData,
            leadId,
            projectHistory: "{}", // Initialize empty structures
            emailHistory: "{}",
            relationshipContext: [],
            previousProposals: "{}"
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
          
          // Get scraped content for AI enhancement
          const allScrapedText = scrapingResult.recentEvents.blogPosts?.join('\n') || '';
          const companyDescription = scrapingResult.companyInfo.description || '';
          const allContent = companyDescription + '\n\n' + allScrapedText;
          
          // Generate personalization hooks using OpenAI
          try {
            // Convert to CompanyContext format expected by OpenAI
            let companyContext = convertToCompanyContext(
              scrapingResult, 
              lead.website, 
              lead.company || "the company"
            );
            
            // Enhance the scraped data with OpenAI for better insights
            console.log(`Bulk refresh: Enhancing scraped data with OpenAI for ${lead.company || lead.website}`);
            if (allContent.length > 200) { // Only if we have meaningful content
              try {
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
                
                // Update the enrichment data with AI-enhanced information
                const enrichedCompanyInfo = JSON.parse(updatedData.companyInfo);
                if (enhancedData.industry) enrichedCompanyInfo.industry = enhancedData.industry;
                if (enhancedData.location) enrichedCompanyInfo.location = enhancedData.location;
                if (enhancedData.serviceOffering) enrichedCompanyInfo.serviceOffering = enhancedData.serviceOffering;
                if (enhancedData.campaignPurpose) enrichedCompanyInfo.campaignPurpose = enhancedData.campaignPurpose;
                
                updatedData.companyInfo = JSON.stringify(enrichedCompanyInfo);
                
                // Update recent events if enhanced data provided any
                if (enhancedData.recentEvents && enhancedData.recentEvents.length > 0) {
                  const recentEventsData = JSON.parse(updatedData.recentEvents);
                  recentEventsData.news = enhancedData.recentEvents;
                  updatedData.recentEvents = JSON.stringify(recentEventsData);
                }
              } catch (enhanceError) {
                console.error(`Bulk refresh: Error enhancing website data with AI: ${enhanceError}`);
                // Continue with original scraped data if enhancement fails
              }
            }
            
            // Generate campaign suggestions
            const campaignSuggestions = await generateCampaignSuggestions(companyContext);
            
            if (campaignSuggestions) {
              // Add suggested campaign purpose and service offering to enrichment data
              const enrichedCompanyInfo = JSON.parse(updatedData.companyInfo);
              enrichedCompanyInfo.campaignPurpose = campaignSuggestions.campaignPurpose;
              enrichedCompanyInfo.serviceOffering = campaignSuggestions.serviceOffering;
              updatedData.companyInfo = JSON.stringify(enrichedCompanyInfo);
              
              // Generate personalization hooks
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
                
                // Extract insights from personalization hooks (first 3 items)
                updatedData.insights = personalizationHooks.slice(0, 3).map(hook => {
                  return hook.startsWith("Their ") ? hook : `They ${hook.toLowerCase().startsWith('are') ? hook : 'are ' + hook}`;
                });
              }
            }
          } catch (aiError) {
            console.error(`Error generating AI insights for lead ${leadId}:`, aiError);
            // Continue with the scraped data even if AI enhancement fails
          }
          
          // Update the enrichment data or create if doesn't exist
          const existingEnrichment = (await storage.getLeadWithEnrichment(leadId)).enrichment;
          
          if (existingEnrichment) {
            await storage.updateLeadEnrichment(leadId, updatedData);
          } else {
            await storage.addLeadEnrichment({
              ...updatedData,
              leadId,
              projectHistory: "{}", // Initialize empty structures
              emailHistory: "{}",
              relationshipContext: [],
              previousProposals: "{}"
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

  const httpServer = createServer(app);
  return httpServer;
}
