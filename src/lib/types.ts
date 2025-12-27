/**
 * Type definitions for the iMessage MCP Server
 */

export interface Contact {
  name: string;
  phones: string[];
  emails: string[];
}

export interface Message {
  id: number;
  text: string;
  date: string;
  isFromMe: boolean;
  hasAttachments: boolean;
  contact: string;
  chatName?: string;
}

export interface ConversationMessage {
  id: number;
  text: string;
  date: string;
  isFromMe: boolean;
  hasAttachments: boolean;
  sender: string;
}

export interface Chat {
  id: number;
  identifier: string;
  displayName: string;
  service: string;
  isGroupChat: boolean;
  messageCount: number;
  lastMessageDate: string;
  lastMessage?: string;
}

export interface Attachment {
  id: number;
  filename: string | null;
  mimeType: string | null;
  filePath: string | null;
  fileSize: number | null;
  isSticker: boolean;
  isAudioMessage: boolean;
}

export interface MessageWithAttachments extends Message {
  attachments: Attachment[];
}

export interface DatabaseStats {
  totalMessages: number;
  totalChats: number;
  totalContacts: number;
}

export interface DatabaseAccessResult {
  accessible: boolean;
  error?: string;
}

export interface RawMessageRow {
  rowid: number;
  text: string | null;
  date: number;
  is_from_me: number;
  cache_has_attachments: number;
  handle_id: string | null;
  chat_name?: string | null;
  chat_identifier?: string | null;
}

export interface RawChatRow {
  rowid: number;
  chat_identifier: string;
  display_name: string | null;
  service_name: string;
  style: number;
  message_count: number;
  last_message_date: number | null;
  last_message?: string | null;
}

export interface RawAttachmentRow {
  rowid: number;
  filename: string | null;
  mime_type: string | null;
  transfer_name: string | null;
  total_bytes: number | null;
  is_sticker: number;
  is_audio_message: number;
}

export interface RawStatsRow {
  total_messages: number;
  total_chats: number;
  total_contacts: number;
}

// Tool input types
export interface SendMessageInput {
  recipient: string;
  message: string;
  groupChat?: boolean;
}

export interface GetRecentMessagesInput {
  hours?: number;
  contact?: string;
  limit?: number;
}

export interface GetConversationInput {
  contact: string;
  days?: number;
  limit?: number;
}

export interface SearchMessagesInput {
  query: string;
  days?: number;
  limit?: number;
}

export interface ListChatsInput {
  limit?: number;
  includeGroupChats?: boolean;
}

export interface CheckImessageInput {
  recipient: string;
}

export interface SearchContactsInput {
  query: string;
}

export interface GetAttachmentsInput {
  messageId?: number;
  contact?: string;
  days?: number;
  limit?: number;
}
