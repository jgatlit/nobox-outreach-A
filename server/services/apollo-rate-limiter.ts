/**
 * Apollo API Rate Limiter and Cost Tracker
 *
 * Implements:
 * - Rate limiting to stay within Apollo API quotas
 * - Cost tracking for budget management
 * - Automatic backoff on rate limit hits
 * - Request queueing for burst protection
 */

import { db } from '../../db';
import { apiRateLimits, costTracking } from '../../shared/schema';
import { eq, sql, and, gte } from 'drizzle-orm';
import { logger } from '../utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Apollo API rate limits (per minute)
 * These are conservative defaults - adjust based on your plan
 */
export const APOLLO_RATE_LIMITS = {
  search: {
    requests_per_minute: 50,
    burst_limit: 10,
    cost_per_request: 0.01,
    credits_per_request: 1,
  },
  enrich: {
    requests_per_minute: 100,
    burst_limit: 20,
    cost_per_request: 0.03,
    credits_per_request: 3,
  },
  lists: {
    requests_per_minute: 100,
    burst_limit: 25,
    cost_per_request: 0.001,
    credits_per_request: 1,
  },
  contacts: {
    requests_per_minute: 100,
    burst_limit: 25,
    cost_per_request: 0.005,
    credits_per_request: 1,
  },
} as const;

type ApiOperation = keyof typeof APOLLO_RATE_LIMITS;

/**
 * Monthly budget caps (USD)
 */
export const BUDGET_CAPS = {
  monthly_total: 500,
  search_monthly: 200,
  enrich_monthly: 250,
  warning_threshold: 0.8, // Warn at 80%
  hard_stop_threshold: 0.95, // Stop at 95%
};

// =============================================================================
// IN-MEMORY RATE LIMITER
// =============================================================================

interface RequestWindow {
  timestamps: number[];
  lastReset: number;
}

class RateLimiterWindow {
  private windows: Map<string, RequestWindow> = new Map();
  private windowSize = 60000; // 1 minute in ms

  canMakeRequest(operation: ApiOperation): boolean {
    const now = Date.now();
    const config = APOLLO_RATE_LIMITS[operation];
    const key = `apollo:${operation}`;

    let window = this.windows.get(key);

    if (!window || now - window.lastReset > this.windowSize) {
      window = { timestamps: [], lastReset: now };
      this.windows.set(key, window);
    }

    // Clean old timestamps
    window.timestamps = window.timestamps.filter(
      (ts) => now - ts < this.windowSize
    );

    // Check if under limit
    if (window.timestamps.length >= config.requests_per_minute) {
      return false;
    }

    return true;
  }

  recordRequest(operation: ApiOperation): void {
    const now = Date.now();
    const key = `apollo:${operation}`;

    let window = this.windows.get(key);
    if (!window) {
      window = { timestamps: [], lastReset: now };
      this.windows.set(key, window);
    }

    window.timestamps.push(now);
  }

  getWaitTime(operation: ApiOperation): number {
    const now = Date.now();
    const key = `apollo:${operation}`;
    const window = this.windows.get(key);

    if (!window || window.timestamps.length === 0) {
      return 0;
    }

    const oldestTimestamp = Math.min(...window.timestamps);
    const timeUntilReset = this.windowSize - (now - oldestTimestamp);

    return Math.max(0, timeUntilReset);
  }

  getCurrentUsage(operation: ApiOperation): { used: number; limit: number; resetIn: number } {
    const config = APOLLO_RATE_LIMITS[operation];
    const key = `apollo:${operation}`;
    const window = this.windows.get(key);

    if (!window) {
      return { used: 0, limit: config.requests_per_minute, resetIn: 0 };
    }

    const now = Date.now();
    const validTimestamps = window.timestamps.filter(
      (ts) => now - ts < this.windowSize
    );

    return {
      used: validTimestamps.length,
      limit: config.requests_per_minute,
      resetIn: validTimestamps.length > 0
        ? this.windowSize - (now - Math.min(...validTimestamps))
        : 0,
    };
  }
}

// =============================================================================
// RATE LIMITER SERVICE
// =============================================================================

export class ApolloRateLimiter {
  private windowLimiter = new RateLimiterWindow();
  private requestQueue: Map<ApiOperation, Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timestamp: number;
  }>> = new Map();
  private isProcessingQueue = false;

  /**
   * Check if we can make a request, waiting if necessary
   */
  async acquirePermit(
    operation: ApiOperation,
    options: { maxWaitMs?: number; skipBudgetCheck?: boolean } = {}
  ): Promise<void> {
    const { maxWaitMs = 30000, skipBudgetCheck = false } = options;

    // Check budget first
    if (!skipBudgetCheck) {
      const budgetStatus = await this.checkBudget(operation);
      if (budgetStatus.exceeded) {
        throw new Error(
          `Apollo API budget exceeded for ${operation}. ` +
          `Current spend: $${budgetStatus.currentSpend.toFixed(2)} / $${budgetStatus.limit.toFixed(2)}`
        );
      }
      if (budgetStatus.warning) {
        logger.warn(
          `Apollo API budget warning: ${operation} at ${(budgetStatus.percentUsed * 100).toFixed(1)}% of limit`
        );
      }
    }

    // Check rate limit
    if (this.windowLimiter.canMakeRequest(operation)) {
      this.windowLimiter.recordRequest(operation);
      return;
    }

    // Queue the request
    const waitTime = this.windowLimiter.getWaitTime(operation);
    if (waitTime > maxWaitMs) {
      throw new Error(
        `Rate limit exceeded for ${operation}. Would need to wait ${waitTime}ms (max: ${maxWaitMs}ms)`
      );
    }

    return new Promise((resolve, reject) => {
      if (!this.requestQueue.has(operation)) {
        this.requestQueue.set(operation, []);
      }

      this.requestQueue.get(operation)!.push({
        resolve: () => {
          this.windowLimiter.recordRequest(operation);
          resolve();
        },
        reject,
        timestamp: Date.now(),
      });

      // Start processing queue if not already
      if (!this.isProcessingQueue) {
        this.processQueue();
      }

      // Set timeout to reject if waiting too long
      setTimeout(() => {
        const queue = this.requestQueue.get(operation);
        if (queue) {
          const index = queue.findIndex((item) => item.resolve === resolve);
          if (index !== -1) {
            queue.splice(index, 1);
            reject(new Error(`Request timed out after ${maxWaitMs}ms waiting for rate limit`));
          }
        }
      }, maxWaitMs);
    });
  }

  private async processQueue(): Promise<void> {
    this.isProcessingQueue = true;

    const checkAndProcess = async () => {
      let hasWork = false;

      for (const operation of Object.keys(APOLLO_RATE_LIMITS) as ApiOperation[]) {
        const queue = this.requestQueue.get(operation);
        if (!queue || queue.length === 0) continue;
        hasWork = true;

        if (this.windowLimiter.canMakeRequest(operation)) {
          const item = queue.shift();
          if (item) {
            item.resolve();
          }
        }
      }

      if (hasWork) {
        // Check again after a short delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        await checkAndProcess();
      } else {
        this.isProcessingQueue = false;
      }
    };

    await checkAndProcess();
  }

  /**
   * Record cost for tracking
   */
  async recordCost(
    operation: ApiOperation,
    requestCount: number = 1,
    customCost?: number
  ): Promise<void> {
    const config = APOLLO_RATE_LIMITS[operation];
    const costCents = customCost !== undefined
      ? Math.round(customCost * 100)
      : Math.round(config.cost_per_request * requestCount * 100);
    const credits = config.credits_per_request * requestCount;

    try {
      await db.insert(costTracking).values({
        service: 'apollo',
        operation,
        creditsUsed: credits,
        costUsd: costCents, // Stored in cents
      });
    } catch (error) {
      logger.error('Failed to record Apollo cost:', error);
    }
  }

  /**
   * Check budget status
   */
  async checkBudget(operation?: ApiOperation): Promise<{
    exceeded: boolean;
    warning: boolean;
    currentSpend: number;
    limit: number;
    percentUsed: number;
  }> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
      // Get total monthly spend (costUsd is in cents)
      const result = await db
        .select({
          totalCostCents: sql<number>`COALESCE(SUM(${costTracking.costUsd}), 0)`,
        })
        .from(costTracking)
        .where(
          and(
            eq(costTracking.service, 'apollo'),
            gte(costTracking.createdAt, monthStart)
          )
        );

      const currentSpendCents = Number(result[0]?.totalCostCents) || 0;
      const currentSpend = currentSpendCents / 100; // Convert to dollars
      const limit = BUDGET_CAPS.monthly_total;
      const percentUsed = currentSpend / limit;

      return {
        exceeded: percentUsed >= BUDGET_CAPS.hard_stop_threshold,
        warning: percentUsed >= BUDGET_CAPS.warning_threshold,
        currentSpend,
        limit,
        percentUsed,
      };
    } catch (error) {
      logger.error('Failed to check Apollo budget:', error);
      // Return safe defaults on error
      return {
        exceeded: false,
        warning: true,
        currentSpend: 0,
        limit: BUDGET_CAPS.monthly_total,
        percentUsed: 0,
      };
    }
  }

  /**
   * Get detailed cost breakdown
   */
  async getCostBreakdown(): Promise<{
    total: number;
    by_operation: Record<string, { count: number; cost: number; credits: number }>;
    period: { start: Date; end: Date };
  }> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    try {
      const result = await db
        .select({
          operation: costTracking.operation,
          totalCount: sql<number>`COUNT(*)`,
          totalCostCents: sql<number>`SUM(${costTracking.costUsd})`,
          totalCredits: sql<number>`SUM(${costTracking.creditsUsed})`,
        })
        .from(costTracking)
        .where(
          and(
            eq(costTracking.service, 'apollo'),
            gte(costTracking.createdAt, monthStart)
          )
        )
        .groupBy(costTracking.operation);

      const byOperation: Record<string, { count: number; cost: number; credits: number }> = {};
      let total = 0;

      for (const row of result) {
        const op = row.operation || 'unknown';
        const costDollars = (Number(row.totalCostCents) || 0) / 100;
        byOperation[op] = {
          count: Number(row.totalCount) || 0,
          cost: costDollars,
          credits: Number(row.totalCredits) || 0,
        };
        total += costDollars;
      }

      return {
        total,
        by_operation: byOperation,
        period: { start: monthStart, end: monthEnd },
      };
    } catch (error) {
      logger.error('Failed to get cost breakdown:', error);
      return {
        total: 0,
        by_operation: {},
        period: { start: monthStart, end: new Date() },
      };
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): Record<ApiOperation, { used: number; limit: number; resetIn: number }> {
    const status: Record<string, { used: number; limit: number; resetIn: number }> = {};

    for (const operation of Object.keys(APOLLO_RATE_LIMITS) as ApiOperation[]) {
      status[operation] = this.windowLimiter.getCurrentUsage(operation);
    }

    return status as Record<ApiOperation, { used: number; limit: number; resetIn: number }>;
  }

  /**
   * Persist rate limit stats to database
   */
  async persistRateLimitStats(): Promise<void> {
    const status = this.getRateLimitStatus();
    const now = new Date();

    try {
      for (const [operation, stats] of Object.entries(status)) {
        // Check if record exists
        const existing = await db
          .select()
          .from(apiRateLimits)
          .where(
            and(
              eq(apiRateLimits.service, 'apollo'),
              eq(apiRateLimits.endpoint, operation)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing
          await db
            .update(apiRateLimits)
            .set({
              limitPerMinute: stats.limit,
              currentMinuteCount: stats.used,
              minuteResetAt: new Date(now.getTime() + stats.resetIn),
              updatedAt: now,
            })
            .where(
              and(
                eq(apiRateLimits.service, 'apollo'),
                eq(apiRateLimits.endpoint, operation)
              )
            );
        } else {
          // Insert new
          await db.insert(apiRateLimits).values({
            service: 'apollo',
            endpoint: operation,
            limitPerMinute: stats.limit,
            currentMinuteCount: stats.used,
            minuteResetAt: new Date(now.getTime() + stats.resetIn),
          });
        }
      }
    } catch (error) {
      logger.error('Failed to persist rate limit stats:', error);
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const apolloRateLimiter = new ApolloRateLimiter();

// =============================================================================
// MIDDLEWARE WRAPPER
// =============================================================================

/**
 * Wrap an Apollo API call with rate limiting and cost tracking
 */
export async function withRateLimiting<T>(
  operation: ApiOperation,
  apiCall: () => Promise<T>,
  options: { maxWaitMs?: number; requestCount?: number } = {}
): Promise<T> {
  const { maxWaitMs = 30000, requestCount = 1 } = options;

  // Acquire permit (waits if rate limited)
  await apolloRateLimiter.acquirePermit(operation, { maxWaitMs });

  try {
    // Execute the API call
    const result = await apiCall();

    // Record cost on success
    await apolloRateLimiter.recordCost(operation, requestCount);

    return result;
  } catch (error: any) {
    // Check if it's a rate limit error from Apollo
    if (error.response?.status === 429) {
      logger.warn(`Apollo API returned 429 for ${operation}, implementing backoff`);
      // Wait and retry once
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return apiCall();
    }
    throw error;
  }
}

export default apolloRateLimiter;
