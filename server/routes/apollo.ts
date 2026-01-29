/**
 * Apollo.io Integration Routes
 *
 * API endpoints for:
 * - Lead search and discovery
 * - List management (create, sync, update)
 * - ICP preset operations
 * - Filter building and validation
 * - Psychology strategy selection
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { leads, apolloListSync, savedSearches } from '../../shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { ApolloService } from '../services/apollo/apollo-service';
import { ApolloSearchFilters, ApolloSearchMode } from '../services/apollo/apollo-types';
import {
  ICP_PRESETS,
  listPresets,
  getPreset,
  getFiltersForPreset,
  getPresetMetadata,
  validatePresetFilters,
  getStrategiesForICP,
  getPainTriggers,
} from '../config/icp-presets';
import {
  PSYCHOLOGICAL_STRATEGIES,
  ARCHETYPE_PROFILES,
  selectStrategiesForICP,
  generateEmailPrompt,
  getApplicableStrategies,
  listStrategies,
  getObjectionPatterns,
  getOptimalCTAs,
} from '../config/icp-psychology-map';
import { logger } from '../utils/logger';

const router = Router();

// Initialize Apollo service
const apolloService = new ApolloService(process.env.APOLLO_API_KEY || '');

// =============================================================================
// HEALTH & STATUS
// =============================================================================

/**
 * GET /api/apollo/health
 * Check Apollo service health and configuration
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const hasApiKey = !!process.env.APOLLO_API_KEY;
    const apiKeyPrefix = hasApiKey
      ? `${process.env.APOLLO_API_KEY?.substring(0, 8)}...`
      : 'not configured';

    res.json({
      status: hasApiKey ? 'configured' : 'not_configured',
      api_key_prefix: apiKeyPrefix,
      list_prefix: 'NoboxOutreach-',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Apollo health check failed:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});

// =============================================================================
// ICP PRESET ENDPOINTS
// =============================================================================

/**
 * GET /api/apollo/presets
 * List all available ICP presets
 */
router.get('/presets', async (req: Request, res: Response) => {
  try {
    const presets = listPresets();
    res.json(presets);
  } catch (error: any) {
    logger.error('Failed to list presets:', error);
    res.status(500).json({ error: 'Failed to list presets' });
  }
});

/**
 * GET /api/apollo/presets/:presetKey
 * Get detailed preset information including filters and strategies
 */
router.get('/presets/:presetKey', async (req: Request, res: Response) => {
  try {
    const { presetKey } = req.params;
    const preset = getPreset(presetKey);

    if (!preset) {
      return res.status(404).json({ error: `Preset '${presetKey}' not found` });
    }

    // Get additional context
    const metadata = getPresetMetadata(presetKey);
    const strategies = getStrategiesForICP(presetKey);
    const painTriggers = getPainTriggers(presetKey);
    const validation = validatePresetFilters(presetKey);
    const psychologyMapping = selectStrategiesForICP(presetKey);

    res.json({
      preset,
      metadata,
      strategies,
      pain_triggers: painTriggers,
      filter_validation: validation,
      psychology_mapping: psychologyMapping,
    });
  } catch (error: any) {
    logger.error(`Failed to get preset ${req.params.presetKey}:`, error);
    res.status(500).json({ error: 'Failed to get preset details' });
  }
});

/**
 * GET /api/apollo/presets/:presetKey/filters
 * Get Apollo-ready filters for a preset
 */
router.get('/presets/:presetKey/filters', async (req: Request, res: Response) => {
  try {
    const { presetKey } = req.params;
    const filters = getFiltersForPreset(presetKey);

    if (!filters) {
      return res.status(404).json({ error: `Preset '${presetKey}' not found` });
    }

    // Validate filters
    const validation = validatePresetFilters(presetKey);

    res.json({
      filters,
      validation,
      search_mode: getPreset(presetKey)?.search_mode || 'structured',
    });
  } catch (error: any) {
    logger.error(`Failed to get filters for ${req.params.presetKey}:`, error);
    res.status(500).json({ error: 'Failed to get preset filters' });
  }
});

// =============================================================================
// SEARCH ENDPOINTS
// =============================================================================

/**
 * POST /api/apollo/search
 * Execute an Apollo people search
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const {
      filters,
      mode = 'structured',
      page = 1,
      per_page = 25,
      preset_key,
    } = req.body;

    // If preset_key provided, use preset filters
    let searchFilters: ApolloSearchFilters;
    let searchMode: ApolloSearchMode = mode;

    if (preset_key) {
      const presetFilters = getFiltersForPreset(preset_key);
      if (!presetFilters) {
        return res.status(400).json({ error: `Invalid preset_key: ${preset_key}` });
      }
      searchFilters = { ...presetFilters, ...filters };
      searchMode = getPreset(preset_key)?.search_mode || mode;
    } else if (filters) {
      searchFilters = filters;
    } else {
      return res.status(400).json({
        error: 'Either filters or preset_key is required',
      });
    }

    // Validate filters
    const validation = apolloService.validateFilters(searchFilters, searchMode);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid filters',
        validation_errors: validation.errors,
        sanitized_filters: validation.sanitized_filters,
      });
    }

    // Execute search (sanitized_filters is guaranteed to exist if valid)
    const results = await apolloService.searchPeople(
      validation.sanitized_filters!,
      page,
      per_page
    );

    res.json({
      success: true,
      results: results.people,
      pagination: results.pagination,
      search_mode: searchMode,
      filters_used: validation.sanitized_filters!,
      warnings: validation.warnings,
    });
  } catch (error: any) {
    logger.error('Apollo search failed:', error);
    res.status(500).json({
      error: 'Search failed',
      details: error.message,
    });
  }
});

/**
 * POST /api/apollo/search/preview
 * Preview search results count without fetching full data
 */
router.post('/search/preview', async (req: Request, res: Response) => {
  try {
    const { filters, mode = 'structured', preset_key } = req.body;

    let searchFilters: ApolloSearchFilters;
    let searchMode: ApolloSearchMode = mode;

    if (preset_key) {
      const presetFilters = getFiltersForPreset(preset_key);
      if (!presetFilters) {
        return res.status(400).json({ error: `Invalid preset_key: ${preset_key}` });
      }
      searchFilters = { ...presetFilters, ...filters };
      searchMode = getPreset(preset_key)?.search_mode || mode;
    } else if (filters) {
      searchFilters = filters;
    } else {
      return res.status(400).json({
        error: 'Either filters or preset_key is required',
      });
    }

    // Validate and sanitize
    const validation = apolloService.validateFilters(searchFilters, searchMode);

    // Get count only (page 1, per_page 1)
    const preview = await apolloService.searchPeople(
      validation.sanitized_filters!,
      1,
      1
    );

    res.json({
      estimated_total: preview.pagination.total_entries,
      filters_valid: validation.valid,
      validation_errors: validation.errors,
      warnings: validation.warnings,
      sanitized_filters: validation.sanitized_filters,
    });
  } catch (error: any) {
    logger.error('Search preview failed:', error);
    res.status(500).json({ error: 'Preview failed', details: error.message });
  }
});

/**
 * POST /api/apollo/filters/validate
 * Validate filters without executing search
 */
router.post('/filters/validate', async (req: Request, res: Response) => {
  try {
    const { filters, mode = 'structured' } = req.body;

    if (!filters) {
      return res.status(400).json({ error: 'filters is required' });
    }

    const validation = apolloService.validateFilters(filters, mode);

    res.json({
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      sanitized_filters: validation.sanitized_filters,
      mode,
    });
  } catch (error: any) {
    logger.error('Filter validation failed:', error);
    res.status(500).json({ error: 'Validation failed', details: error.message });
  }
});

// =============================================================================
// LIST MANAGEMENT
// =============================================================================

/**
 * GET /api/apollo/lists
 * Get all Apollo lists (filtered by our prefix)
 */
router.get('/lists', async (req: Request, res: Response) => {
  try {
    const lists = await apolloService.getContactLists();

    res.json({
      lists,
      total: lists.length,
      prefix: 'NoboxOutreach-',
    });
  } catch (error: any) {
    logger.error('Failed to get lists:', error);
    res.status(500).json({ error: 'Failed to get lists', details: error.message });
  }
});

/**
 * POST /api/apollo/lists
 * Create a new Apollo list
 */
router.post('/lists', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const list = await apolloService.createContactList(name);

    // Track in database
    await db.insert(apolloListSync).values({
      apolloListId: list.id,
      apolloListName: list.name,
      syncStatus: 'pending',
    });

    res.status(201).json({
      success: true,
      list,
    });
  } catch (error: any) {
    logger.error('Failed to create list:', error);
    res.status(500).json({ error: 'Failed to create list', details: error.message });
  }
});

/**
 * POST /api/apollo/lists/:listId/add
 * Add contacts to an Apollo list
 */
router.post('/lists/:listId/add', async (req: Request, res: Response) => {
  try {
    const { listId } = req.params;
    const { contact_ids, lead_ids } = req.body;

    // If lead_ids provided, get their Apollo contact IDs
    let contactIdsToAdd = contact_ids || [];

    if (lead_ids && Array.isArray(lead_ids)) {
      const leadsData = await db
        .select({ apolloContactId: leads.apolloContactId })
        .from(leads)
        .where(
          and(
            inArray(leads.id, lead_ids),
            sql`${leads.apolloContactId} IS NOT NULL`
          )
        );

      const apolloIds = leadsData
        .map((l) => l.apolloContactId)
        .filter(Boolean) as string[];

      contactIdsToAdd = [...contactIdsToAdd, ...apolloIds];
    }

    if (contactIdsToAdd.length === 0) {
      return res.status(400).json({
        error: 'No valid contact_ids or lead_ids with Apollo IDs provided',
      });
    }

    const result = await apolloService.addContactsToList(listId, contactIdsToAdd);

    res.json({
      success: true,
      added_count: contactIdsToAdd.length,
      result,
    });
  } catch (error: any) {
    logger.error('Failed to add contacts to list:', error);
    res.status(500).json({
      error: 'Failed to add contacts to list',
      details: error.message,
    });
  }
});

// =============================================================================
// LEAD IMPORT FROM APOLLO
// =============================================================================

/**
 * POST /api/apollo/import
 * Import Apollo contacts as leads
 */
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { contacts, preset_key } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'contacts array is required' });
    }

    // Get preset info for archetype tagging
    const preset = preset_key ? getPreset(preset_key) : null;

    const imported: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    for (const contact of contacts) {
      try {
        // Check for duplicate by email
        if (contact.email) {
          const existing = await db
            .select({ id: leads.id })
            .from(leads)
            .where(eq(leads.email, contact.email))
            .limit(1);

          if (existing.length > 0) {
            skipped.push({
              email: contact.email,
              reason: 'duplicate',
              existing_id: existing[0].id,
            });
            continue;
          }
        }

        // Map Apollo contact to lead schema
        const leadData = {
          firstName: contact.first_name || null,
          lastName: contact.last_name || null,
          email: contact.email,
          phoneNumber: contact.phone_number || contact.mobile_phone || null,
          company: contact.organization?.name || null,
          title: contact.title || null,
          website: contact.organization?.website_url || null,
          linkedinUrl: contact.linkedin_url || null,
          source: 'apollo' as const,
          status: 'active' as const,
          apolloContactId: contact.id,
          apolloOrganizationId: contact.organization_id,
          icpPresetKey: preset_key || null,
          archetype: preset?.archetype || null,
          discoverySource: 'apollo_search',
          emailVerified: contact.email_status === 'verified',
          // Store additional Apollo data as notes
          notes: contact.organization?.industry
            ? `Industry: ${contact.organization.industry}. Location: ${[contact.city, contact.state, contact.country].filter(Boolean).join(', ')}`
            : null,
        };

        const [newLead] = await db.insert(leads).values(leadData).returning();

        imported.push({
          id: newLead.id,
          email: newLead.email,
          firstName: newLead.firstName,
          lastName: newLead.lastName,
        });
      } catch (contactError: any) {
        errors.push({
          contact: contact.email || contact.id,
          error: contactError.message,
        });
      }
    }

    res.json({
      success: true,
      summary: {
        total: contacts.length,
        imported: imported.length,
        skipped: skipped.length,
        errors: errors.length,
      },
      imported,
      skipped,
      errors,
      preset_applied: preset_key || null,
    });
  } catch (error: any) {
    logger.error('Failed to import contacts:', error);
    res.status(500).json({
      error: 'Failed to import contacts',
      details: error.message,
    });
  }
});

// =============================================================================
// PSYCHOLOGY & STRATEGY ENDPOINTS
// =============================================================================

/**
 * GET /api/apollo/strategies
 * List all psychological strategies
 */
router.get('/strategies', async (req: Request, res: Response) => {
  try {
    const strategies = listStrategies();
    res.json({
      strategies,
      total: strategies.length,
    });
  } catch (error: any) {
    logger.error('Failed to list strategies:', error);
    res.status(500).json({ error: 'Failed to list strategies' });
  }
});

/**
 * GET /api/apollo/strategies/:strategyId
 * Get detailed strategy information
 */
router.get('/strategies/:strategyId', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const strategy = PSYCHOLOGICAL_STRATEGIES[strategyId];

    if (!strategy) {
      return res.status(404).json({ error: `Strategy '${strategyId}' not found` });
    }

    res.json(strategy);
  } catch (error: any) {
    logger.error(`Failed to get strategy ${req.params.strategyId}:`, error);
    res.status(500).json({ error: 'Failed to get strategy' });
  }
});

/**
 * GET /api/apollo/archetypes
 * List all archetype profiles
 */
router.get('/archetypes', async (req: Request, res: Response) => {
  try {
    const archetypes = Object.values(ARCHETYPE_PROFILES).map((a) => ({
      id: a.id,
      name: a.name,
      core_characteristics: a.core_characteristics,
    }));

    res.json({
      archetypes,
      total: archetypes.length,
    });
  } catch (error: any) {
    logger.error('Failed to list archetypes:', error);
    res.status(500).json({ error: 'Failed to list archetypes' });
  }
});

/**
 * GET /api/apollo/archetypes/:archetypeId
 * Get detailed archetype profile
 */
router.get('/archetypes/:archetypeId', async (req: Request, res: Response) => {
  try {
    const { archetypeId } = req.params;

    // Find by name (since that's how they're keyed)
    const archetype = Object.values(ARCHETYPE_PROFILES).find(
      (a) => a.id === archetypeId || a.name === archetypeId
    );

    if (!archetype) {
      return res.status(404).json({ error: `Archetype '${archetypeId}' not found` });
    }

    // Get objections and CTAs
    const objections = getObjectionPatterns(archetype.name);
    const optimalCTAs = getOptimalCTAs(archetype.name);

    res.json({
      ...archetype,
      objection_patterns: objections,
      optimal_ctas: optimalCTAs,
    });
  } catch (error: any) {
    logger.error(`Failed to get archetype ${req.params.archetypeId}:`, error);
    res.status(500).json({ error: 'Failed to get archetype' });
  }
});

/**
 * POST /api/apollo/email-prompt
 * Generate AI prompt for personalized email
 */
router.post('/email-prompt', async (req: Request, res: Response) => {
  try {
    const { icp_key, lead, campaign, strategy_override } = req.body;

    if (!lead || !lead.name || !lead.company) {
      return res.status(400).json({
        error: 'lead object with name and company is required',
      });
    }

    // If no ICP key, try to infer from lead data or use generic
    const effectiveIcpKey = icp_key || 'workers_comp_law_firms';

    const prompt = generateEmailPrompt({
      icp_key: effectiveIcpKey,
      lead,
      campaign,
      strategy_override,
    });

    res.json({
      success: true,
      prompt,
    });
  } catch (error: any) {
    logger.error('Failed to generate email prompt:', error);
    res.status(500).json({
      error: 'Failed to generate email prompt',
      details: error.message,
    });
  }
});

/**
 * POST /api/apollo/strategy-selection
 * Get strategy recommendations for an ICP
 */
router.post('/strategy-selection', async (req: Request, res: Response) => {
  try {
    const { icp_key } = req.body;

    if (!icp_key) {
      return res.status(400).json({ error: 'icp_key is required' });
    }

    const selection = selectStrategiesForICP(icp_key);

    if (!selection) {
      return res.status(404).json({ error: `ICP '${icp_key}' not found` });
    }

    // Also get applicable strategies
    const applicableStrategies = getApplicableStrategies(icp_key);

    res.json({
      selection,
      applicable_strategies: applicableStrategies.map((s) => ({
        id: s.id,
        name: s.name,
        effectiveness_multiplier: s.effectiveness_multiplier,
      })),
    });
  } catch (error: any) {
    logger.error('Failed to get strategy selection:', error);
    res.status(500).json({
      error: 'Failed to get strategy selection',
      details: error.message,
    });
  }
});

// =============================================================================
// SAVED SEARCHES
// =============================================================================

/**
 * GET /api/apollo/saved-searches
 * Get all saved searches
 */
router.get('/saved-searches', async (req: Request, res: Response) => {
  try {
    const searches = await db
      .select()
      .from(savedSearches)
      .orderBy(sql`${savedSearches.createdAt} DESC`);

    res.json({
      searches,
      total: searches.length,
    });
  } catch (error: any) {
    logger.error('Failed to get saved searches:', error);
    res.status(500).json({ error: 'Failed to get saved searches' });
  }
});

/**
 * POST /api/apollo/saved-searches
 * Save a search configuration
 */
router.post('/saved-searches', async (req: Request, res: Response) => {
  try {
    const { name, filters, mode, preset_key, description } = req.body;

    if (!name || !filters) {
      return res.status(400).json({ error: 'name and filters are required' });
    }

    const [newSearch] = await db
      .insert(savedSearches)
      .values({
        name,
        filters: filters,
        searchMode: mode || 'structured',
        icpPresetKey: preset_key || null,
        description: description || null,
      })
      .returning();

    res.status(201).json({
      success: true,
      saved_search: newSearch,
    });
  } catch (error: any) {
    logger.error('Failed to save search:', error);
    res.status(500).json({ error: 'Failed to save search', details: error.message });
  }
});

/**
 * DELETE /api/apollo/saved-searches/:id
 * Delete a saved search
 */
router.delete('/saved-searches/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid search ID' });
    }

    await db.delete(savedSearches).where(eq(savedSearches.id, id));

    res.json({ success: true, deleted_id: id });
  } catch (error: any) {
    logger.error('Failed to delete saved search:', error);
    res.status(500).json({ error: 'Failed to delete saved search' });
  }
});

// =============================================================================
// RATE LIMITING & COST TRACKING
// =============================================================================

import { apolloRateLimiter, APOLLO_RATE_LIMITS, BUDGET_CAPS } from '../services/apollo-rate-limiter';

/**
 * GET /api/apollo/rate-limits
 * Get current rate limit status
 */
router.get('/rate-limits', async (req: Request, res: Response) => {
  try {
    const status = apolloRateLimiter.getRateLimitStatus();
    const budgetStatus = await apolloRateLimiter.checkBudget();

    res.json({
      rate_limits: status,
      budget: {
        current_spend_usd: budgetStatus.currentSpend,
        monthly_limit_usd: budgetStatus.limit,
        percent_used: Math.round(budgetStatus.percentUsed * 100),
        warning: budgetStatus.warning,
        exceeded: budgetStatus.exceeded,
      },
      config: {
        limits: APOLLO_RATE_LIMITS,
        budget_caps: BUDGET_CAPS,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get rate limit status:', error);
    res.status(500).json({ error: 'Failed to get rate limit status' });
  }
});

/**
 * GET /api/apollo/cost-breakdown
 * Get detailed cost breakdown for the current month
 */
router.get('/cost-breakdown', async (req: Request, res: Response) => {
  try {
    const breakdown = await apolloRateLimiter.getCostBreakdown();

    res.json({
      total_cost_usd: breakdown.total,
      by_operation: breakdown.by_operation,
      period: {
        start: breakdown.period.start.toISOString(),
        end: breakdown.period.end.toISOString(),
      },
      budget: {
        monthly_limit_usd: BUDGET_CAPS.monthly_total,
        remaining_usd: Math.max(0, BUDGET_CAPS.monthly_total - breakdown.total),
        percent_used: Math.round((breakdown.total / BUDGET_CAPS.monthly_total) * 100),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get cost breakdown:', error);
    res.status(500).json({ error: 'Failed to get cost breakdown' });
  }
});

/**
 * POST /api/apollo/rate-limits/persist
 * Persist current rate limit stats to database
 */
router.post('/rate-limits/persist', async (req: Request, res: Response) => {
  try {
    await apolloRateLimiter.persistRateLimitStats();
    res.json({ success: true, message: 'Rate limit stats persisted' });
  } catch (error: any) {
    logger.error('Failed to persist rate limit stats:', error);
    res.status(500).json({ error: 'Failed to persist rate limit stats' });
  }
});

// =============================================================================
// EXPORT
// =============================================================================

export default router;

/**
 * Register Apollo routes with Express app
 */
export function registerApolloRoutes(app: any): void {
  app.use('/api/apollo', router);
  logger.info('Apollo routes registered at /api/apollo');
}
