/**
 * Apollo Analytics Routes
 *
 * API endpoints for ICP and strategy performance analytics:
 * - Lead distribution by ICP
 * - Strategy performance metrics
 * - Campaign performance by ICP/strategy
 * - Cost and usage tracking
 * - Time-series performance data
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db';
import {
  leads,
  strategyPerformance,
  campaignWorkflowMetrics,
  messageVariants,
  costTracking,
  workflowStates,
  touchpoints,
  campaigns,
} from '../../shared/schema';
import { eq, sql, and, gte, lte, desc, count } from 'drizzle-orm';
import { ICP_PRESETS, listPresets } from '../config/icp-presets';
import {
  PSYCHOLOGICAL_STRATEGIES,
  ARCHETYPE_PROFILES,
  calculateStrategyEffectiveness,
} from '../config/icp-psychology-map';
import { logger } from '../utils/logger';

const router = Router();

// =============================================================================
// ICP DISTRIBUTION ANALYTICS
// =============================================================================

/**
 * GET /api/apollo/analytics/icp-distribution
 * Get lead distribution by ICP preset
 */
router.get('/icp-distribution', async (req: Request, res: Response) => {
  try {
    // Get lead counts by ICP preset key
    const distribution = await db
      .select({
        icpPresetKey: leads.icpPresetKey,
        archetype: leads.archetype,
        count: sql<number>`count(*)`,
        verifiedEmailCount: sql<number>`sum(case when ${leads.emailVerified} = true then 1 else 0 end)`,
        contactedCount: sql<number>`sum(case when ${leads.status} = 'contacted' then 1 else 0 end)`,
        respondedCount: sql<number>`sum(case when ${leads.status} = 'responded' then 1 else 0 end)`,
        qualifiedCount: sql<number>`sum(case when ${leads.status} = 'qualified' then 1 else 0 end)`,
      })
      .from(leads)
      .where(eq(leads.source, 'apollo'))
      .groupBy(leads.icpPresetKey, leads.archetype);

    // Enrich with preset metadata
    const enrichedDistribution = distribution.map((item) => {
      const preset = item.icpPresetKey ? ICP_PRESETS[item.icpPresetKey] : null;
      const total = Number(item.count) || 0;
      const contacted = Number(item.contactedCount) || 0;
      const responded = Number(item.respondedCount) || 0;
      const qualified = Number(item.qualifiedCount) || 0;

      return {
        icp_key: item.icpPresetKey || 'unassigned',
        archetype: item.archetype || preset?.archetype || 'Unknown',
        preset_name: preset?.name || 'Unassigned',
        total_leads: total,
        verified_emails: Number(item.verifiedEmailCount) || 0,
        contacted: contacted,
        responded: responded,
        qualified: qualified,
        contact_rate: total > 0 ? Math.round((contacted / total) * 100) : 0,
        response_rate: contacted > 0 ? Math.round((responded / contacted) * 100) : 0,
        qualification_rate: responded > 0 ? Math.round((qualified / responded) * 100) : 0,
      };
    });

    // Calculate totals
    const totals = enrichedDistribution.reduce(
      (acc, item) => ({
        total_leads: acc.total_leads + item.total_leads,
        verified_emails: acc.verified_emails + item.verified_emails,
        contacted: acc.contacted + item.contacted,
        responded: acc.responded + item.responded,
        qualified: acc.qualified + item.qualified,
      }),
      { total_leads: 0, verified_emails: 0, contacted: 0, responded: 0, qualified: 0 }
    );

    res.json({
      distribution: enrichedDistribution,
      totals: {
        ...totals,
        overall_contact_rate:
          totals.total_leads > 0
            ? Math.round((totals.contacted / totals.total_leads) * 100)
            : 0,
        overall_response_rate:
          totals.contacted > 0
            ? Math.round((totals.responded / totals.contacted) * 100)
            : 0,
        overall_qualification_rate:
          totals.responded > 0
            ? Math.round((totals.qualified / totals.responded) * 100)
            : 0,
      },
      icp_count: enrichedDistribution.filter((d) => d.icp_key !== 'unassigned').length,
    });
  } catch (error: any) {
    logger.error('Failed to get ICP distribution:', error);
    res.status(500).json({ error: 'Failed to get ICP distribution' });
  }
});

// =============================================================================
// ARCHETYPE ANALYTICS
// =============================================================================

/**
 * GET /api/apollo/analytics/archetype-performance
 * Get performance metrics by archetype
 */
router.get('/archetype-performance', async (req: Request, res: Response) => {
  try {
    // Get lead counts and performance by archetype
    const archetypeStats = await db
      .select({
        archetype: leads.archetype,
        count: sql<number>`count(*)`,
        contacted: sql<number>`sum(case when ${leads.status} = 'contacted' then 1 else 0 end)`,
        responded: sql<number>`sum(case when ${leads.status} = 'responded' then 1 else 0 end)`,
        qualified: sql<number>`sum(case when ${leads.status} = 'qualified' then 1 else 0 end)`,
      })
      .from(leads)
      .where(sql`${leads.archetype} IS NOT NULL`)
      .groupBy(leads.archetype);

    // Enrich with archetype profiles
    const enrichedStats = archetypeStats.map((item) => {
      const profile = item.archetype
        ? ARCHETYPE_PROFILES[item.archetype]
        : null;
      const total = Number(item.count) || 0;
      const contacted = Number(item.contacted) || 0;
      const responded = Number(item.responded) || 0;
      const qualified = Number(item.qualified) || 0;

      return {
        archetype: item.archetype || 'Unknown',
        archetype_id: profile?.id || 'unknown',
        core_characteristics: profile?.core_characteristics || [],
        communication_preferences: profile?.communication_preferences || null,
        total_leads: total,
        contacted,
        responded,
        qualified,
        response_rate: contacted > 0 ? Math.round((responded / contacted) * 100) : 0,
        qualification_rate: responded > 0 ? Math.round((qualified / responded) * 100) : 0,
        // Effectiveness score based on qualification rate
        effectiveness_score:
          contacted > 0
            ? Math.round((qualified / contacted) * 100)
            : 0,
      };
    });

    // Sort by effectiveness
    enrichedStats.sort((a, b) => b.effectiveness_score - a.effectiveness_score);

    res.json({
      archetypes: enrichedStats,
      total_archetypes: enrichedStats.length,
      best_performing: enrichedStats[0] || null,
    });
  } catch (error: any) {
    logger.error('Failed to get archetype performance:', error);
    res.status(500).json({ error: 'Failed to get archetype performance' });
  }
});

// =============================================================================
// STRATEGY PERFORMANCE ANALYTICS
// =============================================================================

/**
 * GET /api/apollo/analytics/strategy-performance
 * Get performance metrics by psychological strategy
 */
router.get('/strategy-performance', async (req: Request, res: Response) => {
  try {
    // Get strategy performance data
    const strategyStats = await db
      .select({
        strategyName: strategyPerformance.strategyName,
        messagesSent: sql<number>`sum(${strategyPerformance.messagesSent})`,
        repliesReceived: sql<number>`sum(${strategyPerformance.repliesReceived})`,
        meetingsBooked: sql<number>`sum(${strategyPerformance.meetingsBooked})`,
      })
      .from(strategyPerformance)
      .groupBy(strategyPerformance.strategyName);

    // Define type for enriched stats
    interface EnrichedStrategyStats {
      strategy_id: string;
      strategy_name: string;
      description: string;
      core_mechanism: string;
      messages_sent: number;
      replies_received: number;
      meetings_booked: number;
      reply_rate: number;
      meeting_rate: number;
      base_effectiveness_multiplier: number;
      calculated_effectiveness: number;
    }

    // Enrich with strategy details and calculate effectiveness
    const enrichedStats: EnrichedStrategyStats[] = strategyStats.map((item) => {
      const strategyName = item.strategyName as string || 'unknown';
      const strategy = strategyName && strategyName !== 'unknown'
        ? PSYCHOLOGICAL_STRATEGIES[strategyName]
        : null;
      const sent = Number(item.messagesSent) || 0;
      const replies = Number(item.repliesReceived) || 0;
      const meetings = Number(item.meetingsBooked) || 0;

      const replyRate = sent > 0 ? replies / sent : 0;
      const meetingRate = sent > 0 ? meetings / sent : 0;

      return {
        strategy_id: strategyName,
        strategy_name: strategy?.name || strategyName || 'Unknown',
        description: strategy?.description || '',
        core_mechanism: strategy?.core_mechanism || '',
        messages_sent: sent,
        replies_received: replies,
        meetings_booked: meetings,
        reply_rate: Math.round(replyRate * 100),
        meeting_rate: Math.round(meetingRate * 100),
        base_effectiveness_multiplier: strategy?.effectiveness_multiplier || 1.0,
        calculated_effectiveness: calculateStrategyEffectiveness({
          strategy_id: strategyName,
          emails_sent: sent,
          opens: Math.round(sent * 0.4), // Estimate
          replies,
          positive_replies: Math.round(replies * 0.7), // Estimate
          open_rate: 0.4,
          reply_rate: replyRate,
          positive_reply_rate: replyRate * 0.7,
        }),
      };
    });

    // Add strategies with no data yet
    const existingStrategies = new Set(enrichedStats.map((s) => s.strategy_id));
    for (const [stratId, strategy] of Object.entries(PSYCHOLOGICAL_STRATEGIES)) {
      if (!existingStrategies.has(stratId)) {
        enrichedStats.push({
          strategy_id: stratId,
          strategy_name: strategy.name,
          description: strategy.description,
          core_mechanism: strategy.core_mechanism,
          messages_sent: 0,
          replies_received: 0,
          meetings_booked: 0,
          reply_rate: 0,
          meeting_rate: 0,
          base_effectiveness_multiplier: strategy.effectiveness_multiplier,
          calculated_effectiveness: 0,
        });
      }
    }

    // Sort by calculated effectiveness
    enrichedStats.sort((a, b) => b.calculated_effectiveness - a.calculated_effectiveness);

    res.json({
      strategies: enrichedStats,
      total_strategies: enrichedStats.length,
      best_performing: enrichedStats.find((s) => s.messages_sent > 0) || null,
      summary: {
        total_messages: enrichedStats.reduce((acc, s) => acc + s.messages_sent, 0),
        total_replies: enrichedStats.reduce((acc, s) => acc + s.replies_received, 0),
        total_meetings: enrichedStats.reduce((acc, s) => acc + s.meetings_booked, 0),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get strategy performance:', error);
    res.status(500).json({ error: 'Failed to get strategy performance' });
  }
});

// =============================================================================
// CAMPAIGN ANALYTICS BY ICP
// =============================================================================

/**
 * GET /api/apollo/analytics/campaign-by-icp
 * Get campaign performance segmented by ICP
 */
router.get('/campaign-by-icp', async (req: Request, res: Response) => {
  try {
    // Get workflow states with lead ICP info
    const campaignIcpStats = await db
      .select({
        campaignId: workflowStates.campaignId,
        icpPresetKey: leads.icpPresetKey,
        archetype: leads.archetype,
        totalProspects: sql<number>`count(distinct ${workflowStates.leadId})`,
        completed: sql<number>`sum(case when ${workflowStates.workflowStatus} = 'completed' then 1 else 0 end)`,
        inProgress: sql<number>`sum(case when ${workflowStates.workflowStatus} = 'running' then 1 else 0 end)`,
        errors: sql<number>`sum(case when ${workflowStates.workflowStatus} = 'error' then 1 else 0 end)`,
      })
      .from(workflowStates)
      .innerJoin(leads, eq(workflowStates.leadId, leads.id))
      .groupBy(workflowStates.campaignId, leads.icpPresetKey, leads.archetype);

    // Get campaign names
    const campaignIds = Array.from(new Set(campaignIcpStats.map((s) => s.campaignId)));
    const campaignData =
      campaignIds.length > 0
        ? await db
            .select({ id: campaigns.id, name: campaigns.name })
            .from(campaigns)
            .where(sql`${campaigns.id} IN ${campaignIds}`)
        : [];
    const campaignNameMap = new Map(campaignData.map((c) => [c.id, c.name]));

    // Enrich stats
    const enrichedStats = campaignIcpStats.map((item) => {
      const preset = item.icpPresetKey ? ICP_PRESETS[item.icpPresetKey] : null;
      const total = Number(item.totalProspects) || 0;
      const completed = Number(item.completed) || 0;

      return {
        campaign_id: item.campaignId,
        campaign_name: campaignNameMap.get(item.campaignId) || `Campaign ${item.campaignId}`,
        icp_key: item.icpPresetKey || 'unassigned',
        icp_name: preset?.name || 'Unassigned',
        archetype: item.archetype || preset?.archetype || 'Unknown',
        total_prospects: total,
        completed,
        in_progress: Number(item.inProgress) || 0,
        errors: Number(item.errors) || 0,
        completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

    // Group by campaign
    const byCampaign = new Map<number, typeof enrichedStats>();
    for (const stat of enrichedStats) {
      const existing = byCampaign.get(stat.campaign_id) || [];
      existing.push(stat);
      byCampaign.set(stat.campaign_id, existing);
    }

    const campaignBreakdowns = Array.from(byCampaign.entries()).map(
      ([campaignId, icpStats]) => ({
        campaign_id: campaignId,
        campaign_name: icpStats[0]?.campaign_name || `Campaign ${campaignId}`,
        icp_breakdown: icpStats,
        totals: {
          total_prospects: icpStats.reduce((acc, s) => acc + s.total_prospects, 0),
          completed: icpStats.reduce((acc, s) => acc + s.completed, 0),
          in_progress: icpStats.reduce((acc, s) => acc + s.in_progress, 0),
          errors: icpStats.reduce((acc, s) => acc + s.errors, 0),
        },
      })
    );

    res.json({
      campaigns: campaignBreakdowns,
      total_campaigns: campaignBreakdowns.length,
    });
  } catch (error: any) {
    logger.error('Failed to get campaign by ICP:', error);
    res.status(500).json({ error: 'Failed to get campaign by ICP analytics' });
  }
});

// =============================================================================
// COST ANALYTICS
// =============================================================================

/**
 * GET /api/apollo/analytics/cost-trends
 * Get cost trends over time
 */
router.get('/cost-trends', async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = Math.min(Number(days) || 30, 90);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Get daily cost aggregation
    const dailyCosts = await db
      .select({
        date: sql<string>`date(${costTracking.createdAt})`,
        service: costTracking.service,
        operation: costTracking.operation,
        totalCostCents: sql<number>`sum(${costTracking.costUsd})`,
        totalCredits: sql<number>`sum(${costTracking.creditsUsed})`,
        requestCount: sql<number>`count(*)`,
      })
      .from(costTracking)
      .where(gte(costTracking.createdAt, startDate))
      .groupBy(
        sql`date(${costTracking.createdAt})`,
        costTracking.service,
        costTracking.operation
      )
      .orderBy(sql`date(${costTracking.createdAt})`);

    // Transform to daily totals
    const dailyTotals = new Map<string, {
      date: string;
      total_cost_usd: number;
      total_credits: number;
      by_operation: Record<string, { cost_usd: number; credits: number; requests: number }>;
    }>();

    for (const row of dailyCosts) {
      const dateStr = row.date;
      const costUsd = (Number(row.totalCostCents) || 0) / 100;
      const credits = Number(row.totalCredits) || 0;
      const requests = Number(row.requestCount) || 0;
      const operation = row.operation || 'unknown';

      let dayData = dailyTotals.get(dateStr);
      if (!dayData) {
        dayData = {
          date: dateStr,
          total_cost_usd: 0,
          total_credits: 0,
          by_operation: {},
        };
        dailyTotals.set(dateStr, dayData);
      }

      dayData.total_cost_usd += costUsd;
      dayData.total_credits += credits;
      dayData.by_operation[operation] = {
        cost_usd: costUsd,
        credits,
        requests,
      };
    }

    const trends = Array.from(dailyTotals.values());

    // Calculate summary
    const totalCost = trends.reduce((acc, d) => acc + d.total_cost_usd, 0);
    const totalCredits = trends.reduce((acc, d) => acc + d.total_credits, 0);
    const avgDailyCost = trends.length > 0 ? totalCost / trends.length : 0;

    res.json({
      trends,
      summary: {
        period_days: daysNum,
        total_cost_usd: Math.round(totalCost * 100) / 100,
        total_credits: totalCredits,
        avg_daily_cost_usd: Math.round(avgDailyCost * 100) / 100,
        data_points: trends.length,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get cost trends:', error);
    res.status(500).json({ error: 'Failed to get cost trends' });
  }
});

// =============================================================================
// DASHBOARD SUMMARY
// =============================================================================

/**
 * GET /api/apollo/analytics/dashboard-summary
 * Get comprehensive dashboard summary
 */
router.get('/dashboard-summary', async (req: Request, res: Response) => {
  try {
    // Get lead counts
    const leadCounts = await db
      .select({
        total: sql<number>`count(*)`,
        apollo: sql<number>`sum(case when ${leads.source} = 'apollo' then 1 else 0 end)`,
        withIcp: sql<number>`sum(case when ${leads.icpPresetKey} IS NOT NULL then 1 else 0 end)`,
        verified: sql<number>`sum(case when ${leads.emailVerified} = true then 1 else 0 end)`,
        contacted: sql<number>`sum(case when ${leads.status} = 'contacted' then 1 else 0 end)`,
        responded: sql<number>`sum(case when ${leads.status} = 'responded' then 1 else 0 end)`,
      })
      .from(leads);

    // Get strategy summary
    const strategySummary = await db
      .select({
        totalMessages: sql<number>`sum(${strategyPerformance.messagesSent})`,
        totalReplies: sql<number>`sum(${strategyPerformance.repliesReceived})`,
        totalMeetings: sql<number>`sum(${strategyPerformance.meetingsBooked})`,
      })
      .from(strategyPerformance);

    // Get monthly cost
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyCost = await db
      .select({
        totalCostCents: sql<number>`sum(${costTracking.costUsd})`,
      })
      .from(costTracking)
      .where(
        and(
          eq(costTracking.service, 'apollo'),
          gte(costTracking.createdAt, monthStart)
        )
      );

    // Get ICP presets info
    const presetsResult = listPresets();
    const presetsArray = Object.entries(presetsResult.presets).map(([key, preset]) => ({
      key,
      name: preset.name,
      archetype: preset.archetype,
    }));

    const leadData = leadCounts[0] || {};
    const stratData = strategySummary[0] || {};

    res.json({
      leads: {
        total: Number(leadData.total) || 0,
        from_apollo: Number(leadData.apollo) || 0,
        with_icp: Number(leadData.withIcp) || 0,
        verified_emails: Number(leadData.verified) || 0,
        contacted: Number(leadData.contacted) || 0,
        responded: Number(leadData.responded) || 0,
      },
      outreach: {
        total_messages: Number(stratData.totalMessages) || 0,
        total_replies: Number(stratData.totalReplies) || 0,
        total_meetings: Number(stratData.totalMeetings) || 0,
        reply_rate:
          Number(stratData.totalMessages) > 0
            ? Math.round(
                (Number(stratData.totalReplies) / Number(stratData.totalMessages)) * 100
              )
            : 0,
      },
      cost: {
        monthly_spend_usd: (Number(monthlyCost[0]?.totalCostCents) || 0) / 100,
        monthly_budget_usd: 500,
      },
      icp_presets: {
        total: presetsResult.total_presets,
        presets: presetsArray,
      },
      strategies: {
        total: Object.keys(PSYCHOLOGICAL_STRATEGIES).length,
        names: Object.values(PSYCHOLOGICAL_STRATEGIES).map((s) => ({
          id: s.id,
          name: s.name,
        })),
      },
      archetypes: {
        total: Object.keys(ARCHETYPE_PROFILES).length,
        names: Object.values(ARCHETYPE_PROFILES).map((a) => a.name),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get dashboard summary:', error);
    res.status(500).json({ error: 'Failed to get dashboard summary' });
  }
});

// =============================================================================
// EXPORT
// =============================================================================

export default router;

/**
 * Register Apollo Analytics routes with Express app
 */
export function registerApolloAnalyticsRoutes(app: any): void {
  app.use('/api/apollo/analytics', router);
  logger.info('Apollo Analytics routes registered at /api/apollo/analytics');
}
