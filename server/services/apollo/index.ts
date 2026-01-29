/**
 * Apollo Service Module
 *
 * Production-ready Apollo.io integration for lead discovery and management.
 */

// Types
export * from './apollo-types';

// Service
export {
  ApolloService,
  getApolloService,
  createApolloService,
  LIST_PREFIX,
} from './apollo-service';
