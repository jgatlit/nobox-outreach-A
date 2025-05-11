import { db } from "@db";
import { 
  leads, 
  leadEnrichment, 
  campaigns,
  emailTemplates,
  emailDrafts,
  adCampaigns,
  adVariants,
  workflows,
  integrations,
  Lead,
  LeadEnrichment,
  Workflow,
  Integration,
  Campaign,
  AdCampaign,
  AdVariant,
  EmailDraft
} from "@shared/schema";
import { eq, and, or, desc, asc, sql, like, not, inArray, gt, lt, isNull } from "drizzle-orm";
import { syncLeadToAirtable } from "./sync-manager";

export const storage = {
  // Lead Management
  async getAllLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  },

  async getLeadsBySegment(segment: string): Promise<Lead[]> {
    if (segment === 'active') {
      return db.select().from(leads).where(eq(leads.status, 'active')).orderBy(desc(leads.createdAt));
    } else if (segment === 'inactive') {
      return db.select().from(leads).where(eq(leads.status, 'inactive')).orderBy(desc(leads.createdAt));
    } else {
      return db.select().from(leads).where(eq(leads.source, segment as any)).orderBy(desc(leads.createdAt));
    }
  },

  async getLeadById(id: number): Promise<Lead | undefined> {
    const results = await db.select().from(leads).where(eq(leads.id, id));
    return results[0];
  },

  async getLeadWithEnrichment(id: number): Promise<{ lead: Lead, enrichment: LeadEnrichment | null }> {
    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, id),
      with: {
        enrichment: true
      }
    });
    
    if (!lead) {
      throw new Error(`Lead with ID ${id} not found`);
    }
    
    return {
      lead,
      enrichment: lead.enrichment
    };
  },

  async searchLeads(query: string): Promise<Lead[]> {
    return db.select().from(leads).where(
      or(
        like(leads.firstName, `%${query}%`),
        like(leads.lastName, `%${query}%`),
        like(leads.email, `%${query}%`),
        like(leads.company, `%${query}%`)
      )
    ).orderBy(desc(leads.createdAt));
  },

  async addLead(leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
    const [lead] = await db.insert(leads).values(leadData).returning();
    
    // Trigger Airtable sync for this new lead if Airtable integration is configured
    if (process.env.AIRTABLE_PAT && process.env.AIRTABLE_BASE_ID) {
      // Use setTimeout to avoid blocking the API response
      setTimeout(() => {
        syncLeadToAirtable(lead.id).catch(err => {
          console.error(`Failed to sync new lead ${lead.id} to Airtable:`, err);
        });
      }, 100);
    }
    
    return lead;
  },

  async updateLead(id: number, leadData: Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Lead> {
    const [updated] = await db
      .update(leads)
      .set({ ...leadData, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    
    // Trigger Airtable sync for this updated lead if Airtable integration is configured
    if (process.env.AIRTABLE_PAT && process.env.AIRTABLE_BASE_ID) {
      // Use setTimeout to avoid blocking the API response
      setTimeout(() => {
        syncLeadToAirtable(updated.id).catch(err => {
          console.error(`Failed to sync updated lead ${updated.id} to Airtable:`, err);
        });
      }, 100);
    }
    
    return updated;
  },

  async deleteLead(id: number): Promise<{ success: boolean }> {
    // Start a transaction to ensure all operations succeed or fail together
    await db.transaction(async (tx) => {
      // First delete associated email drafts
      await tx.delete(emailDrafts).where(eq(emailDrafts.leadId, id));
      
      // Then delete associated lead enrichment data
      await tx.delete(leadEnrichment).where(eq(leadEnrichment.leadId, id));
      
      // Finally delete the lead
      await tx.delete(leads).where(eq(leads.id, id));
    });
    
    return { success: true };
  },
  
  async bulkDeleteLeads(ids: number[]): Promise<{ success: boolean, count: number }> {
    if (!ids || ids.length === 0) {
      return { success: false, count: 0 };
    }

    // Start a transaction to ensure all operations succeed or fail together
    await db.transaction(async (tx) => {
      // First delete associated email drafts
      await tx.delete(emailDrafts).where(inArray(emailDrafts.leadId, ids));
      
      // Then delete associated lead enrichment data
      await tx.delete(leadEnrichment).where(inArray(leadEnrichment.leadId, ids));
      
      // Finally delete the leads
      await tx.delete(leads).where(inArray(leads.id, ids));
    });
    
    return { success: true, count: ids.length };
  },

  // Workflow Management
  async getAllWorkflows(): Promise<Workflow[]> {
    return db.select().from(workflows).orderBy(asc(workflows.name));
  },

  async getWorkflowById(id: number): Promise<Workflow | undefined> {
    const results = await db.select().from(workflows).where(eq(workflows.id, id));
    return results[0];
  },

  async updateWorkflowStatus(id: number, status: string, processedCount?: number, totalCount?: number): Promise<Workflow> {
    const updateData: any = { 
      status, 
      updatedAt: new Date() 
    };
    
    if (processedCount !== undefined) {
      updateData.processedCount = processedCount;
    }
    
    if (totalCount !== undefined) {
      updateData.totalCount = totalCount;
    }
    
    const [updated] = await db
      .update(workflows)
      .set(updateData)
      .where(eq(workflows.id, id))
      .returning();
    
    return updated;
  },

  async logWorkflowRun(id: number, processedCount: number, totalCount: number): Promise<Workflow> {
    const [updated] = await db
      .update(workflows)
      .set({ 
        lastRun: new Date(),
        processedCount,
        totalCount,
        updatedAt: new Date()
      })
      .where(eq(workflows.id, id))
      .returning();
    
    return updated;
  },

  // Integration Management
  async getAllIntegrations(): Promise<Integration[]> {
    return db.select().from(integrations).orderBy(asc(integrations.name));
  },

  async updateIntegrationStatus(id: number, status: string): Promise<Integration> {
    const [updated] = await db
      .update(integrations)
      .set({ 
        status, 
        lastChecked: new Date(),
        updatedAt: new Date()
      })
      .where(eq(integrations.id, id))
      .returning();
    
    return updated;
  },

  // Campaign Management
  async getAllCampaigns(): Promise<Campaign[]> {
    return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  },

  async getActiveCampaigns(): Promise<Campaign[]> {
    return db.select().from(campaigns).where(eq(campaigns.isActive, true)).orderBy(desc(campaigns.createdAt));
  },

  async getCampaignById(id: number): Promise<Campaign | undefined> {
    const results = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return results[0];
  },

  // Ad Campaign Management
  async getAllAdCampaigns(): Promise<AdCampaign[]> {
    return db.select().from(adCampaigns).orderBy(desc(adCampaigns.createdAt));
  },

  async getAdCampaignWithVariants(id: number): Promise<{ campaign: AdCampaign, variants: AdVariant[] }> {
    const campaign = await db.query.adCampaigns.findFirst({
      where: eq(adCampaigns.id, id),
      with: {
        adVariants: true
      }
    });
    
    if (!campaign) {
      throw new Error(`Ad campaign with ID ${id} not found`);
    }
    
    return {
      campaign,
      variants: campaign.adVariants
    };
  },

  // Email Draft Management
  async getEmailDraftsForLead(leadId: number): Promise<EmailDraft[]> {
    return db.select().from(emailDrafts).where(eq(emailDrafts.leadId, leadId)).orderBy(desc(emailDrafts.createdAt));
  },

  async addEmailDraft(draftData: Omit<EmailDraft, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailDraft> {
    const [draft] = await db.insert(emailDrafts).values(draftData).returning();
    return draft;
  },

  async updateEmailDraft(id: number, draftData: Partial<Omit<EmailDraft, 'id' | 'leadId' | 'createdAt' | 'updatedAt'>>): Promise<EmailDraft> {
    const [updated] = await db
      .update(emailDrafts)
      .set({ ...draftData, updatedAt: new Date() })
      .where(eq(emailDrafts.id, id))
      .returning();
    return updated;
  },

  // Lead Deduplication
  async findDuplicateLeads(email: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.email, email));
  },

  async deduplicateLeads(primaryLeadId: number, duplicateLeadIds: number[]): Promise<{ success: boolean }> {
    // This would implement your deduplication logic
    // In a transaction, it would merge data from duplicates into the primary lead
    // and then delete or mark the duplicates
    
    // Start a transaction to ensure all operations succeed or fail together
    await db.transaction(async (tx) => {
      // First delete associated email drafts for the duplicate leads
      await tx.delete(emailDrafts).where(inArray(emailDrafts.leadId, duplicateLeadIds));
      
      // Then delete associated lead enrichment data for the duplicate leads
      await tx.delete(leadEnrichment).where(inArray(leadEnrichment.leadId, duplicateLeadIds));
      
      // Finally delete the duplicate leads
      await tx.delete(leads).where(inArray(leads.id, duplicateLeadIds));
    });
    
    return { success: true };
  },

  // Lead Enrichment
  async addLeadEnrichment(enrichmentData: Omit<LeadEnrichment, 'id' | 'createdAt' | 'updatedAt'>): Promise<LeadEnrichment> {
    const [enrichment] = await db.insert(leadEnrichment).values(enrichmentData).returning();
    return enrichment;
  },

  async updateLeadEnrichment(leadId: number, enrichmentData: Partial<Omit<LeadEnrichment, 'id' | 'leadId' | 'createdAt' | 'updatedAt'>>): Promise<LeadEnrichment> {
    // First check if enrichment exists
    const existing = await db.select().from(leadEnrichment).where(eq(leadEnrichment.leadId, leadId));
    
    if (existing.length > 0) {
      // Update existing
      const [updated] = await db
        .update(leadEnrichment)
        .set({ ...enrichmentData, updatedAt: new Date() })
        .where(eq(leadEnrichment.leadId, leadId))
        .returning();
      return updated;
    } else {
      // Create new
      const [created] = await db.insert(leadEnrichment).values({
        leadId,
        ...enrichmentData as any,
      }).returning();
      return created;
    }
  },
  
  // Dashboard Statistics
  async getDashboardStats(): Promise<{
    totalLeads: number;
    activeCampaignCount: number;
    responseRate: number;
    opportunityCount: number;
  }> {
    const totalLeadsResult = await db.select({ count: sql<number>`count(*)` }).from(leads);
    const totalLeads = totalLeadsResult[0]?.count || 0;
    
    const activeCampaignsResult = await db.select({ count: sql<number>`count(*)` }).from(campaigns).where(eq(campaigns.isActive, true));
    const activeCampaignCount = activeCampaignsResult[0]?.count || 0;
    
    // For response rate, we'll use a simple calculation based on email status
    const sentEmailsResult = await db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.emailStatus, 'sent'));
    const sentEmails = sentEmailsResult[0]?.count || 0;
    
    const repliedEmailsResult = await db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.emailStatus, 'replied'));
    const repliedEmails = repliedEmailsResult[0]?.count || 0;
    
    const responseRate = sentEmails > 0 ? (repliedEmails / sentEmails) * 100 : 0;
    
    // For opportunities, we'll count leads with status 'qualified'
    const opportunityCountResult = await db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.status, 'qualified'));
    const opportunityCount = opportunityCountResult[0]?.count || 0;
    
    return {
      totalLeads,
      activeCampaignCount,
      responseRate,
      opportunityCount
    };
  }
};
