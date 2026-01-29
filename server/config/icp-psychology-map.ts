/**
 * ICP-to-Psychology Mapping System
 *
 * Maps Ideal Customer Profile archetypes to psychological persuasion strategies
 * for optimal personalized email generation.
 *
 * This is the highest-value innovation - connecting Apollo-discovered leads
 * to psychologically-optimized outreach based on their ICP archetype.
 *
 * Integration Points:
 * - ICP Presets (./icp-presets.ts)
 * - Orchestrator Client (../../services/orchestrator-client.ts)
 * - Email Generation (../../openai.ts)
 */

import {
  ICP_PRESETS,
  getPresetMetadata,
  getStrategiesForICP,
  getPainTriggers,
} from './icp-presets';

// =============================================================================
// PSYCHOLOGICAL STRATEGY DEFINITIONS
// =============================================================================

/**
 * Complete definition of each psychological strategy
 * with application guidelines and example patterns
 */
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
  avoid_with: string[];  // Archetypes where this strategy underperforms
  effectiveness_multiplier: number;  // Base effectiveness score 0.0-2.0
}

export const PSYCHOLOGICAL_STRATEGIES: Record<string, PsychologicalStrategy> = {
  pattern_disruption: {
    id: 'pattern_disruption',
    name: 'Pattern Disruption',
    description: 'Breaks expected patterns to capture attention and create cognitive engagement',
    core_mechanism: 'Interrupt autopilot mode with unexpected framing or counterintuitive insights',
    best_for_archetypes: ['Time-Starved Expert', 'Methodology Owner', 'Creative-Operational Hybrid'],
    email_patterns: {
      subject_line_patterns: [
        'What if [common assumption] is wrong?',
        'The [role/industry] paradox nobody talks about',
        'Why [expected advice] might be hurting [outcome]',
        '[Number] things your competitors won\'t tell you about [topic]',
      ],
      opening_hooks: [
        'Most [role]s assume [common belief]. What if the opposite were true?',
        'I recently spoke with a [peer title] who discovered something counterintuitive...',
        'The conventional wisdom about [topic] is actually backwards.',
      ],
      call_to_action_patterns: [
        'Curious if this applies to [company]?',
        'I\'d love to share what we found - worth a 10-minute conversation?',
        'Want to see how [peer company] handled this?',
      ],
    },
    trigger_words: ['actually', 'counterintuitive', 'paradox', 'myth', 'contrary', 'rethink'],
    avoid_with: ['Visionary Bottleneck'],  // They already think differently
    effectiveness_multiplier: 1.4,
  },

  ego_relevance: {
    id: 'ego_relevance',
    name: 'Ego Relevance',
    description: 'Validates expertise and identity while positioning the offer as an extension of their capabilities',
    core_mechanism: 'Stroke professional ego and position solution as enhancement, not replacement',
    best_for_archetypes: ['Time-Starved Expert', 'Methodology Owner', 'High-Touch Perfectionist', 'Purpose-Driven Creator'],
    email_patterns: {
      subject_line_patterns: [
        'Your [expertise area] expertise + [capability] = [outcome]',
        'Scaling [their specialty] without compromising quality',
        'For [role]s who refuse to accept mediocrity',
        '[Peer reference]: How to amplify your [methodology/approach]',
      ],
      opening_hooks: [
        'Your work in [specific area] caught my attention...',
        'Very few [role]s have your depth of experience in [specialty].',
        'I\'ve been following [their work/company] and noticed something unique about your approach...',
      ],
      call_to_action_patterns: [
        'Would love to understand your philosophy on [relevant topic].',
        'How do you currently handle [challenge they face]?',
        'I\'d value your perspective on whether this aligns with your standards.',
      ],
    },
    trigger_words: ['your expertise', 'your approach', 'your philosophy', 'amplify', 'extend', 'enhance'],
    avoid_with: [],  // Works broadly
    effectiveness_multiplier: 1.3,
  },

  loss_aversion: {
    id: 'loss_aversion',
    name: 'Loss Aversion',
    description: 'Frames the status quo as costlier than change, emphasizing what\'s being lost',
    core_mechanism: 'People feel losses 2x more than equivalent gains - highlight what they\'re losing daily',
    best_for_archetypes: ['Time-Starved Expert', 'Visionary Bottleneck', 'Creative-Operational Hybrid'],
    email_patterns: {
      subject_line_patterns: [
        'The hidden cost of [current approach] at [company]',
        '[X hours/week] you\'re losing to [inefficiency]',
        'What [competitor/peer] stopped losing last quarter',
        'The [specific metric] leak nobody notices',
      ],
      opening_hooks: [
        'By our calculations, [role]s like you lose [X hours/dollars] weekly to [problem].',
        '[Peer company] was losing [metric] until they discovered...',
        'Every day without [solution], [company] is likely missing [opportunity].',
      ],
      call_to_action_patterns: [
        'Want to see where [company] might be leaving money on the table?',
        'I can show you exactly what this costs in 15 minutes.',
        'Curious what your [metric] recovery could look like?',
      ],
    },
    trigger_words: ['losing', 'cost', 'leak', 'drain', 'missing out', 'falling behind'],
    avoid_with: ['Purpose-Driven Creator'],  // They respond better to positive framing
    effectiveness_multiplier: 1.5,
  },

  curiosity_gap: {
    id: 'curiosity_gap',
    name: 'Curiosity Gap',
    description: 'Creates information asymmetry that compels engagement to close the gap',
    core_mechanism: 'Open a loop in their mind that demands closure - promise resolution',
    best_for_archetypes: ['Purpose-Driven Creator', 'Visionary Bottleneck', 'High-Touch Perfectionist'],
    email_patterns: {
      subject_line_patterns: [
        'The [topic] secret [peer company] doesn\'t share publicly',
        'What [industry leader] does differently (and why it works)',
        'I found something interesting about [their company/industry]',
        'Quick question about [specific observation]',
      ],
      opening_hooks: [
        'I came across something interesting while researching [their space]...',
        'There\'s a pattern I\'ve noticed among top-performing [role]s...',
        '[Peer name] shared something last week that made me think of you...',
      ],
      call_to_action_patterns: [
        'Happy to share what I found if you\'re curious.',
        'Want me to send over the full analysis?',
        'Would it be useful to see how others are approaching this?',
      ],
    },
    trigger_words: ['discovered', 'found', 'interesting', 'curious', 'secret', 'revealed'],
    avoid_with: ['Time-Starved Expert'],  // They want direct answers, not teasers
    effectiveness_multiplier: 1.2,
  },

  social_proof: {
    id: 'social_proof',
    name: 'Social Proof',
    description: 'Leverages peer behavior and success stories to reduce perceived risk',
    core_mechanism: 'Show that similar people have successfully adopted this - safety in numbers',
    best_for_archetypes: ['Visionary Bottleneck', 'Creative-Operational Hybrid', 'Methodology Owner'],
    email_patterns: {
      subject_line_patterns: [
        'How [similar company] solved [their problem]',
        '[X] [similar role]s now using [solution] for [outcome]',
        '[Competitor] just made an interesting move...',
        'What [industry peer] learned about [topic]',
      ],
      opening_hooks: [
        'Just wrapped a project with [peer company] that reminded me of [their situation]...',
        'I\'ve been working with [X number] [similar role]s on [challenge]...',
        '[Peer name at peer company] faced the exact same challenge last quarter...',
      ],
      call_to_action_patterns: [
        'Want me to introduce you to [peer] who\'s been through this?',
        'I can share the case study if you\'re interested.',
        'Would a peer perspective be helpful?',
      ],
    },
    trigger_words: ['others', 'companies like yours', 'peer', 'similar', 'case study', 'success story'],
    avoid_with: ['Time-Starved Expert'],  // They trust their own expertise
    effectiveness_multiplier: 1.35,
  },
};

// =============================================================================
// ICP ARCHETYPE DEFINITIONS
// =============================================================================

/**
 * Detailed archetype characteristics for strategy matching
 */
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

export const ARCHETYPE_PROFILES: Record<string, ArchetypeProfile> = {
  'Time-Starved Expert': {
    id: 'time_starved_expert',
    name: 'Time-Starved Expert',
    core_characteristics: [
      'Deep domain expertise',
      'Overwhelmed with operational demands',
      'Values efficiency above all',
      'Respects competence, dismisses fluff',
    ],
    decision_drivers: [
      'ROI clarity',
      'Time savings quantification',
      'Peer validation from respected peers',
      'Quick implementation path',
    ],
    communication_preferences: {
      tone: 'direct and respectful',
      length: 'brief',
      formality: 'professional',
      data_preference: 'metrics',
    },
    response_triggers: [
      'Specific time savings',
      'Peer success stories',
      'Recognition of their expertise',
    ],
    objection_patterns: [
      'No time to evaluate',
      'Tried similar before',
      'Too complicated to implement',
    ],
    optimal_cta_types: [
      '15-minute diagnostic call',
      'ROI calculator access',
      'Case study review',
    ],
  },

  'Purpose-Driven Creator': {
    id: 'purpose_driven_creator',
    name: 'Purpose-Driven Creator',
    core_characteristics: [
      'Mission-focused',
      'Values authenticity',
      'Wants to scale impact, not just revenue',
      'Creative but operationally challenged',
    ],
    decision_drivers: [
      'Mission alignment',
      'Reach multiplication',
      'Authenticity preservation',
      'Community building',
    ],
    communication_preferences: {
      tone: 'warm and aligned',
      length: 'moderate',
      formality: 'casual',
      data_preference: 'narrative',
    },
    response_triggers: [
      'Understanding of their mission',
      'Reach amplification',
      'Preservation of their voice',
    ],
    objection_patterns: [
      'Will this feel authentic?',
      'Does this align with my values?',
      'Will my community accept this?',
    ],
    optimal_cta_types: [
      'Mission alignment conversation',
      'Sample of their content amplified',
      'Community success stories',
    ],
  },

  'Visionary Bottleneck': {
    id: 'visionary_bottleneck',
    name: 'Visionary Bottleneck',
    core_characteristics: [
      'Big-picture thinker',
      'Frustrated by execution constraints',
      'Resource-constrained',
      'Seeking credibility accelerators',
    ],
    decision_drivers: [
      'Competitive advantage',
      'Credibility signals',
      'Investor/stakeholder impression',
      'Speed to market',
    ],
    communication_preferences: {
      tone: 'ambitious and supportive',
      length: 'brief',
      formality: 'professional',
      data_preference: 'balanced',
    },
    response_triggers: [
      'Peer company examples',
      'Competitive positioning',
      'Credibility enhancement',
    ],
    objection_patterns: [
      'Cash flow concerns',
      'Priority juggling',
      'Skepticism from past vendor experiences',
    ],
    optimal_cta_types: [
      'Quick win demonstration',
      'Investor-ready examples',
      'Competitor benchmarking',
    ],
  },

  'Methodology Owner': {
    id: 'methodology_owner',
    name: 'Methodology Owner',
    core_characteristics: [
      'Has proprietary frameworks',
      'Protective of IP',
      'Seeks scale without commoditization',
      'Values premium positioning',
    ],
    decision_drivers: [
      'IP protection',
      'Premium perception maintenance',
      'Scalability without dilution',
      'Competitive moat strengthening',
    ],
    communication_preferences: {
      tone: 'respectful of IP',
      length: 'moderate',
      formality: 'professional',
      data_preference: 'balanced',
    },
    response_triggers: [
      'Recognition of methodology uniqueness',
      'Productization opportunity',
      'SaaS potential',
    ],
    objection_patterns: [
      'Will this dilute my approach?',
      'Will clients bypass me?',
      'How do I maintain control?',
    ],
    optimal_cta_types: [
      'IP enhancement exploration',
      'SaaS opportunity discussion',
      'Productization pathway review',
    ],
  },

  'High-Touch Perfectionist': {
    id: 'high_touch_perfectionist',
    name: 'High-Touch Perfectionist',
    core_characteristics: [
      'Quality over quantity mindset',
      'Premium client focus',
      'Skeptical of automation',
      'Values deep relationships',
    ],
    decision_drivers: [
      'Quality assurance',
      'Client outcome protection',
      'Exclusivity maintenance',
      'Relationship enhancement',
    ],
    communication_preferences: {
      tone: 'quality-focused and exclusive',
      length: 'moderate',
      formality: 'professional',
      data_preference: 'narrative',
    },
    response_triggers: [
      'Quality enhancement promise',
      'Client outcome improvement',
      'Exclusivity positioning',
    ],
    objection_patterns: [
      'Will this feel automated?',
      'Will clients notice degradation?',
      'How does this maintain my standards?',
    ],
    optimal_cta_types: [
      'Quality-focused demonstration',
      'Client outcome case study',
      'Exclusive pilot program',
    ],
  },

  'Creative-Operational Hybrid': {
    id: 'creative_operational_hybrid',
    name: 'Creative-Operational Hybrid',
    core_characteristics: [
      'Balances creativity with business',
      'Overwhelmed by client management',
      'Seeks efficient onboarding',
      'Interested in productization',
    ],
    decision_drivers: [
      'Operational efficiency',
      'Client onboarding speed',
      'Creative time protection',
      'Revenue diversification',
    ],
    communication_preferences: {
      tone: 'practical and creative',
      length: 'moderate',
      formality: 'casual',
      data_preference: 'balanced',
    },
    response_triggers: [
      'Efficiency gains',
      'White-label opportunities',
      'Creative time recovery',
    ],
    objection_patterns: [
      'My process is unique',
      'Clients expect custom work',
      'We\'re already stretched thin',
    ],
    optimal_cta_types: [
      'Efficiency audit',
      'White-label opportunity discussion',
      'Process optimization review',
    ],
  },
};

// =============================================================================
// STRATEGY SELECTION ENGINE
// =============================================================================

export interface StrategyRecommendation {
  strategy_id: string;
  strategy_name: string;
  weight: number;  // 0.0 - 1.0
  reasoning: string;
  sample_subject_line: string;
  sample_opening: string;
}

export interface StrategySelectionResult {
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
}

/**
 * Select optimal psychological strategies for an ICP
 * Returns weighted recommendations with reasoning
 */
export function selectStrategiesForICP(icpKey: string): StrategySelectionResult | null {
  const preset = ICP_PRESETS[icpKey];
  if (!preset) return null;

  const archetype = preset.archetype;
  const archetypeProfile = ARCHETYPE_PROFILES[archetype];

  if (!archetypeProfile) {
    // Fallback to generic recommendations
    return createGenericRecommendations(icpKey, preset);
  }

  const primaryStrategies = preset.primary_strategies;
  const secondaryStrategies = preset.secondary_strategies;
  const painPoints = preset.pain_points;

  // Build primary recommendations
  const primaryRecs: StrategyRecommendation[] = primaryStrategies.map((stratId, index) => {
    const strategy = PSYCHOLOGICAL_STRATEGIES[stratId];
    if (!strategy) return null;

    const weight = 1.0 - (index * 0.15);  // First strategy gets highest weight
    const relevantPain = painPoints[0] || 'efficiency challenges';

    return {
      strategy_id: stratId,
      strategy_name: strategy.name,
      weight: Math.max(0.5, weight),
      reasoning: `${archetype} responds well to ${strategy.name} because: ${strategy.core_mechanism}`,
      sample_subject_line: populateTemplate(
        strategy.email_patterns.subject_line_patterns[0],
        { pain: relevantPain, role: archetype }
      ),
      sample_opening: populateTemplate(
        strategy.email_patterns.opening_hooks[0],
        { pain: relevantPain, role: archetype }
      ),
    };
  }).filter(Boolean) as StrategyRecommendation[];

  // Build secondary recommendations
  const secondaryRecs: StrategyRecommendation[] = secondaryStrategies.map((stratId) => {
    const strategy = PSYCHOLOGICAL_STRATEGIES[stratId];
    if (!strategy) return null;

    const relevantPain = painPoints[1] || painPoints[0] || 'growth challenges';

    return {
      strategy_id: stratId,
      strategy_name: strategy.name,
      weight: 0.4,
      reasoning: `${strategy.name} provides supporting reinforcement for ${archetype}`,
      sample_subject_line: populateTemplate(
        strategy.email_patterns.subject_line_patterns[0],
        { pain: relevantPain, role: archetype }
      ),
      sample_opening: populateTemplate(
        strategy.email_patterns.opening_hooks[0],
        { pain: relevantPain, role: archetype }
      ),
    };
  }).filter(Boolean) as StrategyRecommendation[];

  // Identify strategies to avoid
  const avoidStrategies: string[] = [];
  for (const [stratId, strategy] of Object.entries(PSYCHOLOGICAL_STRATEGIES)) {
    if (strategy.avoid_with.includes(archetype)) {
      avoidStrategies.push(stratId);
    }
  }

  return {
    icp_key: icpKey,
    archetype,
    primary_recommendations: primaryRecs,
    secondary_recommendations: secondaryRecs,
    avoid_strategies: avoidStrategies,
    communication_guidelines: archetypeProfile.communication_preferences,
  };
}

function createGenericRecommendations(icpKey: string, preset: any): StrategySelectionResult {
  return {
    icp_key: icpKey,
    archetype: preset.archetype,
    primary_recommendations: [{
      strategy_id: 'ego_relevance',
      strategy_name: 'Ego Relevance',
      weight: 0.8,
      reasoning: 'Default strategy that works broadly across archetypes',
      sample_subject_line: 'Your expertise + AI = [outcome]',
      sample_opening: 'Your work caught my attention...',
    }],
    secondary_recommendations: [{
      strategy_id: 'curiosity_gap',
      strategy_name: 'Curiosity Gap',
      weight: 0.4,
      reasoning: 'Universal engagement driver',
      sample_subject_line: 'Quick question about [topic]',
      sample_opening: 'I found something interesting...',
    }],
    avoid_strategies: [],
    communication_guidelines: {
      tone: 'professional',
      length: 'moderate',
      formality: 'professional',
      data_preference: 'balanced',
    },
  };
}

function populateTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\[${key}\\]`, 'gi'), value);
  }
  // Clean up any remaining placeholders
  result = result.replace(/\[[^\]]+\]/g, '[specific detail]');
  return result;
}

// =============================================================================
// EMAIL PROMPT GENERATION
// =============================================================================

export interface EmailPromptContext {
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
  strategy_override?: string;  // Force specific strategy
}

export interface GeneratedPrompt {
  system_prompt: string;
  user_prompt: string;
  metadata: {
    icp_key: string;
    archetype: string;
    primary_strategy: string;
    secondary_strategies: string[];
    communication_style: string;
  };
}

/**
 * Generate AI prompt for personalized email generation
 * Incorporates ICP archetype and psychological strategy guidance
 */
export function generateEmailPrompt(context: EmailPromptContext): GeneratedPrompt {
  const strategyResult = selectStrategiesForICP(context.icp_key);
  const preset = ICP_PRESETS[context.icp_key];

  if (!strategyResult || !preset) {
    return generateFallbackPrompt(context);
  }

  const primaryStrategy = context.strategy_override
    ? PSYCHOLOGICAL_STRATEGIES[context.strategy_override]
    : PSYCHOLOGICAL_STRATEGIES[strategyResult.primary_recommendations[0]?.strategy_id];

  const archetypeProfile = ARCHETYPE_PROFILES[preset.archetype];
  const painPoints = preset.pain_points.slice(0, 3);
  const useCases = preset.use_cases.slice(0, 2);

  const systemPrompt = `You are an expert B2B email copywriter specializing in personalized cold outreach.
Your writing style is ${strategyResult.communication_guidelines.tone}, ${strategyResult.communication_guidelines.length} in length, and ${strategyResult.communication_guidelines.formality} in formality.

TARGET ARCHETYPE: ${preset.archetype}
Key characteristics:
${archetypeProfile ? archetypeProfile.core_characteristics.map(c => `- ${c}`).join('\n') : '- Professional decision-maker'}

PRIMARY PSYCHOLOGICAL STRATEGY: ${primaryStrategy?.name || 'Ego Relevance'}
Core mechanism: ${primaryStrategy?.core_mechanism || 'Validate expertise and position as enhancement'}

Email patterns to use:
${primaryStrategy?.email_patterns.subject_line_patterns.slice(0, 2).map(p => `- Subject: "${p}"`).join('\n') || ''}
${primaryStrategy?.email_patterns.opening_hooks.slice(0, 2).map(p => `- Opening: "${p}"`).join('\n') || ''}
${primaryStrategy?.email_patterns.call_to_action_patterns.slice(0, 2).map(p => `- CTA: "${p}"`).join('\n') || ''}

Trigger words to incorporate: ${primaryStrategy?.trigger_words.slice(0, 5).join(', ') || 'expertise, approach, enhance'}

PAIN POINTS TO ADDRESS:
${painPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

RELEVANT USE CASES:
${useCases.map((u, i) => `${i + 1}. ${u}`).join('\n')}

MESSAGING STYLE: ${preset.messaging_style}

GUIDELINES:
- Keep email under 150 words
- No generic phrases like "I hope this email finds you well"
- Lead with value or insight, not introduction
- Specific > Generic - use details from their context
- One clear CTA only
- Data preference: ${strategyResult.communication_guidelines.data_preference}

${strategyResult.avoid_strategies.length > 0
  ? `AVOID these approaches: ${strategyResult.avoid_strategies.map(s => PSYCHOLOGICAL_STRATEGIES[s]?.name).filter(Boolean).join(', ')}`
  : ''}`;

  const userPrompt = `Generate a personalized cold email for:

PROSPECT:
- Name: ${context.lead.name}
- Title: ${context.lead.title}
- Company: ${context.lead.company}
${context.lead.industry ? `- Industry: ${context.lead.industry}` : ''}
${context.lead.enrichment_data ? `- Additional context: ${JSON.stringify(context.lead.enrichment_data, null, 2)}` : ''}

${context.campaign ? `
CAMPAIGN CONTEXT:
- Product: ${context.campaign.product_name}
- Value Prop: ${context.campaign.value_proposition}
- Target Outcome: ${context.campaign.target_outcome}
` : ''}

Generate:
1. Subject line (using ${primaryStrategy?.name || 'Ego Relevance'} strategy patterns)
2. Email body (< 150 words, ${strategyResult.communication_guidelines.length} length)
3. P.S. line (optional, only if it adds value)

Output format:
SUBJECT: [subject line]
BODY:
[email body]
${'{'}PS: [optional p.s. line]{'}'}`;

  return {
    system_prompt: systemPrompt,
    user_prompt: userPrompt,
    metadata: {
      icp_key: context.icp_key,
      archetype: preset.archetype,
      primary_strategy: primaryStrategy?.id || 'ego_relevance',
      secondary_strategies: strategyResult.secondary_recommendations.map(r => r.strategy_id),
      communication_style: `${strategyResult.communication_guidelines.tone}, ${strategyResult.communication_guidelines.length}, ${strategyResult.communication_guidelines.formality}`,
    },
  };
}

function generateFallbackPrompt(context: EmailPromptContext): GeneratedPrompt {
  return {
    system_prompt: `You are an expert B2B email copywriter. Write a professional, personalized cold email that is brief and value-focused. Lead with insight, not introduction. Keep under 150 words.`,
    user_prompt: `Generate a personalized cold email for:
- Name: ${context.lead.name}
- Title: ${context.lead.title}
- Company: ${context.lead.company}

Output format:
SUBJECT: [subject line]
BODY:
[email body]`,
    metadata: {
      icp_key: context.icp_key || 'unknown',
      archetype: 'unknown',
      primary_strategy: 'ego_relevance',
      secondary_strategies: [],
      communication_style: 'professional, moderate, professional',
    },
  };
}

// =============================================================================
// STRATEGY PERFORMANCE TRACKING
// =============================================================================

export interface StrategyPerformanceMetrics {
  strategy_id: string;
  emails_sent: number;
  opens: number;
  replies: number;
  positive_replies: number;
  open_rate: number;
  reply_rate: number;
  positive_reply_rate: number;
  effectiveness_score: number;
}

/**
 * Calculate strategy effectiveness score
 * Used for dynamic strategy optimization over time
 */
export function calculateStrategyEffectiveness(metrics: Omit<StrategyPerformanceMetrics, 'effectiveness_score'>): number {
  if (metrics.emails_sent === 0) return 0;

  // Weighted scoring:
  // - Reply rate: 50% weight (most important)
  // - Positive reply rate: 30% weight (quality indicator)
  // - Open rate: 20% weight (engagement indicator)

  const replyWeight = 0.5;
  const positiveReplyWeight = 0.3;
  const openWeight = 0.2;

  const replyScore = Math.min(metrics.reply_rate / 0.10, 1.0);  // Normalize to 10% target
  const positiveScore = metrics.replies > 0
    ? metrics.positive_replies / metrics.replies
    : 0;
  const openScore = Math.min(metrics.open_rate / 0.40, 1.0);  // Normalize to 40% target

  const baseScore = (replyWeight * replyScore) +
                    (positiveReplyWeight * positiveScore) +
                    (openWeight * openScore);

  // Apply strategy's inherent multiplier
  const strategy = Object.values(PSYCHOLOGICAL_STRATEGIES)
    .find(s => s.id === metrics.strategy_id);

  const multiplier = strategy?.effectiveness_multiplier || 1.0;

  return Math.min(baseScore * multiplier, 2.0);  // Cap at 2.0
}

// =============================================================================
// INTEGRATION HELPERS
// =============================================================================

/**
 * Get all strategies applicable to an ICP
 */
export function getApplicableStrategies(icpKey: string): PsychologicalStrategy[] {
  const preset = ICP_PRESETS[icpKey];
  if (!preset) return [];

  const archetype = preset.archetype;

  return Object.values(PSYCHOLOGICAL_STRATEGIES).filter(strategy => {
    return !strategy.avoid_with.includes(archetype);
  });
}

/**
 * Get strategy by ID
 */
export function getStrategy(strategyId: string): PsychologicalStrategy | undefined {
  return PSYCHOLOGICAL_STRATEGIES[strategyId];
}

/**
 * Get archetype profile
 */
export function getArchetypeProfile(archetype: string): ArchetypeProfile | undefined {
  return ARCHETYPE_PROFILES[archetype];
}

/**
 * List all available strategies
 */
export function listStrategies(): { id: string; name: string; description: string }[] {
  return Object.values(PSYCHOLOGICAL_STRATEGIES).map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
  }));
}

/**
 * Get objection handling patterns for an archetype
 */
export function getObjectionPatterns(archetype: string): string[] {
  const profile = ARCHETYPE_PROFILES[archetype];
  return profile?.objection_patterns || [];
}

/**
 * Get optimal CTA types for an archetype
 */
export function getOptimalCTAs(archetype: string): string[] {
  const profile = ARCHETYPE_PROFILES[archetype];
  return profile?.optimal_cta_types || ['15-minute call', 'Quick demo', 'Case study'];
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  ICP_PRESETS,
  getPresetMetadata,
  getStrategiesForICP,
  getPainTriggers,
} from './icp-presets';
