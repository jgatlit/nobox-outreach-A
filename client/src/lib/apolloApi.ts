/**
 * Apollo.io API Client for Frontend
 *
 * Provides typed interfaces and methods for Apollo integration.
 * Uses the backend API routes at /api/apollo/*
 */

import { apiRequest } from './queryClient';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface ApolloSearchFilters {
  person_titles?: string[];
  person_seniorities?: string[];
  q_organization_keyword_tags?: string[];
  organization_num_employees_ranges?: string[];
  organization_revenue_ranges?: string[];
  funding_stage_list?: string[];
  person_locations?: string[];
  organization_locations?: string[];
  q_keywords?: string[];
  contact_email_status?: string[];
  currently_using_any_of_technology_uids?: string[];
  organization_ids?: string[];
  exclude_person_ids?: string[];
  exclude_organization_ids?: string[];
}

export type ApolloSearchMode = 'structured' | 'discovery' | 'tech_stack';

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  email_status: string;
  title: string;
  linkedin_url?: string;
  phone_number?: string;
  mobile_phone?: string;
  city?: string;
  state?: string;
  country?: string;
  organization?: {
    id: string;
    name: string;
    website_url?: string;
    industry?: string;
    employee_count?: number;
    founded_year?: number;
  };
  organization_id?: string;
}

export interface ApolloList {
  id: string;
  name: string;
  display_name: string;
  modality: string;
  cached_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface PaginationInfo {
  page: number;
  per_page: number;
  total_entries: number;
  total_pages: number;
}

// ICP Preset Types
export interface ICPPreset {
  id: string;
  name: string;
  search_mode: ApolloSearchMode;
  archetype: string;
  description: string;
  apollo_filters: ApolloSearchFilters;
  estimated_leads: number;
  pain_points: string[];
  use_cases: string[];
  primary_strategies: string[];
  secondary_strategies: string[];
  messaging_style: string;
}

export interface StrategyRecommendation {
  strategy_id: string;
  strategy_name: string;
  weight: number;
  reasoning: string;
  sample_subject_line: string;
  sample_opening: string;
}

export interface PsychologicalStrategy {
  id: string;
  name: string;
  description: string;
  core_mechanism: string;
  best_for_archetypes: string[];
  email_patterns: {
    subject_line_patterns: string[];
    opening_hooks: string[];
    call_to_action_patterns: string[];
  };
  trigger_words: string[];
  avoid_with: string[];
  effectiveness_multiplier: number;
}

export interface ArchetypeProfile {
  id: string;
  name: string;
  core_characteristics: string[];
  decision_drivers: string[];
  communication_preferences: {
    tone: string;
    length: 'brief' | 'moderate' | 'detailed';
    formality: 'casual' | 'professional' | 'formal';
    data_preference: 'narrative' | 'metrics' | 'balanced';
  };
  response_triggers: string[];
  objection_patterns: string[];
  optimal_cta_types: string[];
}

export interface SavedSearch {
  id: number;
  name: string;
  description?: string;
  searchMode: ApolloSearchMode;
  filters: ApolloSearchFilters;
  icpPresetKey?: string;
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Response Types
export interface SearchResponse {
  success: boolean;
  results: ApolloPerson[];
  pagination: PaginationInfo;
  search_mode: ApolloSearchMode;
  filters_used: ApolloSearchFilters;
  warnings?: string[];
}

export interface SearchPreviewResponse {
  estimated_total: number;
  filters_valid: boolean;
  validation_errors: string[];
  warnings: string[];
  sanitized_filters: ApolloSearchFilters;
}

export interface FilterValidationResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized_filters: ApolloSearchFilters;
  mode: ApolloSearchMode;
}

export interface ImportResult {
  success: boolean;
  summary: {
    total: number;
    imported: number;
    skipped: number;
    errors: number;
  };
  imported: Array<{ id: number; email: string; firstName: string; lastName: string }>;
  skipped: Array<{ email: string; reason: string; existing_id?: number }>;
  errors: Array<{ contact: string; error: string }>;
  preset_applied: string | null;
}

export interface EmailPromptResponse {
  success: boolean;
  prompt: {
    system_prompt: string;
    user_prompt: string;
    metadata: {
      icp_key: string;
      archetype: string;
      primary_strategy: string;
      secondary_strategies: string[];
      communication_style: string;
    };
  };
}

export interface StrategySelectionResponse {
  selection: {
    icp_key: string;
    archetype: string;
    primary_recommendations: StrategyRecommendation[];
    secondary_recommendations: StrategyRecommendation[];
    avoid_strategies: string[];
    communication_guidelines: {
      tone: string;
      length: string;
      formality: string;
      data_preference: string;
    };
  };
  applicable_strategies: Array<{
    id: string;
    name: string;
    effectiveness_multiplier: number;
  }>;
}

// =============================================================================
// API CLIENT
// =============================================================================

const APOLLO_API_BASE = '/api/apollo';

export const apolloApi = {
  // ---------------------------------------------------------------------------
  // Health & Status
  // ---------------------------------------------------------------------------

  /**
   * Check Apollo service health and configuration
   */
  async checkHealth(): Promise<{
    status: string;
    api_key_prefix: string;
    list_prefix: string;
    timestamp: string;
  }> {
    return apiRequest(`${APOLLO_API_BASE}/health`);
  },

  // ---------------------------------------------------------------------------
  // ICP Presets
  // ---------------------------------------------------------------------------

  /**
   * List all available ICP presets
   */
  async listPresets(): Promise<{
    total_presets: number;
    presets: Record<string, {
      name: string;
      archetype: string;
      description: string;
      estimated_leads: number;
      search_mode: string;
    }>;
  }> {
    return apiRequest(`${APOLLO_API_BASE}/presets`);
  },

  /**
   * Get detailed preset information
   */
  async getPreset(presetKey: string): Promise<{
    preset: ICPPreset;
    metadata: {
      archetype: string;
      pain_points: string[];
      use_cases: string[];
      messaging_style: string;
      primary_strategies: string[];
      secondary_strategies: string[];
    };
    strategies: { primary: string[]; secondary: string[] };
    pain_triggers: string[];
    filter_validation: { valid: boolean; issues: string[] };
    psychology_mapping: StrategySelectionResponse['selection'];
  }> {
    return apiRequest(`${APOLLO_API_BASE}/presets/${presetKey}`);
  },

  /**
   * Get Apollo-ready filters for a preset
   */
  async getPresetFilters(presetKey: string): Promise<{
    filters: ApolloSearchFilters;
    validation: { valid: boolean; issues: string[] };
    search_mode: ApolloSearchMode;
  }> {
    return apiRequest(`${APOLLO_API_BASE}/presets/${presetKey}/filters`);
  },

  // ---------------------------------------------------------------------------
  // Search Operations
  // ---------------------------------------------------------------------------

  /**
   * Execute Apollo people search
   */
  async search(params: {
    filters?: ApolloSearchFilters;
    mode?: ApolloSearchMode;
    page?: number;
    per_page?: number;
    preset_key?: string;
  }): Promise<SearchResponse> {
    return apiRequest('POST', `${APOLLO_API_BASE}/search`, params);
  },

  /**
   * Preview search results count
   */
  async previewSearch(params: {
    filters?: ApolloSearchFilters;
    mode?: ApolloSearchMode;
    preset_key?: string;
  }): Promise<SearchPreviewResponse> {
    return apiRequest('POST', `${APOLLO_API_BASE}/search/preview`, params);
  },

  /**
   * Validate filters without executing search
   */
  async validateFilters(filters: ApolloSearchFilters, mode: ApolloSearchMode = 'structured'): Promise<FilterValidationResponse> {
    return apiRequest('POST', `${APOLLO_API_BASE}/filters/validate`, { filters, mode });
  },

  // ---------------------------------------------------------------------------
  // List Management
  // ---------------------------------------------------------------------------

  /**
   * Get all Apollo lists
   */
  async getLists(): Promise<{
    lists: ApolloList[];
    total: number;
    prefix: string;
  }> {
    return apiRequest(`${APOLLO_API_BASE}/lists`);
  },

  /**
   * Create a new Apollo list
   */
  async createList(name: string, description?: string): Promise<{
    success: boolean;
    list: ApolloList;
  }> {
    return apiRequest('POST', `${APOLLO_API_BASE}/lists`, { name, description });
  },

  /**
   * Add contacts to an Apollo list
   */
  async addToList(listId: string, params: {
    contact_ids?: string[];
    lead_ids?: number[];
  }): Promise<{
    success: boolean;
    added_count: number;
    result: any;
  }> {
    return apiRequest('POST', `${APOLLO_API_BASE}/lists/${listId}/add`, params);
  },

  // ---------------------------------------------------------------------------
  // Lead Import
  // ---------------------------------------------------------------------------

  /**
   * Import Apollo contacts as leads
   */
  async importContacts(contacts: ApolloPerson[], preset_key?: string): Promise<ImportResult> {
    return apiRequest('POST', `${APOLLO_API_BASE}/import`, { contacts, preset_key });
  },

  // ---------------------------------------------------------------------------
  // Psychology & Strategies
  // ---------------------------------------------------------------------------

  /**
   * List all psychological strategies
   */
  async listStrategies(): Promise<{
    strategies: Array<{ id: string; name: string; description: string }>;
    total: number;
  }> {
    return apiRequest(`${APOLLO_API_BASE}/strategies`);
  },

  /**
   * Get detailed strategy information
   */
  async getStrategy(strategyId: string): Promise<PsychologicalStrategy> {
    return apiRequest(`${APOLLO_API_BASE}/strategies/${strategyId}`);
  },

  /**
   * List all archetype profiles
   */
  async listArchetypes(): Promise<{
    archetypes: Array<{ id: string; name: string; core_characteristics: string[] }>;
    total: number;
  }> {
    return apiRequest(`${APOLLO_API_BASE}/archetypes`);
  },

  /**
   * Get detailed archetype profile
   */
  async getArchetype(archetypeId: string): Promise<ArchetypeProfile & {
    objection_patterns: string[];
    optimal_ctas: string[];
  }> {
    return apiRequest(`${APOLLO_API_BASE}/archetypes/${archetypeId}`);
  },

  /**
   * Generate AI prompt for personalized email
   */
  async generateEmailPrompt(params: {
    icp_key: string;
    lead: {
      name: string;
      company: string;
      title: string;
      industry?: string;
      linkedin_url?: string;
      enrichment_data?: Record<string, any>;
    };
    campaign?: {
      product_name: string;
      value_proposition: string;
      target_outcome: string;
    };
    strategy_override?: string;
  }): Promise<EmailPromptResponse> {
    return apiRequest('POST', `${APOLLO_API_BASE}/email-prompt`, params);
  },

  /**
   * Get strategy recommendations for an ICP
   */
  async getStrategySelection(icp_key: string): Promise<StrategySelectionResponse> {
    return apiRequest('POST', `${APOLLO_API_BASE}/strategy-selection`, { icp_key });
  },

  // ---------------------------------------------------------------------------
  // Saved Searches
  // ---------------------------------------------------------------------------

  /**
   * Get all saved searches
   */
  async getSavedSearches(): Promise<{
    searches: SavedSearch[];
    total: number;
  }> {
    return apiRequest(`${APOLLO_API_BASE}/saved-searches`);
  },

  /**
   * Save a search configuration
   */
  async saveSearch(params: {
    name: string;
    filters: ApolloSearchFilters;
    mode?: ApolloSearchMode;
    preset_key?: string;
    description?: string;
  }): Promise<{
    success: boolean;
    saved_search: SavedSearch;
  }> {
    return apiRequest('POST', `${APOLLO_API_BASE}/saved-searches`, params);
  },

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(id: number): Promise<{ success: boolean; deleted_id: number }> {
    return apiRequest('DELETE', `${APOLLO_API_BASE}/saved-searches/${id}`);
  },
};

// =============================================================================
// REACT QUERY HOOKS
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query Keys
export const apolloQueryKeys = {
  health: ['apollo', 'health'] as const,
  presets: ['apollo', 'presets'] as const,
  preset: (key: string) => ['apollo', 'presets', key] as const,
  lists: ['apollo', 'lists'] as const,
  strategies: ['apollo', 'strategies'] as const,
  strategy: (id: string) => ['apollo', 'strategies', id] as const,
  archetypes: ['apollo', 'archetypes'] as const,
  archetype: (id: string) => ['apollo', 'archetypes', id] as const,
  savedSearches: ['apollo', 'saved-searches'] as const,
  searchResults: (filters: ApolloSearchFilters, mode: ApolloSearchMode, page: number) =>
    ['apollo', 'search', { filters, mode, page }] as const,
};

/**
 * Hook to check Apollo health
 */
export function useApolloHealth() {
  return useQuery({
    queryKey: apolloQueryKeys.health,
    queryFn: () => apolloApi.checkHealth(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to list ICP presets
 */
export function useICPPresets() {
  return useQuery({
    queryKey: apolloQueryKeys.presets,
    queryFn: () => apolloApi.listPresets(),
    staleTime: Infinity, // Presets don't change
  });
}

/**
 * Hook to get a specific preset
 */
export function useICPPreset(presetKey: string | null) {
  return useQuery({
    queryKey: apolloQueryKeys.preset(presetKey || ''),
    queryFn: () => apolloApi.getPreset(presetKey!),
    enabled: !!presetKey,
    staleTime: Infinity,
  });
}

/**
 * Hook to list Apollo lists
 */
export function useApolloLists() {
  return useQuery({
    queryKey: apolloQueryKeys.lists,
    queryFn: () => apolloApi.getLists(),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to list psychological strategies
 */
export function usePsychologicalStrategies() {
  return useQuery({
    queryKey: apolloQueryKeys.strategies,
    queryFn: () => apolloApi.listStrategies(),
    staleTime: Infinity,
  });
}

/**
 * Hook to list archetypes
 */
export function useArchetypes() {
  return useQuery({
    queryKey: apolloQueryKeys.archetypes,
    queryFn: () => apolloApi.listArchetypes(),
    staleTime: Infinity,
  });
}

/**
 * Hook to get saved searches
 */
export function useSavedSearches() {
  return useQuery({
    queryKey: apolloQueryKeys.savedSearches,
    queryFn: () => apolloApi.getSavedSearches(),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to perform Apollo search
 */
export function useApolloSearch() {
  return useMutation({
    mutationFn: apolloApi.search,
  });
}

/**
 * Hook to preview search results
 */
export function useSearchPreview() {
  return useMutation({
    mutationFn: apolloApi.previewSearch,
  });
}

/**
 * Hook to import contacts
 */
export function useImportContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contacts, preset_key }: { contacts: ApolloPerson[]; preset_key?: string }) =>
      apolloApi.importContacts(contacts, preset_key),
    onSuccess: () => {
      // Invalidate leads queries after import
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

/**
 * Hook to create Apollo list
 */
export function useCreateList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      apolloApi.createList(name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apolloQueryKeys.lists });
    },
  });
}

/**
 * Hook to add contacts to list
 */
export function useAddToList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listId, ...params }: { listId: string; contact_ids?: string[]; lead_ids?: number[] }) =>
      apolloApi.addToList(listId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apolloQueryKeys.lists });
    },
  });
}

/**
 * Hook to save a search
 */
export function useSaveSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apolloApi.saveSearch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apolloQueryKeys.savedSearches });
    },
  });
}

/**
 * Hook to delete a saved search
 */
export function useDeleteSavedSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apolloApi.deleteSavedSearch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apolloQueryKeys.savedSearches });
    },
  });
}

/**
 * Hook to generate email prompt
 */
export function useGenerateEmailPrompt() {
  return useMutation({
    mutationFn: apolloApi.generateEmailPrompt,
  });
}

/**
 * Hook to get strategy selection
 */
export function useStrategySelection() {
  return useMutation({
    mutationFn: (icp_key: string) => apolloApi.getStrategySelection(icp_key),
  });
}

// =============================================================================
// ANALYTICS TYPES
// =============================================================================

export interface ICPDistributionItem {
  icp_key: string;
  archetype: string;
  preset_name: string;
  total_leads: number;
  verified_emails: number;
  contacted: number;
  responded: number;
  qualified: number;
  contact_rate: number;
  response_rate: number;
  qualification_rate: number;
}

export interface ICPDistributionResponse {
  distribution: ICPDistributionItem[];
  totals: {
    total_leads: number;
    verified_emails: number;
    contacted: number;
    responded: number;
    qualified: number;
    overall_contact_rate: number;
    overall_response_rate: number;
    overall_qualification_rate: number;
  };
  icp_count: number;
}

export interface ArchetypePerformanceItem {
  archetype: string;
  archetype_id: string;
  core_characteristics: string[];
  communication_preferences: {
    tone: string;
    length: string;
    formality: string;
    data_preference: string;
  } | null;
  total_leads: number;
  contacted: number;
  responded: number;
  qualified: number;
  response_rate: number;
  qualification_rate: number;
  effectiveness_score: number;
}

export interface ArchetypePerformanceResponse {
  archetypes: ArchetypePerformanceItem[];
  total_archetypes: number;
  best_performing: ArchetypePerformanceItem | null;
}

export interface StrategyPerformanceItem {
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

export interface StrategyPerformanceResponse {
  strategies: StrategyPerformanceItem[];
  total_strategies: number;
  best_performing: StrategyPerformanceItem | null;
  summary: {
    total_messages: number;
    total_replies: number;
    total_meetings: number;
  };
}

export interface CampaignICPBreakdown {
  campaign_id: number;
  campaign_name: string;
  icp_key: string;
  icp_name: string;
  archetype: string;
  total_prospects: number;
  completed: number;
  in_progress: number;
  errors: number;
  completion_rate: number;
}

export interface CampaignByICPResponse {
  campaigns: Array<{
    campaign_id: number;
    campaign_name: string;
    icp_breakdown: CampaignICPBreakdown[];
    totals: {
      total_prospects: number;
      completed: number;
      in_progress: number;
      errors: number;
    };
  }>;
  total_campaigns: number;
}

export interface CostTrendDay {
  date: string;
  total_cost_usd: number;
  total_credits: number;
  by_operation: Record<string, { cost_usd: number; credits: number; requests: number }>;
}

export interface CostTrendsResponse {
  trends: CostTrendDay[];
  summary: {
    period_days: number;
    total_cost_usd: number;
    total_credits: number;
    avg_daily_cost_usd: number;
    data_points: number;
  };
}

export interface DashboardSummaryResponse {
  leads: {
    total: number;
    from_apollo: number;
    with_icp: number;
    verified_emails: number;
    contacted: number;
    responded: number;
  };
  outreach: {
    total_messages: number;
    total_replies: number;
    total_meetings: number;
    reply_rate: number;
  };
  cost: {
    monthly_spend_usd: number;
    monthly_budget_usd: number;
  };
  icp_presets: {
    total: number;
    presets: Array<{ key: string; name: string; archetype: string }>;
  };
  strategies: {
    total: number;
    names: Array<{ id: string; name: string }>;
  };
  archetypes: {
    total: number;
    names: string[];
  };
}

// =============================================================================
// ANALYTICS API CLIENT
// =============================================================================

const ANALYTICS_API_BASE = '/api/apollo/analytics';

export const apolloAnalyticsApi = {
  /**
   * Get lead distribution by ICP preset
   */
  async getICPDistribution(): Promise<ICPDistributionResponse> {
    return apiRequest(`${ANALYTICS_API_BASE}/icp-distribution`);
  },

  /**
   * Get performance metrics by archetype
   */
  async getArchetypePerformance(): Promise<ArchetypePerformanceResponse> {
    return apiRequest(`${ANALYTICS_API_BASE}/archetype-performance`);
  },

  /**
   * Get performance metrics by psychological strategy
   */
  async getStrategyPerformance(): Promise<StrategyPerformanceResponse> {
    return apiRequest(`${ANALYTICS_API_BASE}/strategy-performance`);
  },

  /**
   * Get campaign performance segmented by ICP
   */
  async getCampaignByICP(): Promise<CampaignByICPResponse> {
    return apiRequest(`${ANALYTICS_API_BASE}/campaign-by-icp`);
  },

  /**
   * Get cost trends over time
   */
  async getCostTrends(days: number = 30): Promise<CostTrendsResponse> {
    return apiRequest(`${ANALYTICS_API_BASE}/cost-trends?days=${days}`);
  },

  /**
   * Get comprehensive dashboard summary
   */
  async getDashboardSummary(): Promise<DashboardSummaryResponse> {
    return apiRequest(`${ANALYTICS_API_BASE}/dashboard-summary`);
  },
};

// =============================================================================
// ANALYTICS REACT QUERY HOOKS
// =============================================================================

// Analytics Query Keys
export const analyticsQueryKeys = {
  icpDistribution: ['apollo', 'analytics', 'icp-distribution'] as const,
  archetypePerformance: ['apollo', 'analytics', 'archetype-performance'] as const,
  strategyPerformance: ['apollo', 'analytics', 'strategy-performance'] as const,
  campaignByICP: ['apollo', 'analytics', 'campaign-by-icp'] as const,
  costTrends: (days: number) => ['apollo', 'analytics', 'cost-trends', days] as const,
  dashboardSummary: ['apollo', 'analytics', 'dashboard-summary'] as const,
};

/**
 * Hook to get ICP distribution analytics
 */
export function useICPDistribution() {
  return useQuery({
    queryKey: analyticsQueryKeys.icpDistribution,
    queryFn: () => apolloAnalyticsApi.getICPDistribution(),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to get archetype performance analytics
 */
export function useArchetypePerformance() {
  return useQuery({
    queryKey: analyticsQueryKeys.archetypePerformance,
    queryFn: () => apolloAnalyticsApi.getArchetypePerformance(),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to get strategy performance analytics
 */
export function useStrategyPerformance() {
  return useQuery({
    queryKey: analyticsQueryKeys.strategyPerformance,
    queryFn: () => apolloAnalyticsApi.getStrategyPerformance(),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to get campaign by ICP analytics
 */
export function useCampaignByICP() {
  return useQuery({
    queryKey: analyticsQueryKeys.campaignByICP,
    queryFn: () => apolloAnalyticsApi.getCampaignByICP(),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to get cost trends
 */
export function useCostTrends(days: number = 30) {
  return useQuery({
    queryKey: analyticsQueryKeys.costTrends(days),
    queryFn: () => apolloAnalyticsApi.getCostTrends(days),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get dashboard summary
 */
export function useDashboardSummary() {
  return useQuery({
    queryKey: analyticsQueryKeys.dashboardSummary,
    queryFn: () => apolloAnalyticsApi.getDashboardSummary(),
    staleTime: 60 * 1000, // 1 minute
  });
}

export default apolloApi;
