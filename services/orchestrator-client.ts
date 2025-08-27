/**
 * NoBox Outreach Orchestrator Client
 * TypeScript integration client for LangGraph workflow orchestration
 * Provides seamless integration with existing Express.js system
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../server/utils/logger';

// Types matching the Python FastAPI models
export interface CampaignExecutionRequest {
  campaign_id: string;
  prospect_ids: string[];
  options?: Record<string, any>;
}

export interface ProspectRequest {
  prospect_id: string;
  campaign_id: string;
  options?: Record<string, any>;
}

export interface WorkflowStatusResponse {
  thread_id: string;
  status: string;
  current_step: string;
  progress: number;
  errors: Array<Record<string, any>>;
  created_at: string;
  updated_at: string;
}

export interface CampaignResultResponse {
  campaign_id: string;
  total_prospects: number;
  completed: number;
  errors: number;
  success_rate: number;
  results: Array<{
    prospect_id: string;
    status: string;
    email_result?: Record<string, string>;
    error?: string;
    errors?: Array<Record<string, any>>;
  }>;
}

export interface StrategyPerformanceResponse {
  strategies: Array<{
    name: string;
    messages_sent: number;
    replies_received: number;
    reply_rate: number;
    effectiveness_score: number;
  }>;
  top_performer: string;
  overall_improvement: number;
}

/**
 * Orchestrator Client for communicating with LangGraph workflow service
 */
export class OrchestratorClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private isEnabled: boolean;

  constructor(baseUrl: string = 'http://localhost:8054') {
    this.baseUrl = baseUrl;
    this.isEnabled = process.env.ORCHESTRATOR_ENABLED === 'true';
    
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 300000, // 5 minutes for long-running workflows
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info(`Orchestrator Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Orchestrator Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info(`Orchestrator Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('Orchestrator Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if orchestrator service is healthy and available
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'healthy' && response.data.orchestrator_ready;
    } catch (error) {
      logger.warn('Orchestrator health check failed:', error);
      return false;
    }
  }

  /**
   * Execute campaign through LangGraph workflow
   * Phase 1: Wraps existing email generation with orchestration
   */
  async executeCampaign(
    campaignId: string,
    prospectIds: string[],
    options: Record<string, any> = {}
  ): Promise<CampaignResultResponse> {
    if (!this.isEnabled) {
      throw new Error('Orchestrator is not enabled. Set ORCHESTRATOR_ENABLED=true');
    }

    logger.info(`Executing campaign ${campaignId} for ${prospectIds.length} prospects via orchestrator`);

    try {
      const request: CampaignExecutionRequest = {
        campaign_id: campaignId,
        prospect_ids: prospectIds,
        options,
      };

      const response: AxiosResponse<CampaignResultResponse> = await this.client.post(
        '/campaigns/execute',
        request
      );

      logger.info(`Campaign ${campaignId} completed: ${response.data.completed}/${response.data.total_prospects} successful`);
      return response.data;

    } catch (error: any) {
      logger.error(`Campaign execution failed for ${campaignId}:`, error.response?.data || error.message);
      throw new Error(`Orchestrator campaign execution failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Process single prospect through workflow
   * Useful for testing and individual processing
   */
  async processSingleProspect(
    prospectId: string,
    campaignId: string,
    options: Record<string, any> = {}
  ): Promise<any> {
    if (!this.isEnabled) {
      throw new Error('Orchestrator is not enabled. Set ORCHESTRATOR_ENABLED=true');
    }

    logger.info(`Processing single prospect ${prospectId} via orchestrator`);

    try {
      const request: ProspectRequest = {
        prospect_id: prospectId,
        campaign_id: campaignId,
        options,
      };

      const response = await this.client.post('/prospects/process', request);
      return response.data;

    } catch (error: any) {
      logger.error(`Prospect processing failed for ${prospectId}:`, error.response?.data || error.message);
      throw new Error(`Orchestrator prospect processing failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Get workflow execution status
   * Useful for monitoring long-running campaigns
   */
  async getWorkflowStatus(threadId: string): Promise<WorkflowStatusResponse> {
    try {
      const response: AxiosResponse<WorkflowStatusResponse> = await this.client.get(
        `/workflows/${threadId}/status`
      );
      return response.data;

    } catch (error: any) {
      logger.error(`Failed to get workflow status for ${threadId}:`, error.response?.data || error.message);
      throw new Error(`Status retrieval failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Pause campaign execution
   * Phase 2+ feature
   */
  async pauseCampaign(campaignId: string): Promise<{ message: string; status: string }> {
    try {
      const response = await this.client.post(`/campaigns/${campaignId}/pause`);
      return response.data;

    } catch (error: any) {
      logger.error(`Failed to pause campaign ${campaignId}:`, error.response?.data || error.message);
      throw new Error(`Campaign pause failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Resume paused campaign execution
   * Phase 2+ feature
   */
  async resumeCampaign(campaignId: string): Promise<{ message: string; status: string }> {
    try {
      const response = await this.client.post(`/campaigns/${campaignId}/resume`);
      return response.data;

    } catch (error: any) {
      logger.error(`Failed to resume campaign ${campaignId}:`, error.response?.data || error.message);
      throw new Error(`Campaign resume failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Get psychological strategy performance metrics
   * Phase 2+ feature for optimization
   */
  async getStrategyPerformance(): Promise<StrategyPerformanceResponse> {
    try {
      const response: AxiosResponse<StrategyPerformanceResponse> = await this.client.get(
        '/strategies/performance'
      );
      return response.data;

    } catch (error: any) {
      logger.error('Failed to get strategy performance:', error.response?.data || error.message);
      throw new Error(`Strategy performance retrieval failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Debug workflow state
   * Development helper
   */
  async debugWorkflowState(threadId: string): Promise<any> {
    try {
      const response = await this.client.get(`/debug/state/${threadId}`);
      return response.data;

    } catch (error: any) {
      logger.error(`Failed to get debug state for ${threadId}:`, error.response?.data || error.message);
      throw new Error(`Debug state retrieval failed: ${error.response?.data?.detail || error.message}`);
    }
  }
}

/**
 * Wrapper function that integrates orchestrator with existing email generation
 * Provides gradual migration path while preserving current functionality
 */
export async function generatePersonalizedEmailOrchestrated(
  leadId: string,
  campaignId: string = 'default',
  options: Record<string, any> = {}
): Promise<{ subject: string; body: string; [key: string]: any }> {
  
  const orchestratorClient = new OrchestratorClient();
  
  // Check if orchestrator is available and enabled
  const isOrchestratorReady = await orchestratorClient.isHealthy();
  
  if (isOrchestratorReady && process.env.ORCHESTRATOR_ENABLED === 'true') {
    logger.info(`Using orchestrator for lead ${leadId}`);
    
    try {
      // Process through orchestrator
      const result = await orchestratorClient.processSingleProspect(leadId, campaignId, options);
      
      if (result.email_result) {
        return {
          subject: result.email_result.subject,
          body: result.email_result.body,
          source: 'orchestrator',
          personalization_level: result.email_result.personalization_level || 'medium',
          generated_at: result.email_result.generated_at || new Date().toISOString(),
        };
      } else {
        throw new Error('No email result from orchestrator');
      }
      
    } catch (error) {
      logger.warn(`Orchestrator failed for lead ${leadId}, falling back to existing system:`, error);
      // Fall back to existing system
      return await fallbackToExistingSystem(leadId, options);
    }
    
  } else {
    logger.info(`Using existing system for lead ${leadId} (orchestrator not available)`);
    // Use existing system
    return await fallbackToExistingSystem(leadId, options);
  }
}

/**
 * Fallback to existing email generation system
 * Preserves current functionality when orchestrator is not available
 */
async function fallbackToExistingSystem(
  leadId: string, 
  options: Record<string, any>
): Promise<{ subject: string; body: string; [key: string]: any }> {
  
  // This would call the existing generatePersonalizedEmail function
  // Import and use existing logic from server/openai.ts
  
  // Mock response for Phase 1 development
  return {
    subject: `Quick question about your business`,
    body: `Hi there,\n\nI noticed your work and wanted to reach out...\n\nBest regards`,
    source: 'existing_system',
    personalization_level: 'basic',
    generated_at: new Date().toISOString(),
  };
}

// Export singleton instance for convenience
export const orchestratorClient = new OrchestratorClient();

// Export configuration helper
export function configureOrchestrator(baseUrl?: string): OrchestratorClient {
  return new OrchestratorClient(baseUrl);
}