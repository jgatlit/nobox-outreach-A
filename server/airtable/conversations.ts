/**
 * Airtable Conversations Module
 * 
 * This module provides utility functions to interact with the Conversations table in Airtable.
 * It handles storing, retrieving, and updating conversation data.
 */

import { log } from '../vite';
import { createRecord, updateRecord, listRecords, searchRecords, deleteRecord } from './client';

// Define interfaces for conversation data
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  title: string;
  user: string;
  status: 'active' | 'archived' | 'deleted';
  messages: Message[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  lastMessageDate?: string;
  modelUsed?: string;
  toolExecutionsCount?: number;
  metadata?: Record<string, any>;
}

/**
 * Create a new conversation in Airtable
 * @param baseId Airtable base ID
 * @param conversation Conversation data
 * @returns Promise that resolves with the created record
 */
export async function createConversation(baseId: string, conversation: Conversation): Promise<any> {
  try {
    log(`Creating conversation in Airtable: ${conversation.id}`, 'airtable');
    
    // Prepare the record for Airtable
    const record = {
      'id': conversation.id,
      'title': conversation.title,
      'user': conversation.user,
      'status': conversation.status,
      'messages': JSON.stringify(conversation.messages),
      'tags': conversation.tags || [],
      'created_at': conversation.createdAt,
      'updated_at': conversation.updatedAt,
      'last_message_date': conversation.lastMessageDate || conversation.updatedAt,
      'model_used': conversation.modelUsed || '',
      'tool_executions_count': conversation.toolExecutionsCount || 0,
      'metadata': conversation.metadata ? JSON.stringify(conversation.metadata) : '{}'
    };
    
    return await createRecord(baseId, 'Conversations', record);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error creating conversation in Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Get all conversations for a specific user
 * @param baseId Airtable base ID
 * @param user User identifier
 * @returns Promise that resolves with the conversations
 */
export async function getUserConversations(baseId: string, user: string): Promise<Conversation[]> {
  try {
    log(`Getting conversations for user: ${user}`, 'airtable');
    
    // Search for conversations by user
    const formula = `{user} = "${user}"`;
    const records = await searchRecords(baseId, 'Conversations', formula);
    
    // Convert records to our internal format
    return records.map(record => {
      const messages = record.fields['Messages'] ? 
        JSON.parse(record.fields['Messages']) : [];
      
      const metadata = record.fields['Metadata'] ? 
        JSON.parse(record.fields['Metadata']) : undefined;
      
      return {
        id: record.fields['Id'],
        title: record.fields['Title'],
        user: record.fields['User'],
        status: record.fields['Status'],
        messages,
        tags: record.fields['Tags'] || [],
        createdAt: record.fields['Created At'],
        updatedAt: record.fields['Updated At'],
        lastMessageDate: record.fields['Last Message Date'],
        modelUsed: record.fields['Model Used'],
        toolExecutionsCount: record.fields['Tool Executions Count'],
        metadata
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error getting user conversations from Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Get a specific conversation by ID
 * @param baseId Airtable base ID
 * @param conversationId Conversation ID
 * @returns Promise that resolves with the conversation
 */
export async function getConversation(baseId: string, conversationId: string): Promise<Conversation | null> {
  try {
    log(`Getting conversation: ${conversationId}`, 'airtable');
    
    // Search for the conversation by ID
    const formula = `{id} = "${conversationId}"`;
    const records = await searchRecords(baseId, 'Conversations', formula);
    
    if (!records || records.length === 0) {
      return null;
    }
    
    const record = records[0];
    
    // Convert record to our internal format
    const messages = record.fields['Messages'] ? 
      JSON.parse(record.fields['Messages']) : [];
    
    const metadata = record.fields['Metadata'] ? 
      JSON.parse(record.fields['Metadata']) : undefined;
    
    return {
      id: record.fields['Id'],
      title: record.fields['Title'],
      user: record.fields['User'],
      status: record.fields['Status'],
      messages,
      tags: record.fields['Tags'] || [],
      createdAt: record.fields['Created At'],
      updatedAt: record.fields['Updated At'],
      lastMessageDate: record.fields['Last Message Date'],
      modelUsed: record.fields['Model Used'],
      toolExecutionsCount: record.fields['Tool Executions Count'],
      metadata
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error getting conversation from Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Update an existing conversation
 * @param baseId Airtable base ID
 * @param conversationId Conversation ID
 * @param updates Partial conversation data to update
 * @returns Promise that resolves with the updated record
 */
export async function updateConversation(
  baseId: string, 
  conversationId: string, 
  updates: Partial<Conversation>
): Promise<any> {
  try {
    log(`Updating conversation: ${conversationId}`, 'airtable');
    
    // First get the Airtable record ID for this conversation
    const formula = `{id} = "${conversationId}"`;
    const records = await searchRecords(baseId, 'Conversations', formula);
    
    if (!records || records.length === 0) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    const recordId = records[0].id;
    
    // Prepare the updates for Airtable
    const fields: Record<string, any> = {};
    
    if (updates.title) fields['title'] = updates.title;
    if (updates.status) fields['status'] = updates.status;
    if (updates.messages) fields['messages'] = JSON.stringify(updates.messages);
    if (updates.tags) fields['tags'] = updates.tags;
    if (updates.updatedAt) fields['updated_at'] = updates.updatedAt;
    if (updates.lastMessageDate) fields['last_message_date'] = updates.lastMessageDate;
    if (updates.modelUsed) fields['model_used'] = updates.modelUsed;
    if (updates.toolExecutionsCount !== undefined) fields['tool_executions_count'] = updates.toolExecutionsCount;
    if (updates.metadata) fields['metadata'] = JSON.stringify(updates.metadata);
    
    return await updateRecord(baseId, 'Conversations', recordId, fields);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error updating conversation in Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Delete a conversation (mark as deleted)
 * @param baseId Airtable base ID
 * @param conversationId Conversation ID
 * @returns Promise that resolves when the operation is complete
 */
export async function softDeleteConversation(baseId: string, conversationId: string): Promise<any> {
  try {
    log(`Soft deleting conversation: ${conversationId}`, 'airtable');
    
    // Update the conversation status to 'deleted'
    return await updateConversation(baseId, conversationId, {
      status: 'deleted',
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error soft deleting conversation in Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Hard delete a conversation (remove from Airtable)
 * @param baseId Airtable base ID
 * @param conversationId Conversation ID
 * @returns Promise that resolves when the operation is complete
 */
export async function hardDeleteConversation(baseId: string, conversationId: string): Promise<any> {
  try {
    log(`Hard deleting conversation: ${conversationId}`, 'airtable');
    
    // First get the Airtable record ID for this conversation
    const formula = `{Id} = "${conversationId}"`;
    const records = await searchRecords(baseId, 'Conversations', formula);
    
    if (!records || records.length === 0) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    const recordId = records[0].id;
    
    // Delete the record from Airtable
    return await deleteRecord(baseId, 'Conversations', recordId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error hard deleting conversation in Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}

/**
 * Add a message to an existing conversation
 * @param baseId Airtable base ID
 * @param conversationId Conversation ID
 * @param message New message to add
 * @returns Promise that resolves with the updated conversation
 */
export async function addMessageToConversation(
  baseId: string, 
  conversationId: string, 
  message: Message
): Promise<Conversation | null> {
  try {
    log(`Adding message to conversation: ${conversationId}`, 'airtable');
    
    // Get the current conversation
    const conversation = await getConversation(baseId, conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    // Add the new message
    const updatedMessages = [...conversation.messages, message];
    
    // Update the conversation
    const now = new Date().toISOString();
    await updateConversation(baseId, conversationId, {
      messages: updatedMessages,
      updatedAt: now,
      lastMessageDate: now
    });
    
    // Return the updated conversation
    return await getConversation(baseId, conversationId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error adding message to conversation in Airtable: ${errorMessage}`, 'airtable');
    throw error;
  }
}