/**
 * Apollo Workflow Integration Routes
 *
 * API endpoints for the Apollo-to-Outreach workflow pipeline
 */

import { Router, Request, Response } from 'express';
import {
  apolloWorkflowIntegration,
  DiscoveryToOutreachRequest,
  CampaignExecutionRequest,
} from '../services/apollo-workflow-integration';
import { logger } from '../utils/logger';

const router = Router();

// =============================================================================
// DISCOVERY -> IMPORT WORKFLOW
// =============================================================================

/**
 * POST /api/apollo/workflow/discover
 * Discover leads via Apollo and import with ICP tagging
 */
router.post('/discover', async (req: Request, res: Response) => {
  try {
    const request: DiscoveryToOutreachRequest = {
      icpPresetKey: req.body.icp_preset_key,
      customFilters: req.body.custom_filters,
      maxLeads: req.body.max_leads || 100,
      campaignId: req.body.campaign_id,
      autoGenerateEmails: req.body.auto_generate_emails || false,
      strategyOverride: req.body.strategy_override,
    };

    if (!request.icpPresetKey) {
      return res.status(400).json({ error: 'icp_preset_key is required' });
    }

    const result = await apolloWorkflowIntegration.discoverAndImport(request);

    res.json({
      success: result.success,
      summary: {
        discovered: result.discoveredContacts,
        imported: result.importedLeads,
        skipped: result.skippedDuplicates,
        errors: result.errors.length,
      },
      lead_ids: result.leadIds,
      preset_used: result.presetUsed,
      filters_used: result.filtersUsed,
      errors: result.errors,
    });
  } catch (error: any) {
    logger.error('Discovery workflow failed:', error);
    res.status(500).json({
      error: 'Discovery workflow failed',
      details: error.message,
    });
  }
});

// =============================================================================
// OUTREACH PREPARATION
// =============================================================================

/**
 * POST /api/apollo/workflow/prepare-outreach
 * Prepare outreach for a single lead (select strategy, generate prompt)
 */
router.post('/prepare-outreach', async (req: Request, res: Response) => {
  try {
    const { lead_id, icp_preset_key, strategy_override } = req.body;

    if (!lead_id) {
      return res.status(400).json({ error: 'lead_id is required' });
    }

    const result = await apolloWorkflowIntegration.prepareOutreach(
      parseInt(lead_id),
      icp_preset_key,
      strategy_override
    );

    res.json({
      success: result.success,
      lead_id: result.leadId,
      icp: {
        key: result.icpKey,
        archetype: result.archetype,
      },
      strategy: result.selectedStrategy,
      email_prompt: result.emailPrompt,
      communication_style: result.communicationStyle,
    });
  } catch (error: any) {
    logger.error('Outreach preparation failed:', error);
    res.status(500).json({
      error: 'Outreach preparation failed',
      details: error.message,
    });
  }
});

/**
 * POST /api/apollo/workflow/prepare-outreach/batch
 * Prepare outreach for multiple leads
 */
router.post('/prepare-outreach/batch', async (req: Request, res: Response) => {
  try {
    const { lead_ids, icp_preset_key, campaign_id, strategy_override } = req.body;

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'lead_ids array is required' });
    }

    const result = await apolloWorkflowIntegration.prepareOutreachBatch({
      leadIds: lead_ids.map((id: any) => parseInt(id)),
      icpPresetKey: icp_preset_key,
      campaignId: campaign_id,
      strategyOverride: strategy_override,
    });

    res.json({
      success: result.success,
      summary: {
        processed: result.processed,
        emails_generated: result.emailsGenerated,
        errors: result.errors.length,
      },
      results: result.results.map((r) => ({
        lead_id: r.leadId,
        success: r.success,
        icp_key: r.icpKey,
        archetype: r.archetype,
        strategy: r.selectedStrategy,
      })),
      errors: result.errors,
    });
  } catch (error: any) {
    logger.error('Batch outreach preparation failed:', error);
    res.status(500).json({
      error: 'Batch outreach preparation failed',
      details: error.message,
    });
  }
});

// =============================================================================
// CAMPAIGN EXECUTION
// =============================================================================

/**
 * POST /api/apollo/workflow/execute-campaign
 * Execute a campaign for leads with ICP-based strategy
 */
router.post('/execute-campaign', async (req: Request, res: Response) => {
  try {
    const request: CampaignExecutionRequest = {
      campaignId: req.body.campaign_id,
      leadIds: (req.body.lead_ids || []).map((id: any) => parseInt(id)),
      icpPresetKey: req.body.icp_preset_key,
      strategyOverride: req.body.strategy_override,
      sendImmediately: req.body.send_immediately || false,
    };

    if (!request.campaignId) {
      return res.status(400).json({ error: 'campaign_id is required' });
    }

    if (request.leadIds.length === 0) {
      return res.status(400).json({ error: 'lead_ids array is required' });
    }

    const result = await apolloWorkflowIntegration.executeCampaign(request);

    res.json({
      success: result.success,
      campaign_id: result.campaignId,
      summary: {
        total_leads: result.totalLeads,
        emails_generated: result.emailsGenerated,
        emails_sent: result.emailsSent,
        errors: result.errors.length,
      },
      lead_results: result.leadResults,
      errors: result.errors,
    });
  } catch (error: any) {
    logger.error('Campaign execution failed:', error);
    res.status(500).json({
      error: 'Campaign execution failed',
      details: error.message,
    });
  }
});

// =============================================================================
// UTILITY ENDPOINTS
// =============================================================================

/**
 * GET /api/apollo/workflow/leads-by-icp/:icpKey
 * Get leads by ICP preset for targeting
 */
router.get('/leads-by-icp/:icpKey', async (req: Request, res: Response) => {
  try {
    const { icpKey } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const leadIds = await apolloWorkflowIntegration.getLeadsByICP(icpKey, limit);

    res.json({
      icp_key: icpKey,
      lead_ids: leadIds,
      count: leadIds.length,
    });
  } catch (error: any) {
    logger.error(`Failed to get leads by ICP ${req.params.icpKey}:`, error);
    res.status(500).json({
      error: 'Failed to get leads by ICP',
      details: error.message,
    });
  }
});

/**
 * GET /api/apollo/workflow/strategy-performance/:icpKey
 * Get strategy performance metrics by ICP
 */
router.get('/strategy-performance/:icpKey', async (req: Request, res: Response) => {
  try {
    const { icpKey } = req.params;

    const performance = await apolloWorkflowIntegration.getStrategyPerformanceByICP(icpKey);

    res.json({
      icp_key: icpKey,
      strategies: performance,
    });
  } catch (error: any) {
    logger.error(`Failed to get strategy performance for ${req.params.icpKey}:`, error);
    res.status(500).json({
      error: 'Failed to get strategy performance',
      details: error.message,
    });
  }
});

/**
 * POST /api/apollo/workflow/full-pipeline
 * Execute the full Apollo -> Discovery -> Campaign pipeline
 * This is the "one-click" workflow for non-technical users
 */
router.post('/full-pipeline', async (req: Request, res: Response) => {
  try {
    const {
      icp_preset_key,
      campaign_id,
      max_leads = 50,
      custom_filters,
      strategy_override,
      send_immediately = false,
    } = req.body;

    if (!icp_preset_key || !campaign_id) {
      return res.status(400).json({
        error: 'icp_preset_key and campaign_id are required',
      });
    }

    // Step 1: Discover and import leads
    logger.info(`Starting full pipeline for ICP: ${icp_preset_key}, Campaign: ${campaign_id}`);

    const discoveryResult = await apolloWorkflowIntegration.discoverAndImport({
      icpPresetKey: icp_preset_key,
      customFilters: custom_filters,
      maxLeads: max_leads,
      autoGenerateEmails: false, // We'll do this in the campaign execution step
    });

    if (discoveryResult.leadIds.length === 0) {
      return res.json({
        success: false,
        message: 'No leads discovered or imported',
        discovery: {
          discovered: discoveryResult.discoveredContacts,
          imported: discoveryResult.importedLeads,
          skipped: discoveryResult.skippedDuplicates,
          errors: discoveryResult.errors,
        },
        campaign: null,
      });
    }

    // Step 2: Execute campaign with discovered leads
    const campaignResult = await apolloWorkflowIntegration.executeCampaign({
      campaignId: campaign_id,
      leadIds: discoveryResult.leadIds,
      icpPresetKey: icp_preset_key,
      strategyOverride: strategy_override,
      sendImmediately: send_immediately,
    });

    res.json({
      success: campaignResult.success,
      pipeline_summary: {
        icp_preset: icp_preset_key,
        campaign_id: campaign_id,
        leads_discovered: discoveryResult.discoveredContacts,
        leads_imported: discoveryResult.importedLeads,
        duplicates_skipped: discoveryResult.skippedDuplicates,
        emails_generated: campaignResult.emailsGenerated,
        emails_sent: campaignResult.emailsSent,
        total_errors: discoveryResult.errors.length + campaignResult.errors.length,
      },
      discovery: {
        success: discoveryResult.success,
        lead_ids: discoveryResult.leadIds,
        filters_used: discoveryResult.filtersUsed,
        errors: discoveryResult.errors,
      },
      campaign: {
        success: campaignResult.success,
        lead_results: campaignResult.leadResults,
        errors: campaignResult.errors,
      },
    });
  } catch (error: any) {
    logger.error('Full pipeline execution failed:', error);
    res.status(500).json({
      error: 'Full pipeline execution failed',
      details: error.message,
    });
  }
});

export default router;

/**
 * Register Apollo workflow routes with Express app
 */
export function registerApolloWorkflowRoutes(app: any): void {
  app.use('/api/apollo/workflow', router);
  logger.info('Apollo workflow routes registered at /api/apollo/workflow');
}
