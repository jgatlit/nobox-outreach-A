import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertLeadSchema, insertWorkflowSchema, insertLeadEnrichmentSchema, updateLeadSchema } from "@shared/schema";
import { generatePersonalizedEmail, generateMidjourneyPrompt } from "./openai";

export async function registerRoutes(app: Express): Promise<Server> {
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
      
      // Generate email with additional style parameters
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
        }
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

  const httpServer = createServer(app);
  return httpServer;
}
