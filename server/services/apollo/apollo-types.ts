/**
 * Apollo.io API TypeScript Types
 *
 * Based on validated patterns from live API testing (2026-01-29)
 * Reference: /docs/APOLLO_FILTER_PATTERNS_HANDOFF.md
 */

// =============================================================================
// SEARCH MODE
// =============================================================================

export type ApolloSearchMode = 'structured' | 'discovery' | 'tech_stack';

// =============================================================================
// FILTER PARAMETERS
// =============================================================================

/**
 * Valid seniority levels for Apollo API
 */
export type ApolloSeniority =
  | 'c_suite'
  | 'vp'
  | 'director'
  | 'manager'
  | 'senior'
  | 'entry'
  | 'owner'
  | 'partner';

/**
 * Valid company size ranges (format: "min,max")
 */
export type ApolloSizeRange =
  | '1,10'
  | '11,50'
  | '51,200'
  | '201,500'
  | '501,1000'
  | '1001,5000'
  | '5001,10000'
  | '10001+';

/**
 * Email verification status
 */
export type ApolloEmailStatus = 'verified' | 'guessed' | 'unavailable';

/**
 * Funding stages
 */
export type ApolloFundingStage =
  | 'seed'
  | 'series_a'
  | 'series_b'
  | 'series_c'
  | 'series_d'
  | 'series_e'
  | 'series_f'
  | 'ipo'
  | 'private_equity';

// =============================================================================
// SEARCH FILTERS
// =============================================================================

/**
 * Apollo search filters with validated parameters
 *
 * CRITICAL NOTES:
 * - q_organization_industry_tags is SILENTLY IGNORED - use q_organization_keyword_tags
 * - q_keywords CANNOT be combined with structured filters (returns 0)
 * - person_seniorities alone is too broad - combine with keywords
 */
export interface ApolloSearchFilters {
  // WORKING PARAMETERS (Validated)

  /** Job titles - use SPECIFIC roles, not generic */
  person_titles?: string[];

  /** Seniority levels - combine with keywords for precision */
  person_seniorities?: ApolloSeniority[];

  /** Geographic locations - format: "Country" or "State, Country" */
  person_locations?: string[];

  /** Company size ranges - format: "min,max" */
  organization_num_employees_ranges?: ApolloSizeRange[];

  /**
   * Industry/keyword tags - PRIMARY method for industry filtering
   * Use this instead of q_organization_industry_tags (which is BROKEN)
   */
  q_organization_keyword_tags?: string[];

  /** Email verification status */
  contact_email_status?: ApolloEmailStatus[];

  /**
   * Keyword search - DISCOVERY MODE ONLY
   * Cannot combine with person_titles or organization_num_employees_ranges
   */
  q_keywords?: string;

  /** Technologies used by company */
  technologies?: string[];

  /** Revenue range (untested but documented) */
  revenue_range?: {
    min?: number;
    max?: number;
  };

  /** Funding stage (untested but documented) */
  funding_stage_list?: ApolloFundingStage[];

  /** LinkedIn skills */
  person_skills?: string[];

  /**
   * Domain targeting - newline-separated domains
   * For precise company targeting (ABM)
   */
  q_organization_domains?: string;

  // BROKEN PARAMETERS - Will be auto-mapped or rejected

  /**
   * @deprecated SILENTLY IGNORED by Apollo API
   * Will be auto-mapped to q_organization_keyword_tags
   */
  q_organization_industry_tags?: string[];

  /**
   * @deprecated Returns 0 results
   */
  organization_industry_tag_ids?: string[];
}

// =============================================================================
// SEARCH REQUEST/RESPONSE
// =============================================================================

export interface ApolloSearchRequest {
  filters: ApolloSearchFilters;
  page?: number;
  per_page?: number;
}

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string;
  email: string;
  email_status: ApolloEmailStatus;
  linkedin_url?: string;
  phone_numbers?: Array<{
    raw_number: string;
    sanitized_number: string;
    type: string;
  }>;
  city?: string;
  state?: string;
  country?: string;
  seniority?: string;
  departments?: string[];

  // Organization data
  organization?: {
    id: string;
    name: string;
    website_url?: string;
    linkedin_url?: string;
    primary_domain?: string;
    industry?: string;
    estimated_num_employees?: number;
    founded_year?: number;
    keywords?: string[];
  };
}

export interface ApolloPagination {
  page: number;
  per_page: number;
  total_entries: number;
  total_pages: number;
}

export interface ApolloSearchResponse {
  people: ApolloPerson[];
  pagination: ApolloPagination;
}

export interface ApolloPreviewResponse {
  success: boolean;
  preview: true;
  total_available: number;
  sample_count: number;
  estimated_cost_usd: number;
  search_quality_score: number;
  email_verification_rate: number;
  verified_emails_in_sample: number;
  sample_leads: ApolloPerson[];
  filters_used: ApolloSearchFilters;
}

// =============================================================================
// LIST MANAGEMENT
// =============================================================================

export interface ApolloList {
  id: string;
  name: string;
  display_name: string;
  modality: 'contacts' | 'accounts';
  cached_count: number;
  created_at: string;
  updated_at?: string;
}

export interface ApolloCreateListRequest {
  name: string;
}

export interface ApolloCreateListResponse {
  label: {
    id: string;
    name: string;
    modality: string;
    created_at: string;
  };
}

export interface ApolloAddContactsRequest {
  list_id: string;
  contact_ids?: string[];
  contact_emails?: string[];
}

export interface ApolloAddContactsResponse {
  success: boolean;
  contacts_added: number;
  list_id: string;
}

// =============================================================================
// ENRICHMENT
// =============================================================================

export interface ApolloEnrichRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  linkedin_url?: string;
  organization_name?: string;
  domain?: string;
  reveal_phone?: boolean;
}

export interface ApolloEnrichResponse {
  person: ApolloPerson;
  credits_used: number;
}

// =============================================================================
// SEND TO APOLLO
// =============================================================================

export interface SendToApolloRequest {
  lead_ids: number[];
  list_name: string;
  create_new?: boolean;
  new_contacts_only?: boolean;
}

export interface SendToApolloResponse {
  success: boolean;
  list_id: string;
  list_name: string;
  list_url: string;
  total_leads: number;
  contacts_added: number;
  leads_skipped: number;
  leads_without_data: number;
  apollo_dashboard_url: string;
}

// =============================================================================
// RATE LIMITING
// =============================================================================

export interface RateLimitStatus {
  service: string;
  endpoint: string;
  limit_per_minute: number;
  limit_per_hour: number;
  limit_per_day: number;
  current_minute_count: number;
  current_hour_count: number;
  current_day_count: number;
  can_proceed: boolean;
  wait_seconds?: number;
}

// =============================================================================
// COST TRACKING
// =============================================================================

export interface CostTrackingEntry {
  id: number;
  service: string;
  operation: string;
  credits_used: number;
  cost_usd: number;
  lead_id?: number;
  created_at: Date;
}

// =============================================================================
// ICP PRESET
// =============================================================================

export interface ICPPreset {
  id: string;
  name: string;
  search_mode: ApolloSearchMode;
  archetype: string;
  description: string;

  apollo_filters: ApolloSearchFilters;

  estimated_leads: number;
  validated_results?: number;

  pain_points: string[];
  use_cases: string[];

  primary_strategies: string[];
  secondary_strategies: string[];
  messaging_style: string;
}

// =============================================================================
// VALIDATION
// =============================================================================

export interface FilterValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized_filters?: ApolloSearchFilters;
}
