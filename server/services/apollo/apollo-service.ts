/**
 * Apollo.io API Service
 *
 * Production-ready Apollo.io integration with validated filter patterns.
 * Includes automatic sanitization of broken parameters and rate limiting.
 *
 * Reference: /docs/APOLLO_FILTER_PATTERNS_HANDOFF.md
 */

import {
  ApolloSearchFilters,
  ApolloSearchResponse,
  ApolloPreviewResponse,
  ApolloPerson,
  ApolloList,
  ApolloCreateListResponse,
  ApolloAddContactsResponse,
  ApolloEnrichRequest,
  ApolloEnrichResponse,
  FilterValidationResult,
  ApolloSearchMode,
} from './apollo-types';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * List prefix for namespace isolation
 * All lists created by this application will be prefixed with this value
 */
export const LIST_PREFIX = 'NoboxOutreach-';

/**
 * Apollo API base URL
 */
const APOLLO_BASE_URL = 'https://api.apollo.io/v1';

/**
 * Default request timeout (ms)
 */
const REQUEST_TIMEOUT = 30000;

/**
 * Maximum contacts per batch operation
 */
const MAX_BATCH_SIZE = 200;

/**
 * Delay between batch operations (ms) for rate limiting
 */
const BATCH_DELAY_MS = 1000;

// =============================================================================
// APOLLO SERVICE CLASS
// =============================================================================

export class ApolloService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.APOLLO_API_KEY || '';

    if (!this.apiKey) {
      console.warn('ApolloService: No API key provided. API calls will fail.');
    }
  }

  // ===========================================================================
  // FILTER VALIDATION & SANITIZATION
  // ===========================================================================

  /**
   * Validate and sanitize filters according to Apollo API requirements
   *
   * CRITICAL FIXES:
   * 1. q_organization_industry_tags is SILENTLY IGNORED - map to keyword_tags
   * 2. q_keywords cannot combine with structured filters - throws error
   * 3. Warns about overly broad filters
   */
  validateFilters(
    filters: ApolloSearchFilters,
    mode: ApolloSearchMode = 'structured'
  ): FilterValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitized: ApolloSearchFilters = { ...filters };

    // CRITICAL FIX: q_organization_industry_tags is SILENTLY IGNORED
    if (sanitized.q_organization_industry_tags) {
      warnings.push(
        'q_organization_industry_tags is ignored by Apollo API. Auto-mapping to q_organization_keyword_tags.'
      );

      // Merge into keyword_tags
      sanitized.q_organization_keyword_tags = [
        ...(sanitized.q_organization_keyword_tags || []),
        ...sanitized.q_organization_industry_tags,
      ];

      delete sanitized.q_organization_industry_tags;
    }

    // Remove deprecated organization_industry_tag_ids
    if (sanitized.organization_industry_tag_ids) {
      warnings.push(
        'organization_industry_tag_ids returns 0 results. Removing from filters.'
      );
      delete sanitized.organization_industry_tag_ids;
    }

    // CRITICAL: q_keywords cannot combine with structured filters
    if (mode === 'structured' && sanitized.q_keywords) {
      errors.push(
        'q_keywords cannot be used in structured mode. It returns 0 results when combined with person_titles or organization_num_employees_ranges. Use discovery mode instead.'
      );
    }

    if (mode === 'discovery') {
      // In discovery mode, structured filters should not be used
      if (sanitized.person_titles || sanitized.organization_num_employees_ranges) {
        errors.push(
          'In discovery mode, person_titles and organization_num_employees_ranges should not be used. They conflict with q_keywords.'
        );
      }
    }

    // Warn about broad filters
    if (sanitized.person_seniorities && !sanitized.q_organization_keyword_tags) {
      warnings.push(
        'person_seniorities alone is too broad. Consider adding q_organization_keyword_tags for precision.'
      );
    }

    // Warn about generic titles without industry context
    const genericTitles = ['CEO', 'Founder', 'Owner', 'Director', 'Manager', 'VP'];
    const hasGenericTitles = sanitized.person_titles?.some((title) =>
      genericTitles.some((generic) => title === generic)
    );

    if (hasGenericTitles && !sanitized.q_organization_keyword_tags) {
      warnings.push(
        'Generic titles (CEO, Founder, etc.) match millions. Add q_organization_keyword_tags for precision.'
      );
    }

    // Ensure verified email status by default
    if (!sanitized.contact_email_status) {
      sanitized.contact_email_status = ['verified'];
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitized_filters: errors.length === 0 ? sanitized : undefined,
    };
  }

  // ===========================================================================
  // SEARCH OPERATIONS
  // ===========================================================================

  /**
   * Search for people in Apollo database
   */
  async searchPeople(
    filters: ApolloSearchFilters,
    page: number = 1,
    perPage: number = 25,
    mode: ApolloSearchMode = 'structured'
  ): Promise<ApolloSearchResponse> {
    // Validate and sanitize filters
    const validation = this.validateFilters(filters, mode);

    if (!validation.valid) {
      throw new Error(`Invalid filters: ${validation.errors.join('; ')}`);
    }

    if (validation.warnings.length > 0) {
      console.warn('Apollo filter warnings:', validation.warnings);
    }

    const payload = {
      ...validation.sanitized_filters,
      page,
      per_page: perPage,
    };

    const response = await this.makeRequest('/mixed_people/search', 'POST', payload);

    return {
      people: response.people || [],
      pagination: response.pagination || {
        page,
        per_page: perPage,
        total_entries: 0,
        total_pages: 0,
      },
    };
  }

  /**
   * Preview search results without storing
   */
  async previewSearch(
    filters: ApolloSearchFilters,
    mode: ApolloSearchMode = 'structured'
  ): Promise<ApolloPreviewResponse> {
    const validation = this.validateFilters(filters, mode);

    if (!validation.valid) {
      throw new Error(`Invalid filters: ${validation.errors.join('; ')}`);
    }

    // Get small sample for preview
    const response = await this.searchPeople(validation.sanitized_filters!, 1, 10, mode);

    // Calculate quality metrics
    const verifiedCount = response.people.filter(
      (p) => p.email_status === 'verified'
    ).length;

    const verificationRate =
      response.people.length > 0
        ? (verifiedCount / response.people.length) * 100
        : 0;

    // Estimate search quality score (0-100)
    const hasIndustryKeywords = !!validation.sanitized_filters?.q_organization_keyword_tags;
    const hasSpecificTitles = (validation.sanitized_filters?.person_titles?.length || 0) > 0;
    const hasLocationFilter = !!validation.sanitized_filters?.person_locations;
    const hasSizeFilter = !!validation.sanitized_filters?.organization_num_employees_ranges;

    let qualityScore = 50;
    if (hasIndustryKeywords) qualityScore += 20;
    if (hasSpecificTitles) qualityScore += 15;
    if (hasLocationFilter) qualityScore += 10;
    if (hasSizeFilter) qualityScore += 5;
    qualityScore = Math.min(100, qualityScore);

    // Estimate cost (search is $0.01 per 100, enrichment is $0.01-$0.03 per record)
    const estimatedCost = (response.pagination.total_entries / 100) * 0.01;

    return {
      success: true,
      preview: true,
      total_available: response.pagination.total_entries,
      sample_count: response.people.length,
      estimated_cost_usd: Math.round(estimatedCost * 100) / 100,
      search_quality_score: qualityScore,
      email_verification_rate: Math.round(verificationRate * 10) / 10,
      verified_emails_in_sample: verifiedCount,
      sample_leads: response.people,
      filters_used: validation.sanitized_filters!,
    };
  }

  // ===========================================================================
  // LIST OPERATIONS
  // ===========================================================================

  /**
   * Create a new contact list
   * Automatically prefixes with LIST_PREFIX for namespace isolation
   */
  async createContactList(name: string): Promise<ApolloList> {
    // Auto-prefix with namespace
    const prefixedName = name.startsWith(LIST_PREFIX) ? name : `${LIST_PREFIX}${name}`;

    const payload = {
      name: prefixedName,
      modality: 'contacts', // CRITICAL: Must use "contacts"
    };

    const response: ApolloCreateListResponse = await this.makeRequest(
      '/labels',
      'POST',
      payload
    );

    return {
      id: response.label.id,
      name: response.label.name,
      display_name: response.label.name.replace(LIST_PREFIX, ''),
      modality: 'contacts',
      cached_count: 0,
      created_at: response.label.created_at,
    };
  }

  /**
   * Get all contact lists owned by this application
   * Filters to only lists with LIST_PREFIX
   */
  async getContactLists(): Promise<ApolloList[]> {
    const response = await this.makeRequest('/labels', 'GET');

    // Filter to application-owned lists only
    const lists: ApolloList[] = (response || [])
      .filter(
        (item: any) =>
          item.modality === 'contacts' && item.name?.startsWith(LIST_PREFIX)
      )
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        display_name: item.name.replace(LIST_PREFIX, ''),
        modality: 'contacts',
        cached_count: item.cached_count || 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

    return lists;
  }

  /**
   * Add contacts to list by email
   * Use for search results (people not yet in CRM)
   */
  async addContactsToListByEmail(
    listId: string,
    contactEmails: string[]
  ): Promise<ApolloAddContactsResponse> {
    if (contactEmails.length > MAX_BATCH_SIZE) {
      // Batch processing
      return this.addContactsToListByEmailBatched(listId, contactEmails);
    }

    const payload = {
      contact_list_id: listId,
      contact_emails: contactEmails,
    };

    await this.makeRequest('/contact_lists/add_contacts', 'POST', payload);

    return {
      success: true,
      contacts_added: contactEmails.length,
      list_id: listId,
    };
  }

  /**
   * Add contacts to list by contact ID
   * Use for contacts already in Apollo CRM
   */
  async addContactsToList(
    listId: string,
    contactIds: string[]
  ): Promise<ApolloAddContactsResponse> {
    if (contactIds.length > MAX_BATCH_SIZE) {
      return this.addContactsToListBatched(listId, contactIds);
    }

    const payload = {
      contact_ids: contactIds,
      label_ids: [listId],
    };

    await this.makeRequest('/contacts/bulk_update', 'POST', payload);

    return {
      success: true,
      contacts_added: contactIds.length,
      list_id: listId,
    };
  }

  /**
   * Create contact and add to list in one API call
   * Apollo auto-creates list if it doesn't exist
   */
  async createContactWithLabels(
    firstName: string,
    lastName: string,
    title: string,
    organizationName: string,
    labelNames: string[]
  ): Promise<ApolloPerson> {
    // Auto-prefix all labels
    const prefixedLabels = labelNames.map((name) =>
      name.startsWith(LIST_PREFIX) ? name : `${LIST_PREFIX}${name}`
    );

    const payload = {
      first_name: firstName,
      last_name: lastName,
      title,
      organization_name: organizationName,
      label_names: prefixedLabels,
    };

    const response = await this.makeRequest('/contacts', 'POST', payload);

    return response.contact;
  }

  /**
   * Delete a contact list
   * Safety check: Only allows deletion of lists with LIST_PREFIX
   */
  async deleteContactList(listId: string): Promise<boolean> {
    // Validate ownership before deletion
    const existingLists = await this.getContactLists();
    const targetList = existingLists.find((l) => l.id === listId);

    if (!targetList) {
      throw new Error(
        `List ${listId} not found or not owned by this application. ` +
          `Only lists with '${LIST_PREFIX}' prefix can be deleted.`
      );
    }

    await this.makeRequest(`/labels/${listId}`, 'DELETE');

    return true;
  }

  // ===========================================================================
  // BATCH OPERATIONS (Private)
  // ===========================================================================

  private async addContactsToListByEmailBatched(
    listId: string,
    contactEmails: string[]
  ): Promise<ApolloAddContactsResponse> {
    let totalAdded = 0;
    let failedBatches = 0;

    for (let i = 0; i < contactEmails.length; i += MAX_BATCH_SIZE) {
      const batch = contactEmails.slice(i, i + MAX_BATCH_SIZE);

      try {
        const payload = {
          contact_list_id: listId,
          contact_emails: batch,
        };

        await this.makeRequest('/contact_lists/add_contacts', 'POST', payload);
        totalAdded += batch.length;
      } catch (error) {
        console.error(`Batch ${i / MAX_BATCH_SIZE + 1} failed:`, error);
        failedBatches++;
      }

      // Rate limiting delay
      if (i + MAX_BATCH_SIZE < contactEmails.length) {
        await this.delay(BATCH_DELAY_MS);
      }
    }

    return {
      success: failedBatches === 0,
      contacts_added: totalAdded,
      list_id: listId,
    };
  }

  private async addContactsToListBatched(
    listId: string,
    contactIds: string[]
  ): Promise<ApolloAddContactsResponse> {
    let totalAdded = 0;
    let failedBatches = 0;

    for (let i = 0; i < contactIds.length; i += MAX_BATCH_SIZE) {
      const batch = contactIds.slice(i, i + MAX_BATCH_SIZE);

      try {
        const payload = {
          contact_ids: batch,
          label_ids: [listId],
        };

        await this.makeRequest('/contacts/bulk_update', 'POST', payload);
        totalAdded += batch.length;
      } catch (error) {
        console.error(`Batch ${i / MAX_BATCH_SIZE + 1} failed:`, error);
        failedBatches++;
      }

      // Rate limiting delay
      if (i + MAX_BATCH_SIZE < contactIds.length) {
        await this.delay(BATCH_DELAY_MS);
      }
    }

    return {
      success: failedBatches === 0,
      contacts_added: totalAdded,
      list_id: listId,
    };
  }

  // ===========================================================================
  // ENRICHMENT OPERATIONS
  // ===========================================================================

  /**
   * Enrich a single person
   * Uses 1 credit (email) or 2 credits (email + phone)
   */
  async enrichPerson(request: ApolloEnrichRequest): Promise<ApolloEnrichResponse> {
    const payload: Record<string, any> = {};

    if (request.first_name) payload.first_name = request.first_name;
    if (request.last_name) payload.last_name = request.last_name;
    if (request.email) payload.email = request.email;
    if (request.linkedin_url) payload.linkedin_url = request.linkedin_url;
    if (request.organization_name) payload.organization_name = request.organization_name;
    if (request.domain) payload.domain = request.domain;
    if (request.reveal_phone) payload.reveal_phone_number = true;

    const response = await this.makeRequest('/people/match', 'POST', payload);

    return {
      person: response.person,
      credits_used: request.reveal_phone ? 2 : 1,
    };
  }

  /**
   * Bulk enrich multiple people
   * Includes rate limiting delay between calls
   */
  async bulkEnrich(
    requests: ApolloEnrichRequest[]
  ): Promise<ApolloEnrichResponse[]> {
    const results: ApolloEnrichResponse[] = [];

    for (let i = 0; i < requests.length; i++) {
      try {
        const result = await this.enrichPerson(requests[i]);
        results.push(result);
      } catch (error) {
        console.error(`Enrichment failed for request ${i}:`, error);
        results.push({
          person: {} as ApolloPerson,
          credits_used: 0,
        });
      }

      // Rate limiting: 0.3s delay between calls
      if (i < requests.length - 1) {
        await this.delay(300);
      }
    }

    return results;
  }

  // ===========================================================================
  // HTTP CLIENT
  // ===========================================================================

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Apollo API key not configured');
    }

    const url = `${APOLLO_BASE_URL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': this.apiKey,
    };

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Apollo API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      // DELETE requests may not return JSON
      if (method === 'DELETE') {
        return { success: true };
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error(`Apollo API request timed out after ${REQUEST_TIMEOUT}ms`);
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get the list prefix
   */
  getListPrefix(): string {
    return LIST_PREFIX;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let apolloServiceInstance: ApolloService | null = null;

export function getApolloService(): ApolloService {
  if (!apolloServiceInstance) {
    apolloServiceInstance = new ApolloService();
  }
  return apolloServiceInstance;
}

export function createApolloService(apiKey: string): ApolloService {
  return new ApolloService(apiKey);
}
