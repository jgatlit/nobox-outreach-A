/**
 * ICP (Ideal Customer Profile) Presets with Apollo Filter Mapping
 *
 * Based on:
 * - 6 Detailed ICPs from research/6 Ideal Customer Profiles.md
 * - Validated Apollo filter patterns from APOLLO_FILTER_PATTERNS_HANDOFF.md
 *
 * CRITICAL IMPLEMENTATION NOTES:
 * 1. Uses q_organization_keyword_tags (NOT q_organization_industry_tags - it's BROKEN)
 * 2. All presets use "structured" search mode
 * 3. Uses specific role titles, not generic ones
 * 4. Always includes contact_email_status: ["verified"]
 */

import { ICPPreset, ApolloSearchFilters } from '../services/apollo/apollo-types';

// =============================================================================
// SENIORITY EXPANSION MAPPING
// =============================================================================

/**
 * Seniority to explicit title expansion
 * Validated: 93.4% improvement in results when expanding seniorities to titles
 * Use this OR seniority + keywords, NOT both combined
 */
export const SENIORITY_EXPANSION: Record<string, string[]> = {
  c_suite: [
    'CEO', 'CFO', 'CTO', 'COO', 'President',
    'Chief Executive Officer', 'Chief Financial Officer',
    'Chief Technology Officer', 'Chief Operating Officer',
    'Chief Information Officer', 'CIO',
    'Chief Marketing Officer', 'CMO',
    'Chief Product Officer', 'CPO',
    'Chief Revenue Officer', 'CRO',
    'Chief Data Officer', 'CDO',
  ],
  vp: [
    'VP', 'Vice President', 'SVP', 'Senior Vice President',
    'VP of', 'Vice President of', 'EVP', 'Executive Vice President',
  ],
  director: [
    'Director', 'Director of', 'Senior Director',
    'Managing Director', 'Executive Director',
  ],
  manager: [
    'Manager', 'Senior Manager', 'Manager of',
    'Engineering Manager', 'Product Manager',
    'Program Manager', 'Project Manager',
  ],
  senior: [
    'Senior', 'Sr', 'Lead', 'Principal',
    'Staff', 'Senior Engineer', 'Lead Engineer',
  ],
};

// =============================================================================
// ICP PRESETS DEFINITIONS
// =============================================================================

export const ICP_PRESETS: Record<string, ICPPreset> = {
  // -------------------------------------------------------------------------
  // ICP 1: Workers Compensation Law Firms
  // -------------------------------------------------------------------------
  workers_comp_law_firms: {
    id: 'workers_comp_law_firms',
    name: 'Workers Comp Law Firms',
    search_mode: 'structured',
    archetype: 'Time-Starved Expert',
    description:
      'Workers compensation law firms in Georgia seeking automation for case intake, client communication, and knowledge management',

    apollo_filters: {
      // SPECIFIC role titles - not generic
      person_titles: [
        'Managing Partner',
        'Senior Partner',
        'Founding Attorney',
        'Practice Director',
        'Office Managing Partner',
        'Partner',
        'Of Counsel',
      ],
      // CRITICAL: Use q_organization_keyword_tags (NOT industry_tags!)
      q_organization_keyword_tags: [
        'law firm',
        'legal services',
        'workers compensation',
        'personal injury law',
        'employment law',
        'disability law',
      ],
      organization_num_employees_ranges: ['11,50', '51,200'],
      person_locations: ['Georgia, United States', 'United States'],
      contact_email_status: ['verified'],
    },

    estimated_leads: 5000,
    pain_points: [
      'Case intake overload (15-20 hrs/week)',
      'Client communication gaps (50-100+ calls/week)',
      'Knowledge silos across systems',
      'Document processing bottlenecks',
      'Lack of centralized listserv platform',
    ],
    use_cases: [
      'Intelligent case intake & qualification',
      'Client self-service portal with RAG',
      'Legal research & precedent retrieval',
      'Peer collaboration platform',
    ],

    primary_strategies: ['pattern_disruption', 'loss_aversion'],
    secondary_strategies: ['ego_relevance'],
    messaging_style: 'Direct, ROI-focused, respect for expertise',
  },

  // -------------------------------------------------------------------------
  // ICP 2: Holistic Medicine Practitioners
  // -------------------------------------------------------------------------
  holistic_practitioners: {
    id: 'holistic_practitioners',
    name: 'Holistic Medicine Practitioners',
    search_mode: 'structured',
    archetype: 'Purpose-Driven Creator',
    description:
      'Independent holistic health practitioners and functional medicine clinics struggling to scale personalized care',

    apollo_filters: {
      person_titles: [
        'Founder',
        'Owner',
        'Medical Director',
        'Clinical Director',
        'Chief Medical Officer',
        'Practice Owner',
        'Clinic Director',
        'Wellness Director',
      ],
      q_organization_keyword_tags: [
        'functional medicine',
        'naturopathy',
        'holistic health',
        'wellness center',
        'integrative medicine',
        'alternative medicine',
        'health coaching',
        'acupuncture',
      ],
      organization_num_employees_ranges: ['1,10', '11,50'],
      person_locations: ['United States'],
      contact_email_status: ['verified'],
    },

    estimated_leads: 20000,
    pain_points: [
      'Content creation bottleneck',
      'Client education overload',
      'Marketing inconsistency',
      'Course development challenges',
      'Client onboarding friction',
      'Limited revenue streams',
    ],
    use_cases: [
      'AI-powered content repurposing engine',
      'Personalized health protocol chatbot',
      'Automated course creation system',
      'Patient acquisition & nurture automation',
    ],

    primary_strategies: ['ego_relevance', 'curiosity_gap'],
    secondary_strategies: ['social_proof'],
    messaging_style: 'Aligned with mission, emphasize reach multiplication',
  },

  // -------------------------------------------------------------------------
  // ICP 3: Early-Stage Startups & Fundraisers
  // -------------------------------------------------------------------------
  early_stage_startups: {
    id: 'early_stage_startups',
    name: 'Early-Stage Startups & Fundraisers',
    search_mode: 'structured',
    archetype: 'Visionary Bottleneck',
    description:
      'Pre-seed to Series A startups needing credibility, investor engagement, and operational scaling',

    apollo_filters: {
      person_titles: [
        'CEO',
        'Founder',
        'Co-Founder',
        'President',
        'Chief Executive Officer',
      ],
      q_organization_keyword_tags: [
        'startup',
        'SaaS',
        'technology startup',
        'venture backed',
        'tech company',
        'software company',
        'B2B',
      ],
      organization_num_employees_ranges: ['1,10', '11,50'],
      funding_stage_list: ['seed', 'series_a'],
      person_locations: ['United States'],
      contact_email_status: ['verified'],
    },

    estimated_leads: 100000,
    pain_points: [
      'Investor engagement inefficiency',
      'Credibility gap',
      'Community management at scale',
      'Fundraising time waste',
      'Information overload for investors',
      'Fit assessment challenges',
    ],
    use_cases: [
      'Intelligent IR portal with AI ambassador',
      'Automated investor matchmaking',
      'Dynamic community engagement platform',
      'Thought leadership content engine',
    ],

    primary_strategies: ['social_proof', 'loss_aversion'],
    secondary_strategies: ['curiosity_gap'],
    messaging_style: 'Peer examples, urgency, competitive positioning',
  },

  // -------------------------------------------------------------------------
  // ICP 4: Training & Enablement Consulting
  // -------------------------------------------------------------------------
  training_enablement_firms: {
    id: 'training_enablement_firms',
    name: 'Training & Enablement Consulting',
    search_mode: 'structured',
    archetype: 'Methodology Owner',
    description:
      'Professional services firms specializing in training, sales enablement, and technology implementation',

    apollo_filters: {
      person_titles: [
        'Founder',
        'CEO',
        'Managing Director',
        'VP of Services',
        'Principal Consultant',
        'Director of Consulting',
        'Practice Lead',
        'Head of Training',
      ],
      q_organization_keyword_tags: [
        'training company',
        'sales enablement',
        'consulting firm',
        'change management',
        'implementation services',
        'professional services',
        'corporate training',
        'learning and development',
      ],
      organization_num_employees_ranges: ['11,50', '51,200'],
      person_locations: ['United States'],
      contact_email_status: ['verified'],
    },

    estimated_leads: 30000,
    pain_points: [
      'Delivery scalability limits',
      'Methodology commoditization',
      'Client onboarding friction',
      'Productization challenges',
      'Training content staleness',
      'Team knowledge silos',
    ],
    use_cases: [
      'Client success SaaS platform',
      'AI-powered pocket consultant',
      'Automated needs assessment',
      'Dynamic training content management',
    ],

    primary_strategies: ['ego_relevance', 'pattern_disruption'],
    secondary_strategies: ['social_proof'],
    messaging_style: 'Respect IP, emphasize leverage, SaaS opportunity',
  },

  // -------------------------------------------------------------------------
  // ICP 5: Executive Coaching Firms
  // -------------------------------------------------------------------------
  executive_coaching: {
    id: 'executive_coaching',
    name: 'Executive Coaching Firms',
    search_mode: 'structured',
    archetype: 'High-Touch Perfectionist',
    description:
      'High-touch coaching practices serving executives who need to scale impact without sacrificing personalization',

    apollo_filters: {
      person_titles: [
        'Founder',
        'Principal Coach',
        'Executive Coach',
        'Managing Partner',
        'Leadership Coach',
        'Business Coach',
        'Senior Coach',
        'Practice Principal',
      ],
      q_organization_keyword_tags: [
        'executive coaching',
        'leadership development',
        'business coaching',
        'executive advisory',
        'leadership coaching',
        'executive development',
        'CEO coaching',
        'C-suite advisory',
      ],
      organization_num_employees_ranges: ['1,10', '11,50'],
      person_locations: ['United States'],
      contact_email_status: ['verified'],
    },

    estimated_leads: 15000,
    pain_points: [
      'Delivery constraints (1:1 time)',
      'Qualification inefficiency',
      'Content multiplication gap',
      'Community scaling challenges',
      'Client acquisition inefficiency',
      'Thought leadership gap',
    ],
    use_cases: [
      'Intelligent client qualification',
      'Session intelligence platform',
      'AI-powered pocket coach',
      'Content repurposing engine',
    ],

    primary_strategies: ['ego_relevance', 'curiosity_gap'],
    secondary_strategies: ['pattern_disruption'],
    messaging_style: 'Quality-first, client outcome focus, exclusivity',
  },

  // -------------------------------------------------------------------------
  // ICP 6: Creative & Marketing Agencies
  // -------------------------------------------------------------------------
  creative_agencies: {
    id: 'creative_agencies',
    name: 'Creative & Marketing Agencies',
    search_mode: 'structured',
    archetype: 'Creative-Operational Hybrid',
    description:
      'Creative agencies and digital marketing firms struggling with client onboarding, efficiency, and scaling',

    apollo_filters: {
      person_titles: [
        'Founder',
        'CEO',
        'Creative Director',
        'Managing Director',
        'VP of Operations',
        'Agency Owner',
        'Partner',
        'Chief Creative Officer',
      ],
      q_organization_keyword_tags: [
        'creative agency',
        'digital marketing agency',
        'branding agency',
        'advertising agency',
        'marketing firm',
        'design agency',
        'content agency',
        'social media agency',
      ],
      organization_num_employees_ranges: ['11,50', '51,200'],
      person_locations: ['United States'],
      contact_email_status: ['verified'],
    },

    estimated_leads: 50000,
    pain_points: [
      'Client onboarding chaos (15-20 hrs/client)',
      'Creative team bottleneck',
      'Reporting overhead (10-15 hrs/month)',
      'White-label opportunity gap',
      'Project management friction',
      'Productization challenges',
    ],
    use_cases: [
      'AI-powered client onboarding',
      'Automated creative production',
      'Campaign performance reporting',
      'White-label AI automation services',
    ],

    primary_strategies: ['social_proof', 'pattern_disruption'],
    secondary_strategies: ['loss_aversion'],
    messaging_style: 'Case studies, efficiency gains, white-label opportunity',
  },
};

// =============================================================================
// PRESET ACCESS FUNCTIONS
// =============================================================================

/**
 * Get a single ICP preset by key
 */
export function getPreset(presetKey: string): ICPPreset | undefined {
  return ICP_PRESETS[presetKey];
}

/**
 * Get all preset keys
 */
export function getPresetKeys(): string[] {
  return Object.keys(ICP_PRESETS);
}

/**
 * List all presets with summary info
 */
export function listPresets(): {
  total_presets: number;
  presets: Record<string, {
    name: string;
    archetype: string;
    description: string;
    estimated_leads: number;
    search_mode: string;
  }>;
} {
  const presets: Record<string, any> = {};

  for (const [key, preset] of Object.entries(ICP_PRESETS)) {
    presets[key] = {
      name: preset.name,
      archetype: preset.archetype,
      description: preset.description,
      estimated_leads: preset.estimated_leads,
      search_mode: preset.search_mode,
    };
  }

  return {
    total_presets: Object.keys(presets).length,
    presets,
  };
}

/**
 * Get Apollo-ready filters for a preset
 * Returns sanitized filters ready for API call
 */
export function getFiltersForPreset(presetKey: string): ApolloSearchFilters | undefined {
  const preset = ICP_PRESETS[presetKey];
  if (!preset) return undefined;

  // Return a copy of the filters
  return { ...preset.apollo_filters };
}

/**
 * Get preset metadata for AI prompt generation
 */
export function getPresetMetadata(presetKey: string): {
  archetype: string;
  pain_points: string[];
  use_cases: string[];
  messaging_style: string;
  primary_strategies: string[];
  secondary_strategies: string[];
} | undefined {
  const preset = ICP_PRESETS[presetKey];
  if (!preset) return undefined;

  return {
    archetype: preset.archetype,
    pain_points: preset.pain_points,
    use_cases: preset.use_cases,
    messaging_style: preset.messaging_style,
    primary_strategies: preset.primary_strategies,
    secondary_strategies: preset.secondary_strategies,
  };
}

/**
 * Expand seniority levels to explicit titles
 * Use when you want to use titles instead of seniority levels
 */
export function expandSeniorities(seniorities: string[]): string[] {
  const expanded: string[] = [];

  for (const seniority of seniorities) {
    const titles = SENIORITY_EXPANSION[seniority];
    if (titles) {
      expanded.push(...titles);
    }
  }

  return Array.from(new Set(expanded)); // Deduplicate
}

/**
 * Get recommended psychological strategies for an ICP
 */
export function getStrategiesForICP(presetKey: string): {
  primary: string[];
  secondary: string[];
} | undefined {
  const preset = ICP_PRESETS[presetKey];
  if (!preset) return undefined;

  return {
    primary: preset.primary_strategies,
    secondary: preset.secondary_strategies,
  };
}

/**
 * Get pain triggers for personalization
 */
export function getPainTriggers(presetKey: string): string[] | undefined {
  const preset = ICP_PRESETS[presetKey];
  if (!preset) return undefined;

  return preset.pain_points;
}

/**
 * Validate that a preset's filters are correct
 * Returns any issues found
 */
export function validatePresetFilters(presetKey: string): {
  valid: boolean;
  issues: string[];
} {
  const preset = ICP_PRESETS[presetKey];
  const issues: string[] = [];

  if (!preset) {
    return { valid: false, issues: ['Preset not found'] };
  }

  const filters = preset.apollo_filters;

  // Check for broken parameters
  if ((filters as any).q_organization_industry_tags) {
    issues.push('Uses q_organization_industry_tags (BROKEN - should use q_organization_keyword_tags)');
  }

  // Check for industry keywords
  if (!filters.q_organization_keyword_tags || filters.q_organization_keyword_tags.length === 0) {
    issues.push('Missing q_organization_keyword_tags (required for precision)');
  }

  // Check for email verification
  if (!filters.contact_email_status || !filters.contact_email_status.includes('verified')) {
    issues.push('Missing verified email filter');
  }

  // Check for location
  if (!filters.person_locations || filters.person_locations.length === 0) {
    issues.push('Missing location filter');
  }

  // Check for q_keywords mixing (should not be present in structured mode)
  if (preset.search_mode === 'structured' && filters.q_keywords) {
    issues.push('q_keywords present in structured mode (will fail)');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// =============================================================================
// VALIDATION ON MODULE LOAD
// =============================================================================

// Validate all presets on load
const presetValidation = Object.keys(ICP_PRESETS).map((key) => ({
  preset: key,
  ...validatePresetFilters(key),
}));

const invalidPresets = presetValidation.filter((p) => !p.valid);
if (invalidPresets.length > 0) {
  console.warn('Invalid ICP presets detected:', invalidPresets);
}
