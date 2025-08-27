/**
 * Orchestrator Integration Routes
 * Demonstrates gradual migration to LangGraph workflow orchestration
 * Phase 1: Zero-regression wrapper around existing functionality
 */

import { Router } from 'express';
import { 
  OrchestratorClient,
  generatePersonalizedEmailOrchestrated,
  orchestratorClient 
} from '../../services/orchestrator-client';
import { db } from '../../db';
import { leads, campaigns } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/orchestrator/health
 * Check orchestrator service health
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await orchestratorClient.isHealthy();
    
    res.json({
      orchestrator_available: isHealthy,
      orchestrator_enabled: process.env.ORCHESTRATOR_ENABLED === 'true',
      service_url: process.env.ORCHESTRATOR_URL || 'http://localhost:8054',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Orchestrator health check failed:', error);
    res.status(500).json({
      error: 'Health check failed',
      orchestrator_available: false,
      orchestrator_enabled: false
    });
  }
});

/**
 * POST /api/orchestrator/email/generate
 * Generate personalized email via orchestrator (with fallback)
 * Phase 1: Demonstrates seamless integration with existing system
 */
router.post('/email/generate', async (req, res) => {
  try {
    const { leadId, campaignId, options = {} } = req.body;

    if (!leadId) {
      return res.status(400).json({ error: 'leadId is required' });
    }

    // Verify lead exists
    const leadData = await db.select().from(leads).where(eq(leads.id, parseInt(leadId))).limit(1);
    if (!leadData.length) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Generate email via orchestrator (with automatic fallback)
    const emailResult = await generatePersonalizedEmailOrchestrated(
      leadId,
      campaignId || 'default',
      {
        ...options,
        prospect_data: leadData[0], // Pass existing lead data
        integration_mode: 'gradual_migration' // Phase 1 flag
      }
    );

    logger.info(`Email generated for lead ${leadId} via ${emailResult.source}`);

    res.json({
      success: true,
      lead_id: leadId,
      campaign_id: campaignId,
      email: {
        subject: emailResult.subject,
        body: emailResult.body
      },
      metadata: {
        source: emailResult.source,
        personalization_level: emailResult.personalization_level,
        generated_at: emailResult.generated_at
      }
    });

  } catch (error) {
    logger.error('Email generation via orchestrator failed:', error);
    res.status(500).json({
      error: 'Email generation failed',
      details: error.message
    });
  }
});

/**
 * POST /api/orchestrator/campaigns/execute
 * Execute campaign via orchestrator
 * Phase 1: Wrapper around existing campaign functionality
 */
router.post('/campaigns/execute', async (req, res) => {
  try {
    const { campaignId, prospectIds, options = {} } = req.body;

    if (!campaignId || !prospectIds || !Array.isArray(prospectIds)) {
      return res.status(400).json({ 
        error: 'campaignId and prospectIds array are required' 
      });
    }

    // Check if orchestrator is enabled and healthy
    const isOrchestratorReady = await orchestratorClient.isHealthy();

    if (isOrchestratorReady && process.env.ORCHESTRATOR_ENABLED === 'true') {
      logger.info(`Executing campaign ${campaignId} via orchestrator for ${prospectIds.length} prospects`);

      // Execute via orchestrator
      const result = await orchestratorClient.executeCampaign(
        campaignId,
        prospectIds.map(id => id.toString()),
        options
      );

      res.json({
        success: true,
        source: 'orchestrator',
        campaign_id: result.campaign_id,
        results: {
          total_prospects: result.total_prospects,
          completed: result.completed,
          errors: result.errors,
          success_rate: result.success_rate
        },
        prospect_results: result.results
      });

    } else {
      logger.info(`Executing campaign ${campaignId} via existing system (orchestrator not available)`);

      // Fallback to existing system logic
      const results = [];
      for (const prospectId of prospectIds) {
        try {
          // This would call existing campaign execution logic
          // For Phase 1, we'll simulate the existing process
          const emailResult = await generatePersonalizedEmailOrchestrated(
            prospectId.toString(),
            campaignId,
            options
          );

          results.push({
            prospect_id: prospectId.toString(),
            status: 'completed',
            email_result: emailResult
          });

        } catch (error) {
          results.push({
            prospect_id: prospectId.toString(),
            status: 'error',
            error: error.message
          });
        }
      }

      const completed = results.filter(r => r.status === 'completed').length;
      const errors = results.filter(r => r.status === 'error').length;

      res.json({
        success: true,
        source: 'existing_system',
        campaign_id: campaignId,
        results: {
          total_prospects: prospectIds.length,
          completed,
          errors,
          success_rate: completed / prospectIds.length
        },
        prospect_results: results
      });
    }

  } catch (error) {
    logger.error('Campaign execution failed:', error);
    res.status(500).json({
      error: 'Campaign execution failed',
      details: error.message
    });
  }
});

/**
 * GET /api/orchestrator/workflows/:threadId/status
 * Get workflow execution status
 * Phase 1: Basic status monitoring
 */
router.get('/workflows/:threadId/status', async (req, res) => {
  try {
    const { threadId } = req.params;

    if (!threadId) {
      return res.status(400).json({ error: 'threadId is required' });
    }

    const status = await orchestratorClient.getWorkflowStatus(threadId);

    res.json({
      success: true,
      thread_id: threadId,
      status: status
    });

  } catch (error) {
    logger.error(`Failed to get workflow status for ${req.params.threadId}:`, error);
    res.status(500).json({
      error: 'Status retrieval failed',
      details: error.message
    });
  }
});

/**
 * GET /api/orchestrator/strategies/performance
 * Get psychological strategy performance metrics
 * Phase 2+ feature preview
 */
router.get('/strategies/performance', async (req, res) => {
  try {
    const performance = await orchestratorClient.getStrategyPerformance();

    res.json({
      success: true,
      performance: performance,
      note: "Phase 2+ feature - psychological strategy optimization"
    });

  } catch (error) {
    logger.error('Failed to get strategy performance:', error);
    res.status(500).json({
      error: 'Strategy performance retrieval failed',
      details: error.message
    });
  }
});

/**
 * POST /api/orchestrator/debug/test-integration
 * Test orchestrator integration
 * Development helper endpoint
 */
router.post('/debug/test-integration', async (req, res) => {
  try {
    const { testType = 'health' } = req.body;

    const results: any = {
      timestamp: new Date().toISOString(),
      orchestrator_enabled: process.env.ORCHESTRATOR_ENABLED === 'true',
      service_url: process.env.ORCHESTRATOR_URL || 'http://localhost:8054'
    };

    // Health check
    results.health_check = await orchestratorClient.isHealthy();

    if (testType === 'full' && results.health_check) {
      // Test single prospect processing
      try {
        const testResult = await orchestratorClient.processSingleProspect(
          'test_prospect_1',
          'test_campaign_1',
          { test_mode: true }
        );
        results.prospect_test = { success: true, result: testResult };
      } catch (error) {
        results.prospect_test = { success: false, error: error.message };
      }

      // Test strategy performance
      try {
        const strategyPerf = await orchestratorClient.getStrategyPerformance();
        results.strategy_performance = { success: true, result: strategyPerf };
      } catch (error) {
        results.strategy_performance = { success: false, error: error.message };
      }
    }

    res.json({
      success: true,
      integration_test_results: results
    });

  } catch (error) {
    logger.error('Integration test failed:', error);
    res.status(500).json({
      error: 'Integration test failed',
      details: error.message
    });
  }
});

export default router;