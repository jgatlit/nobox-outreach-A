/**
 * This file contains shared type definitions for both the client and server
 */

export interface Lead {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  company: string | null;
  title: string | null;
  phoneNumber: string | null;
  website: string | null;
  linkedinUrl: string | null;
  status: 'active' | 'inactive' | 'contacted' | 'responded' | 'qualified' | 'disqualified' | null;
  source: 'pipedrive' | 'asana' | 'email' | 'instantly' | 'cyberleads' | 'linkedin' | 'manual' | 'airtable';
  priority: 'high' | 'medium' | 'low' | null;
  notes: string | null;
  tags: string[] | null;
  lastActivityDate: Date | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  priorityUpdatedAt: Date | null;
}

export interface AirtableRecord<T> {
  id: string;
  fields: T;
  createdTime: string;
}

export interface LeadFields {
  id: number;
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
  lastSyncedAt?: string;
  syncSource?: string;
}

export interface SyncStatus {
  id: number;
  type: 'leads_to_airtable' | 'airtable_to_leads';
  lastSync: Date | null;
  recordsProcessed: number;
  status: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncResult {
  success: boolean;
  count?: number;
  message?: string;
  error?: string;
}

export interface AirtableClient {
  createRecords: (baseId: string, tableName: string, records: { fields: any }[]) => Promise<any[]>;
  getRecords: (baseId: string, tableName: string, options?: any) => Promise<any[]>;
  getAllRecords: (baseId: string, tableName: string) => Promise<any[]>;
  updateRecord: (baseId: string, tableName: string, recordId: string, fields: any) => Promise<any>;
  deleteRecord: (baseId: string, tableName: string, recordId: string) => Promise<any>;
}