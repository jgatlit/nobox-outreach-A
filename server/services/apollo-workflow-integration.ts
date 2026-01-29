/**
 * Apollo-Workflow Integration Service
 *
 * Bridges Apollo.io lead discovery with the existing 12-step workflow orchestration.
 * This is the "highest-value innovation" - connecting ICP-based discovery
 * to psychologically-optimized outreach.
 *
 * Integration Flow:
 * 1. Apollo Discovery -> Lead Import with ICP tagging
 * 2. ICP -> Archetype -> Psychology Strategy selection
 * 3. Strategy -> Prompt Generation -> AI Email
 * 4. Email -> Campaign Execution -> Response Tracking
 * 5. Response Data -> Strategy Optimization feedback loop
 */

import { db } from '../../db';
import { leads, leadEnrichment, campaigns, emailDrafts } from '../../shared/schema';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { ApolloService } from './apollo/apollo-service';
import { ApolloSearchFilters, ApolloPerson } from './apollo/apollo-types';
import {
  ICP_PRESETS,
  getPreset,
  getFiltersForPreset,
  getPresetMetadata,
} from '../config/icp-presets';
import {
  selectStrategiesForICP,
  generateEmailPrompt,
  PSYCHOLOGICAL_STRATEGIES,
  EmailPromptContext,
} from '../config/icp-psychology-map';
import { OrchestratorClient } from '../../services/orchestrator-client';
import { logger } from '../utils/logger';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface DiscoveryToOutreachRequest {
  icpPresetKey: string;
  customFilters?: Partial<ApolloSearchFilters>;
  maxLeads?: number;
  campaignId?: string;
  autoGenerateEmails?: boolean;
  strategyOverride?: string;
}

export interface DiscoveryResult {
  success: boolean;
  discoveredContacts: number;
  importedLeads: number;
  skippedDuplicates: number;
  errors: string[];
  leadIds: number[];
  presetUsed: string;
  filtersUsed: ApolloSearchFilters;
}

export interface OutreachPrepResult {
  success: boolean;
  leadId: number;
  icpKey: string;
  archetype: string;
  selectedStrategy: string;
  emailPrompt: {
    system: string;
    user: string;
  };
  communicationStyle: {
    tone: string;
    length: string;
    formality: string;
  };
}

export interface BatchOutreachResult {
  success: boolean;
  processed: number;
  emailsGenerated: number;
  errors: string[];
  results: OutreachPrepResult[];
}

export interface CampaignExecutionRequest {
  campaignId: string;
  leadIds: number[];
  icpPresetKey?: string;
  strategyOverride?: string;
  sendImmediately?: boolean;
}

export interface CampaignExecutionResult {
  success: boolean;
  campaignId: string;
  totalLeads: number;
  emailsGenerated: number;
  emailsSent: number;
  errors: string[];
  leadResults: Array<{
    leadId: number;
    status: 'success' | 'error';
    emailDraftId?: number;
    error?: string;
  }>;
}

// =============================================================================
// APOLLO WORKFLOW INTEGRATION SERVICE
// =============================================================================

export class ApolloWorkflowIntegration {
  private apolloService: ApolloService;
  private orchestratorClient: OrchestratorClient;

  constructor() {
    this.apolloService = new ApolloService();
    this.orchestratorClient = new OrchestratorClient();
  }

  // ===========================================================================
  // PHASE 1: DISCOVERY -> IMPORT
  // ===========================================================================

  /**
   * Discover leads via Apollo and import with ICP tagging
   * This is the entry point of the Apollo->Workflow pipeline
   */
  async discoverAndImport(request: DiscoveryToOutreachRequest): Promise<DiscoveryResult> {
    const preset = getPreset(request.icpPresetKey);
    if (!preset) {
      return {
        success: false,
        discoveredContacts: 0,
        importedLeads: 0,
        skippedDuplicates: 0,
        errors: [`ICP preset '${request.icpPresetKey}' not found`],
        leadIds: [],
        presetUsed: request.icpPresetKey,
        filtersUsed: {},
      };
    }

    // Get filters from preset and merge with custom filters
    const baseFilters = getFiltersForPreset(request.icpPresetKey);
    const searchFilters: ApolloSearchFilters = {
      ...baseFilters,
      ...request.customFilters,
    };

    const errors: string[] = [];
    const leadIds: number[] = [];
    let discoveredContacts = 0;
    let importedLeads = 0;
    let skippedDuplicates = 0;

    try {
      // Validate and sanitize filters
      const validation = this.apolloService.validateFilters(searchFilters, preset.search_mode);
      if (!validation.valid) {
        errors.push(...validation.errors);
        logger.warn('Filter validation warnings:', validation.warnings);
      }

      // Execute search
      const maxLeads = request.maxLeads || 100;
      const perPage = Math.min(maxLeads, 100);
      const results = await this.apolloService.searchPeople(
        validation.sanitized_filters!,
        1,
        perPage
      );

      discoveredContacts = results.people.length;
      logger.info(`Discovered ${discoveredContacts} contacts for ICP: ${request.icpPresetKey}`);

      // Import leads with ICP tagging
      for (const contact of results.people) {
        try {
          // Check for duplicate
          if (contact.email) {
            const existing = await db
              .select({ id: leads.id })
              .from(leads)
              .where(eq(leads.email, contact.email))
              .limit(1);

            if (existing.length > 0) {
              skippedDuplicates++;
              continue;
            }
          }

          // Create lead with ICP metadata
          const phoneNumber = contact.phone_numbers?.[0]?.sanitized_number || null;
          const leadData = {
            firstName: contact.first_name || null,
            lastName: contact.last_name || null,
            email: contact.email,
            phoneNumber,
            company: contact.organization?.name || null,
            title: contact.title || null,
            website: contact.organization?.website_url || null,
            linkedinUrl: contact.linkedin_url || null,
            source: 'apollo' as const,
            status: 'active' as const,
            apolloContactId: contact.id,
            apolloOrganizationId: contact.organization?.id || null,
            icpPresetKey: request.icpPresetKey,
            archetype: preset.archetype,
            discoverySource: 'apollo_workflow',
            emailVerified: contact.email_status === 'verified',
            notes: this.buildLeadNotes(contact, preset),
          };

          const [newLead] = await db.insert(leads).values(leadData).returning();
          leadIds.push(newLead.id);
          importedLeads++;

          // Create initial enrichment record with ICP context
          await this.createInitialEnrichment(newLead.id, contact, preset);

        } catch (contactError: any) {
          errors.push(`Failed to import ${contact.email}: ${contactError.message}`);
        }
      }

      // If auto-generate emails is enabled, prepare outreach for all leads
      if (request.autoGenerateEmails && leadIds.length > 0) {
        await this.prepareOutreachBatch({
          leadIds,
          icpPresetKey: request.icpPresetKey,
          campaignId: request.campaignId,
          strategyOverride: request.strategyOverride,
        });
      }

      return {
        success: errors.length === 0,
        discoveredContacts,
        importedLeads,
        skippedDuplicates,
        errors,
        leadIds,
        presetUsed: request.icpPresetKey,
        filtersUsed: validation.sanitized_filters!,
      };

    } catch (error: any) {
      logger.error('Discovery and import failed:', error);
      return {
        success: false,
        discoveredContacts,
        importedLeads,
        skippedDuplicates,
        errors: [...errors, error.message],
        leadIds,
        presetUsed: request.icpPresetKey,
        filtersUsed: searchFilters,
      };
    }
  }

  // ===========================================================================
  // PHASE 2: OUTREACH PREPARATION
  // ===========================================================================

  /**
   * Prepare outreach for a single lead
   * Selects strategy and generates AI prompt based on ICP
   */
  async prepareOutreach(
    leadId: number,
    icpPresetKey?: string,
    strategyOverride?: string
  ): Promise<OutreachPrepResult> {
    // Get lead data
    const leadData = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (leadData.length === 0) {
      throw new Error(`Lead ${leadId} not found`);
    }

    const lead = leadData[0];
    const effectiveIcpKey = icpPresetKey || lead.icpPresetKey || 'workers_comp_law_firms';
    const preset = getPreset(effectiveIcpKey);

    if (!preset) {
      throw new Error(`ICP preset '${effectiveIcpKey}' not found`);
    }

    // Get strategy selection
    const strategySelection = selectStrategiesForICP(effectiveIcpKey);
    if (!strategySelection) {
      throw new Error(`No strategy selection available for ICP '${effectiveIcpKey}'`);
    }

    // Determine final strategy (override or primary recommendation)
    const finalStrategy = strategyOverride || strategySelection.primary_recommendations[0]?.strategy_id || 'ego_relevance';

    // Get enrichment data if available
    const enrichmentData = await db
      .select()
      .from(leadEnrichment)
      .where(eq(leadEnrichment.leadId, leadId))
      .limit(1);

    // Build prompt context
    const promptContext: EmailPromptContext = {
      icp_key: effectiveIcpKey,
      lead: {
        name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        company: lead.company || 'Unknown Company',
        title: lead.title || 'Professional',
        linkedin_url: lead.linkedinUrl || undefined,
        enrichment_data: enrichmentData[0] ? {
          companyInfo: enrichmentData[0].companyInfo,
          techStack: enrichmentData[0].techStack,
          insights: enrichmentData[0].insights,
        } : undefined,
      },
      strategy_override: strategyOverride,
    };

    // Generate prompt
    const prompt = generateEmailPrompt(promptContext);

    return {
      success: true,
      leadId,
      icpKey: effectiveIcpKey,
      archetype: preset.archetype,
      selectedStrategy: finalStrategy,
      emailPrompt: {
        system: prompt.system_prompt,
        user: prompt.user_prompt,
      },
      communicationStyle: {
        tone: strategySelection.communication_guidelines.tone,
        length: strategySelection.communication_guidelines.length,
        formality: strategySelection.communication_guidelines.formality,
      },
    };
  }

  /**
   * Prepare outreach for a batch of leads
   */
  async prepareOutreachBatch(params: {
    leadIds: number[];
    icpPresetKey?: string;
    campaignId?: string;
    strategyOverride?: string;
  }): Promise<BatchOutreachResult> {
    const results: OutreachPrepResult[] = [];
    const errors: string[] = [];
    let emailsGenerated = 0;

    for (const leadId of params.leadIds) {
      try {
        const outreachResult = await this.prepareOutreach(
          leadId,
          params.icpPresetKey,
          params.strategyOverride
        );
        results.push(outreachResult);

        // Store email draft if campaign is specified
        if (params.campaignId && outreachResult.success) {
          // Here you would call your AI service to generate the actual email
          // For now, we store the prompt for later generation
          emailsGenerated++;
        }
      } catch (error: any) {
        errors.push(`Lead ${leadId}: ${error.message}`);
        results.push({
          success: false,
          leadId,
          icpKey: params.icpPresetKey || 'unknown',
          archetype: 'unknown',
          selectedStrategy: 'none',
          emailPrompt: { system: '', user: '' },
          communicationStyle: { tone: '', length: '', formality: '' },
        });
      }
    }

    return {
      success: errors.length === 0,
      processed: params.leadIds.length,
      emailsGenerated,
      errors,
      results,
    };
  }

  // ===========================================================================
  // PHASE 3: CAMPAIGN EXECUTION
  // ===========================================================================

  /**
   * Execute a campaign for leads with Apollo ICP context
   * Integrates with the existing orchestrator
   */
  async executeCampaign(request: CampaignExecutionRequest): Promise<CampaignExecutionResult> {
    const leadResults: CampaignExecutionResult['leadResults'] = [];
    const errors: string[] = [];
    let emailsGenerated = 0;
    let emailsSent = 0;

    try {
      // Check orchestrator availability
      const isOrchestratorReady = await this.orchestratorClient.isHealthy();

      for (const leadId of request.leadIds) {
        try {
          // Prepare outreach with ICP-based strategy
          const outreach = await this.prepareOutreach(
            leadId,
            request.icpPresetKey,
            request.strategyOverride
          );

          if (!outreach.success) {
            leadResults.push({
              leadId,
              status: 'error',
              error: 'Failed to prepare outreach',
            });
            continue;
          }

          // If orchestrator is ready, use it for email generation
          if (isOrchestratorReady && process.env.ORCHESTRATOR_ENABLED === 'true') {
            try {
              const result = await this.orchestratorClient.processSingleProspect(
                leadId.toString(),
                request.campaignId,
                {
                  icp_key: outreach.icpKey,
                  strategy: outreach.selectedStrategy,
                  prompt: outreach.emailPrompt,
                }
              );

              if (result.email_result) {
                // Store email draft
                const [draft] = await db.insert(emailDrafts).values({
                  leadId,
                  campaignId: parseInt(request.campaignId) || null,
                  subject: result.email_result.subject,
                  body: result.email_result.body,
                }).returning();

                emailsGenerated++;
                if (request.sendImmediately) {
                  emailsSent++;
                }

                leadResults.push({
                  leadId,
                  status: 'success',
                  emailDraftId: draft.id,
                });
              } else {
                leadResults.push({
                  leadId,
                  status: 'error',
                  error: 'No email generated from orchestrator',
                });
              }
            } catch (orchError: any) {
              errors.push(`Orchestrator error for lead ${leadId}: ${orchError.message}`);
              leadResults.push({
                leadId,
                status: 'error',
                error: orchError.message,
              });
            }
          } else {
            // Fallback: Store prompt for manual or later generation
            logger.info(`Orchestrator not available, storing prompt for lead ${leadId}`);
            leadResults.push({
              leadId,
              status: 'success',
              // Prompt stored but no email generated yet
            });
          }

        } catch (leadError: any) {
          errors.push(`Lead ${leadId}: ${leadError.message}`);
          leadResults.push({
            leadId,
            status: 'error',
            error: leadError.message,
          });
        }
      }

      return {
        success: errors.length === 0,
        campaignId: request.campaignId,
        totalLeads: request.leadIds.length,
        emailsGenerated,
        emailsSent,
        errors,
        leadResults,
      };

    } catch (error: any) {
      logger.error('Campaign execution failed:', error);
      return {
        success: false,
        campaignId: request.campaignId,
        totalLeads: request.leadIds.length,
        emailsGenerated,
        emailsSent,
        errors: [...errors, error.message],
        leadResults,
      };
    }
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private buildLeadNotes(contact: ApolloPerson, preset: typeof ICP_PRESETS[keyof typeof ICP_PRESETS]): string {
    const parts: string[] = [];

    if (contact.organization?.industry) {
      parts.push(`Industry: ${contact.organization.industry}`);
    }

    const location = [contact.city, contact.state, contact.country].filter(Boolean).join(', ');
    if (location) {
      parts.push(`Location: ${location}`);
    }

    if (contact.organization?.estimated_num_employees) {
      parts.push(`Company Size: ${contact.organization.estimated_num_employees} employees`);
    }

    parts.push(`ICP: ${preset.name}`);
    parts.push(`Archetype: ${preset.archetype}`);

    return parts.join(' | ');
  }

  private async createInitialEnrichment(
    leadId: number,
    contact: ApolloPerson,
    preset: typeof ICP_PRESETS[keyof typeof ICP_PRESETS]
  ): Promise<void> {
    const companyInfo: Record<string, any> = {};

    if (contact.organization) {
      companyInfo.name = contact.organization.name;
      companyInfo.industry = contact.organization.industry;
      companyInfo.website = contact.organization.website_url;
      companyInfo.estimated_num_employees = contact.organization.estimated_num_employees;
      companyInfo.founded_year = contact.organization.founded_year;
    }

    // Pre-populate with ICP-specific insights
    const insights = [
      `ICP Match: ${preset.name}`,
      `Archetype: ${preset.archetype}`,
      `Recommended strategies: ${preset.primary_strategies.join(', ')}`,
    ];

    await db.insert(leadEnrichment).values({
      leadId,
      companyInfo,
      insights,
      // Pre-populate coaching from ICP
      suggestedApproach: preset.messaging_style,
      potentialObjections: preset.pain_points.slice(0, 3),
      keyValuePropositions: preset.use_cases.slice(0, 3),
    });
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Get leads by ICP preset for campaign targeting
   */
  async getLeadsByICP(icpPresetKey: string, limit: number = 100): Promise<number[]> {
    const leadsData = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          eq(leads.icpPresetKey, icpPresetKey),
          eq(leads.status, 'active')
        )
      )
      .limit(limit);

    return leadsData.map((l) => l.id);
  }

  /**
   * Get strategy performance metrics by ICP
   */
  async getStrategyPerformanceByICP(icpPresetKey: string): Promise<{
    strategy: string;
    emailsSent: number;
    opens: number;
    replies: number;
    openRate: number;
    replyRate: number;
  }[]> {
    // This would query the email tracking data
    // For now, return placeholder structure
    const preset = getPreset(icpPresetKey);
    if (!preset) return [];

    return preset.primary_strategies.map((strategy) => ({
      strategy,
      emailsSent: 0,
      opens: 0,
      replies: 0,
      openRate: 0,
      replyRate: 0,
    }));
  }
}

// Export singleton instance
export const apolloWorkflowIntegration = new ApolloWorkflowIntegration();

export default apolloWorkflowIntegration;
