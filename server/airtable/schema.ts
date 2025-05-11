/**
 * This file defines the Airtable schema for our tables.
 * It helps with type safety when interacting with Airtable.
 */

export interface AirtableRecord<T> {
  id: string;
  fields: T;
  createdTime: string;
}

// Conversations table schema
export interface ConversationFields {
  Name: string;
  Lead?: string[];  // Reference to Lead in Airtable
  LeadEmail?: string;
  Content: string;
  Type: string;
  Date: string;
  Status?: string;
  Notes?: string;
}

// ToolExecutions table schema
export interface ToolExecutionFields {
  Name: string;
  Tool: string;
  Parameters?: string;
  Result?: string;
  Status: string;
  ExecutedAt: string;
  ExecutedBy?: string;
}

// Pipelines table schema
export interface PipelineFields {
  Name: string;
  Lead?: string[];  // Reference to Lead in Airtable
  LeadEmail?: string;
  Stage: string;
  Value?: number;
  ExpectedCloseDate?: string;
  AssignedTo?: string;
  LastActivity?: string;
  Notes?: string;
}

// Leads table schema - mirrors PostgreSQL leads table
export interface LeadFields {
  id: number;                   // PostgreSQL ID
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  title?: string;
  status?: string;
  source?: string;
  priority?: string;
  lastActivityDate?: string;
  website?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;      // For tracking sync status
  syncSource?: string;        // "postgresql" or "airtable"
}

// Table names as constants for consistency
export const TABLES = {
  CONVERSATIONS: 'Conversations',
  TOOL_EXECUTIONS: 'ToolExecutions',
  PIPELINES: 'Pipelines',
  LEADS: 'Leads',
};