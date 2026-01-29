/**
 * Server Configuration Exports
 *
 * Centralized exports for all server configuration modules
 */

// ICP Presets - Apollo filter configurations
export {
  ICP_PRESETS,
  SENIORITY_EXPANSION,
  getPreset,
  getPresetKeys,
  listPresets,
  getFiltersForPreset,
  getPresetMetadata,
  expandSeniorities,
  getStrategiesForICP,
  getPainTriggers,
  validatePresetFilters,
} from './icp-presets';

// ICP-to-Psychology Mapping - Strategy selection and prompt generation
export {
  PSYCHOLOGICAL_STRATEGIES,
  ARCHETYPE_PROFILES,
  selectStrategiesForICP,
  generateEmailPrompt,
  calculateStrategyEffectiveness,
  getApplicableStrategies,
  getStrategy,
  getArchetypeProfile,
  listStrategies,
  getObjectionPatterns,
  getOptimalCTAs,
} from './icp-psychology-map';

// Re-export types
export type {
  PsychologicalStrategy,
  ArchetypeProfile,
  StrategyRecommendation,
  StrategySelectionResult,
  EmailPromptContext,
  GeneratedPrompt,
  StrategyPerformanceMetrics,
} from './icp-psychology-map';
