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
  'manual',
  'airtable',
  'import'
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

// Workflow orchestration enums
export const workflowStepEnum = pgEnum('workflow_step', [
  'context_gathering',
  'audience_analysis', 
  'objective_definition',
  'prospect_enrichment',
  'trigger_detection',
  'strategy_selection',
  'hook_generation',
  'message_composition',
  'compliance_check',
  'variant_generation',
  'sequence_orchestration',
  'performance_tracking'
]);

export const workflowStatusEnum = pgEnum('workflow_status', [
  'initializing',
  'running',
  'paused',
  'completed',
  'error'
]);

export const psychologicalStrategyEnum = pgEnum('psychological_strategy', [
  'pattern_disruption',
  'ego_relevance', 
  'loss_aversion',
  'curiosity_gap',
  'social_proof'
]);

export const communicationChannelEnum = pgEnum('communication_channel', [
  'email',
  'linkedin',
  'phone'
]);

export const sequenceStatusEnum = pgEnum('sequence_status', [
  'pending',
  'active',
  'paused',
  'completed'
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
  // Sales coaching data
  salesCoachingTips: jsonb("sales_coaching_tips"),
  prospectAnalysis: text("prospect_analysis"),
  suggestedApproach: text("suggested_approach"),
  potentialObjections: text("potential_objections").array(),
  keyValuePropositions: text("key_value_propositions").array(),
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

// Workflow orchestration tables
export const workflowStates = pgTable("workflow_states", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  threadId: text("thread_id").notNull(),
  checkpointId: text("checkpoint_id").notNull(),
  currentStep: workflowStepEnum("current_step").notNull(),
  workflowStatus: workflowStatusEnum("workflow_status").default('initializing').notNull(),
  psychologicalStrategy: psychologicalStrategyEnum("psychological_strategy"),
  sequencePosition: integer("sequence_position").default(0),
  stateData: jsonb("state_data").notNull().default('{}'),
  errorDetails: text("error_details"),
  retryCount: integer("retry_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const touchpoints = pgTable("touchpoints", {
  id: serial("id").primaryKey(),
  workflowStateId: integer("workflow_state_id").references(() => workflowStates.id, { onDelete: 'cascade' }).notNull(),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  sequenceStep: integer("sequence_step").notNull(),
  channel: communicationChannelEnum("channel").notNull(),
  action: text("action").notNull(),
  scheduledFor: timestamp("scheduled_for"),
  executedAt: timestamp("executed_at"),
  responseDetected: boolean("response_detected").default(false),
  responseDetectedAt: timestamp("response_detected_at"),
  messageId: integer("message_id").references(() => emailDrafts.id),
  metadata: jsonb("metadata").default('{}'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const strategyPerformance = pgTable("strategy_performance", {
  id: serial("id").primaryKey(),
  strategyName: psychologicalStrategyEnum("strategy_name").notNull(),
  prospectTier: integer("prospect_tier"),
  industry: text("industry"),
  titleSeniority: text("title_seniority"),
  messagesSent: integer("messages_sent").default(0),
  repliesReceived: integer("replies_received").default(0),
  meetingsBooked: integer("meetings_booked").default(0),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const campaignWorkflowMetrics = pgTable("campaign_workflow_metrics", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }).notNull().unique(),
  totalProspects: integer("total_prospects").default(0),
  prospectsCompleted: integer("prospects_completed").default(0),
  prospectsInProgress: integer("prospects_in_progress").default(0),
  prospectsError: integer("prospects_error").default(0),
  avgCompletionTimeMinutes: integer("avg_completion_time_minutes"),
  overallReplyRate: integer("overall_reply_rate"), // Store as percentage * 100 (e.g., 15.5% = 1550)
  topPerformingStrategy: psychologicalStrategyEnum("top_performing_strategy"),
  lastCalculated: timestamp("last_calculated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messageVariants = pgTable("message_variants", {
  id: serial("id").primaryKey(),
  workflowStateId: integer("workflow_state_id").references(() => workflowStates.id, { onDelete: 'cascade' }).notNull(),
  variantLabel: text("variant_label").notNull(), // 'A', 'B', 'C'
  subjectLine: text("subject_line").notNull(),
  body: text("body").notNull(),
  psychologicalStrategy: psychologicalStrategyEnum("psychological_strategy").notNull(),
  personalizationLevel: integer("personalization_level").default(1),
  spamScore: integer("spam_score").default(0), // Store as score * 100 (e.g., 3.5 = 350)
  predictedReplyRate: integer("predicted_reply_rate").default(500), // Store as percentage * 10000 (e.g., 5% = 500)
  actualReplyRate: integer("actual_reply_rate"),
  isSelected: boolean("is_selected").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  workflowStates: many(workflowStates),
  touchpoints: many(touchpoints),
  strategyPerformance: many(strategyPerformance),
  // workflowMetrics: one(campaignWorkflowMetrics), // Commented out until proper import is resolved
}));

export const adCampaignsRelations = relations(adCampaigns, ({ many }) => ({
  adVariants: many(adVariants),
}));

// Workflow orchestration relationships
export const workflowStatesRelations = relations(workflowStates, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [workflowStates.campaignId],
    references: [campaigns.id],
  }),
  lead: one(leads, {
    fields: [workflowStates.leadId],
    references: [leads.id],
  }),
  touchpoints: many(touchpoints),
  messageVariants: many(messageVariants),
}));

export const touchpointsRelations = relations(touchpoints, ({ one }) => ({
  workflowState: one(workflowStates, {
    fields: [touchpoints.workflowStateId],
    references: [workflowStates.id],
  }),
  lead: one(leads, {
    fields: [touchpoints.leadId],
    references: [leads.id],
  }),
  campaign: one(campaigns, {
    fields: [touchpoints.campaignId],
    references: [campaigns.id],
  }),
  message: one(emailDrafts, {
    fields: [touchpoints.messageId],
    references: [emailDrafts.id],
  }),
}));

export const strategyPerformanceRelations = relations(strategyPerformance, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [strategyPerformance.campaignId],
    references: [campaigns.id],
  }),
}));

export const campaignWorkflowMetricsRelations = relations(campaignWorkflowMetrics, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignWorkflowMetrics.campaignId],
    references: [campaigns.id],
  }),
}));

export const messageVariantsRelations = relations(messageVariants, ({ one }) => ({
  workflowState: one(workflowStates, {
    fields: [messageVariants.workflowStateId],
    references: [workflowStates.id],
  }),
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

// Workflow orchestration schemas
export const insertWorkflowStateSchema = createInsertSchema(workflowStates);
export const insertTouchpointSchema = createInsertSchema(touchpoints);
export const insertStrategyPerformanceSchema = createInsertSchema(strategyPerformance);
export const insertCampaignWorkflowMetricsSchema = createInsertSchema(campaignWorkflowMetrics);
export const insertMessageVariantSchema = createInsertSchema(messageVariants);

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

// Workflow orchestration types
export type WorkflowState = typeof workflowStates.$inferSelect;
export type InsertWorkflowState = z.infer<typeof insertWorkflowStateSchema>;

export type Touchpoint = typeof touchpoints.$inferSelect;
export type InsertTouchpoint = z.infer<typeof insertTouchpointSchema>;

export type StrategyPerformance = typeof strategyPerformance.$inferSelect;
export type InsertStrategyPerformance = z.infer<typeof insertStrategyPerformanceSchema>;

export type CampaignWorkflowMetrics = typeof campaignWorkflowMetrics.$inferSelect;
export type InsertCampaignWorkflowMetrics = z.infer<typeof insertCampaignWorkflowMetricsSchema>;

export type MessageVariant = typeof messageVariants.$inferSelect;
export type InsertMessageVariant = z.infer<typeof insertMessageVariantSchema>;

// Enum value types for TypeScript
export type WorkflowStep = typeof workflowStepEnum.enumValues[number];
export type WorkflowStatus = typeof workflowStatusEnum.enumValues[number];
export type PsychologicalStrategy = typeof psychologicalStrategyEnum.enumValues[number];
export type CommunicationChannel = typeof communicationChannelEnum.enumValues[number];
export type SequenceStatus = typeof sequenceStatusEnum.enumValues[number];
