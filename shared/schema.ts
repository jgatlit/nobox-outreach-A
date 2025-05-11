import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Lead source enum
export const leadSourceEnum = pgEnum('lead_source', [
  'pipedrive', 
  'asana', 
  'email', 
  'instantly', 
  'cyberleads', 
  'linkedin',
  'manual'
]);

// Lead status enum
export const leadStatusEnum = pgEnum('lead_status', [
  'active',
  'inactive',
  'contacted',
  'responded',
  'qualified',
  'disqualified'
]);

// Lead priority enum
export const leadPriorityEnum = pgEnum('lead_priority', [
  'low',
  'medium',
  'high',
  'urgent'
]);

// Enrichment status enum
export const enrichmentStatusEnum = pgEnum('enrichment_status', [
  'not_started',
  'in_progress',
  'complete',
  'failed'
]);

// Email status enum
export const emailStatusEnum = pgEnum('email_status', [
  'not_started',
  'draft_generated',
  'sent',
  'opened',
  'clicked',
  'replied'
]);

// Tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull().unique(),
  company: text("company"),
  title: text("title"),
  phoneNumber: text("phone_number"),
  website: text("website"),
  linkedinUrl: text("linkedin_url"),
  source: leadSourceEnum("source").notNull(),
  status: leadStatusEnum("status").default('active'),
  priority: leadPriorityEnum("priority").default('medium'),
  notes: text("notes"),
  lastContactDate: timestamp("last_contact_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  enrichmentStatus: enrichmentStatusEnum("enrichment_status").default('not_started'),
  emailStatus: emailStatusEnum("email_status").default('not_started'),
  tags: text("tags").array(),
  // Priority metadata
  priorityScore: integer("priority_score"),
  priorityReason: text("priority_reason"),
  priorityUpdatedAt: timestamp("priority_updated_at"),
});

export const leadEnrichment = pgTable("lead_enrichment", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id).notNull(),
  companyInfo: jsonb("company_info"),
  techStack: jsonb("tech_stack"),
  recentEvents: jsonb("recent_events"),
  insights: text("insights").array(),
  personalizationHooks: text("personalization_hooks").array(),
  // Historical context fields
  projectHistory: jsonb("project_history"), // Asana projects, tasks, milestones
  emailHistory: jsonb("email_history"), // Previous email exchanges summary
  relationshipContext: text("relationship_context").array(), // Key relationship insights
  previousProposals: jsonb("previous_proposals"), // Past proposal details
  // Settings
  useEnhancedScraping: boolean("use_enhanced_scraping").default(true), // Enable/disable OpenAI enhancement
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  segmentFilters: jsonb("segment_filters"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailDrafts = pgTable("email_drafts", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id).notNull(),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  googleDocUrl: text("google_doc_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adCampaigns = pgTable("ad_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  segment: text("segment").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adVariants = pgTable("ad_variants", {
  id: serial("id").primaryKey(),
  adCampaignId: integer("ad_campaign_id").references(() => adCampaigns.id).notNull(),
  headline: text("headline").notNull(),
  body: text("body").notNull(),
  midjourneyPrompt: text("midjourney_prompt"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  n8nWorkflowId: text("n8n_workflow_id"),
  status: text("status").default('active'),
  lastRun: timestamp("last_run"),
  processedCount: integer("processed_count").default(0),
  totalCount: integer("total_count").default(0),
  nextScheduledRun: timestamp("next_scheduled_run"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const integrations = pgTable("integrations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  config: jsonb("config"),
  status: text("status").default('active'),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relationships
export const leadsRelations = relations(leads, ({ one, many }) => ({
  enrichment: one(leadEnrichment, {
    fields: [leads.id],
    references: [leadEnrichment.leadId],
  }),
  emailDrafts: many(emailDrafts),
}));

export const leadEnrichmentRelations = relations(leadEnrichment, ({ one }) => ({
  lead: one(leads, {
    fields: [leadEnrichment.leadId],
    references: [leads.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  emailTemplates: many(emailTemplates),
  emailDrafts: many(emailDrafts),
}));

export const adCampaignsRelations = relations(adCampaigns, ({ many }) => ({
  adVariants: many(adVariants),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertLeadSchema = createInsertSchema(leads, {
  email: (schema) => schema.email("Valid email address required"),
});

export const updateLeadSchema = createInsertSchema(leads, {
  email: (schema) => schema.email("Valid email address required"),
}).partial().omit({ id: true, createdAt: true });

export const insertLeadEnrichmentSchema = createInsertSchema(leadEnrichment);
export const insertCampaignSchema = createInsertSchema(campaigns);
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates);
export const insertEmailDraftSchema = createInsertSchema(emailDrafts);
export const insertAdCampaignSchema = createInsertSchema(adCampaigns);
export const insertAdVariantSchema = createInsertSchema(adVariants);
export const insertWorkflowSchema = createInsertSchema(workflows);
export const insertIntegrationSchema = createInsertSchema(integrations);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type UpdateLead = z.infer<typeof updateLeadSchema>;

export type LeadEnrichment = typeof leadEnrichment.$inferSelect;
export type InsertLeadEnrichment = z.infer<typeof insertLeadEnrichmentSchema>;

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

export type EmailDraft = typeof emailDrafts.$inferSelect;
export type InsertEmailDraft = z.infer<typeof insertEmailDraftSchema>;

export type AdCampaign = typeof adCampaigns.$inferSelect;
export type InsertAdCampaign = z.infer<typeof insertAdCampaignSchema>;

export type AdVariant = typeof adVariants.$inferSelect;
export type InsertAdVariant = z.infer<typeof insertAdVariantSchema>;

export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
