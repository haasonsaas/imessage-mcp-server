/**
 * Database operations for the iMessage MCP Server
 * Handles all interactions with the Messages SQLite database
 */

import { homedir } from "os";
import { existsSync, accessSync, constants } from "fs";
import path from "path";
import Database from "better-sqlite3";
import {
  DatabaseAccessResult,
  DatabaseStats,
  RawMessageRow,
  RawChatRow,
  RawAttachmentRow,
  RawStatsRow,
  Message,
  Chat,
  Attachment,
  ConversationMessage,
} from "./types.js";
import {
  getErrorMessage,
  cocoaTimestampToDate,
  formatDate,
  hoursAgoToCocoaTimestamp,
  daysAgoToCocoaTimestamp,
  formatPhoneNumber,
  truncate,
} from "./utils.js";

// Database path
export const MESSAGES_DB_PATH = path.join(homedir(), "Library", "Messages", "chat.db");

/**
 * Check if the Messages database is accessible
 */
export function checkDatabaseAccess(): DatabaseAccessResult {
  if (!existsSync(MESSAGES_DB_PATH)) {
    return {
      accessible: false,
      error: `Messages database not found at ${MESSAGES_DB_PATH}. Make sure Messages app has been used.`,
    };
  }

  try {
    accessSync(MESSAGES_DB_PATH, constants.R_OK);
    // Try to actually open the database
    const db = new Database(MESSAGES_DB_PATH, { readonly: true });
    db.close();
    return { accessible: true };
  } catch (error) {
    return {
      accessible: false,
      error: `Cannot access Messages database. Grant Full Disk Access to your terminal in System Preferences → Privacy & Security → Full Disk Access. Error: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * Get a database connection
 */
export function getDatabase(): Database.Database {
  return new Database(MESSAGES_DB_PATH, { readonly: true });
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): DatabaseStats {
  const db = getDatabase();
  try {
    const stats = db
      .prepare(
        `
      SELECT
        (SELECT COUNT(*) FROM message) as total_messages,
        (SELECT COUNT(*) FROM chat) as total_chats,
        (SELECT COUNT(*) FROM handle) as total_contacts
    `
      )
      .get() as RawStatsRow;

    return {
      totalMessages: stats.total_messages,
      totalChats: stats.total_chats,
      totalContacts: stats.total_contacts,
    };
  } finally {
    db.close();
  }
}

/**
 * Get recent messages
 */
export function getRecentMessages(
  hours: number = 24,
  contact?: string,
  limit: number = 50
): Message[] {
  const db = getDatabase();
  try {
    const cocoaTimestamp = hoursAgoToCocoaTimestamp(hours);

    let query = `
      SELECT
        m.rowid,
        m.text,
        m.date,
        m.is_from_me,
        m.cache_has_attachments,
        h.id as handle_id,
        c.display_name as chat_name,
        c.chat_identifier
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.rowid
      LEFT JOIN chat_message_join cmj ON m.rowid = cmj.message_id
      LEFT JOIN chat c ON cmj.chat_id = c.rowid
      WHERE m.date > ?
    `;
    const params: (number | string)[] = [cocoaTimestamp];

    if (contact) {
      const formattedContact = formatPhoneNumber(contact);
      query += ` AND (h.id LIKE ? OR h.id = ? OR h.id LIKE ?)`;
      params.push(`%${contact}%`, formattedContact, `%${formattedContact}%`);
    }

    query += ` ORDER BY m.date DESC LIMIT ?`;
    params.push(limit);

    const messages = db.prepare(query).all(...params) as RawMessageRow[];

    return messages.map((msg) => ({
      id: msg.rowid,
      text: msg.text || "(attachment or empty)",
      date: formatDate(cocoaTimestampToDate(msg.date)),
      isFromMe: msg.is_from_me === 1,
      hasAttachments: msg.cache_has_attachments === 1,
      contact: msg.handle_id || "Unknown",
      chatName: msg.chat_name || msg.chat_identifier || "Direct Message",
    }));
  } finally {
    db.close();
  }
}

/**
 * Get conversation with a specific contact
 */
export function getConversation(
  contact: string,
  days: number = 7,
  limit: number = 100
): ConversationMessage[] {
  const db = getDatabase();
  try {
    const cocoaTimestamp = daysAgoToCocoaTimestamp(days);
    const formattedContact = formatPhoneNumber(contact);

    const messages = db
      .prepare(
        `
      SELECT
        m.rowid,
        m.text,
        m.date,
        m.is_from_me,
        m.cache_has_attachments,
        h.id as handle_id
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.rowid
      WHERE m.date > ?
        AND (h.id LIKE ? OR h.id = ? OR h.id LIKE ?)
      ORDER BY m.date ASC
      LIMIT ?
    `
      )
      .all(
        cocoaTimestamp,
        `%${contact}%`,
        formattedContact,
        `%${formattedContact}%`,
        limit
      ) as RawMessageRow[];

    return messages.map((msg) => ({
      id: msg.rowid,
      text: msg.text || "(attachment or empty)",
      date: formatDate(cocoaTimestampToDate(msg.date)),
      isFromMe: msg.is_from_me === 1,
      hasAttachments: msg.cache_has_attachments === 1,
      sender: msg.is_from_me === 1 ? "You" : msg.handle_id || "Them",
    }));
  } finally {
    db.close();
  }
}

/**
 * Search messages by content
 */
export function searchMessages(query: string, days: number = 30, limit: number = 50): Message[] {
  const db = getDatabase();
  try {
    const cocoaTimestamp = daysAgoToCocoaTimestamp(days);

    const messages = db
      .prepare(
        `
      SELECT
        m.rowid,
        m.text,
        m.date,
        m.is_from_me,
        m.cache_has_attachments,
        h.id as handle_id,
        c.display_name as chat_name,
        c.chat_identifier
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.rowid
      LEFT JOIN chat_message_join cmj ON m.rowid = cmj.message_id
      LEFT JOIN chat c ON cmj.chat_id = c.rowid
      WHERE m.date > ?
        AND m.text LIKE ?
      ORDER BY m.date DESC
      LIMIT ?
    `
      )
      .all(cocoaTimestamp, `%${query}%`, limit) as RawMessageRow[];

    return messages.map((msg) => ({
      id: msg.rowid,
      text: msg.text || "",
      date: formatDate(cocoaTimestampToDate(msg.date)),
      isFromMe: msg.is_from_me === 1,
      hasAttachments: msg.cache_has_attachments === 1,
      contact: msg.handle_id || "Unknown",
      chatName: msg.chat_name || msg.chat_identifier || "Direct Message",
    }));
  } finally {
    db.close();
  }
}

/**
 * List all chats
 */
export function listChats(limit: number = 30, includeGroupChats: boolean = true): Chat[] {
  const db = getDatabase();
  try {
    let query = `
      SELECT
        c.rowid,
        c.chat_identifier,
        c.display_name,
        c.service_name,
        c.style,
        (SELECT COUNT(*) FROM chat_message_join WHERE chat_id = c.rowid) as message_count,
        (SELECT MAX(m.date) FROM message m
         JOIN chat_message_join cmj ON m.rowid = cmj.message_id
         WHERE cmj.chat_id = c.rowid) as last_message_date,
        (SELECT m.text FROM message m
         JOIN chat_message_join cmj ON m.rowid = cmj.message_id
         WHERE cmj.chat_id = c.rowid
         ORDER BY m.date DESC LIMIT 1) as last_message
      FROM chat c
    `;

    if (!includeGroupChats) {
      query += ` WHERE c.style != 43`; // style 43 is group chat
    }

    query += ` ORDER BY last_message_date DESC LIMIT ?`;

    const chats = db.prepare(query).all(limit) as RawChatRow[];

    return chats.map((chat) => ({
      id: chat.rowid,
      identifier: chat.chat_identifier,
      displayName: chat.display_name || chat.chat_identifier,
      service: chat.service_name,
      isGroupChat: chat.style === 43,
      messageCount: chat.message_count,
      lastMessageDate: chat.last_message_date
        ? formatDate(cocoaTimestampToDate(chat.last_message_date))
        : "Unknown",
      lastMessage: chat.last_message ? truncate(chat.last_message, 50) : "(no messages)",
    }));
  } finally {
    db.close();
  }
}

/**
 * Get unread message count
 */
export function getUnreadCount(): number {
  const db = getDatabase();
  try {
    const result = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM message
      WHERE is_read = 0 AND is_from_me = 0
    `
      )
      .get() as { count: number };

    return result.count;
  } finally {
    db.close();
  }
}

/**
 * Get attachments for a message
 */
export function getAttachmentsForMessage(messageId: number): Attachment[] {
  const db = getDatabase();
  try {
    const attachments = db
      .prepare(
        `
      SELECT
        a.rowid,
        a.filename,
        a.mime_type,
        a.transfer_name,
        a.total_bytes,
        a.is_sticker,
        CASE WHEN a.mime_type LIKE 'audio/%' AND a.transfer_name LIKE '%Audio Message%' THEN 1 ELSE 0 END as is_audio_message
      FROM attachment a
      JOIN message_attachment_join maj ON a.rowid = maj.attachment_id
      WHERE maj.message_id = ?
    `
      )
      .all(messageId) as RawAttachmentRow[];

    return attachments.map((att) => ({
      id: att.rowid,
      filename: att.transfer_name || att.filename,
      mimeType: att.mime_type,
      filePath: att.filename,
      fileSize: att.total_bytes,
      isSticker: att.is_sticker === 1,
      isAudioMessage: att.is_audio_message === 1,
    }));
  } finally {
    db.close();
  }
}

/**
 * Get recent attachments
 */
export function getRecentAttachments(
  days: number = 7,
  contact?: string,
  limit: number = 50
): Array<{ message: Message; attachments: Attachment[] }> {
  const db = getDatabase();
  try {
    const cocoaTimestamp = daysAgoToCocoaTimestamp(days);

    let query = `
      SELECT DISTINCT
        m.rowid,
        m.text,
        m.date,
        m.is_from_me,
        m.cache_has_attachments,
        h.id as handle_id,
        c.display_name as chat_name,
        c.chat_identifier
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.rowid
      LEFT JOIN chat_message_join cmj ON m.rowid = cmj.message_id
      LEFT JOIN chat c ON cmj.chat_id = c.rowid
      JOIN message_attachment_join maj ON m.rowid = maj.message_id
      WHERE m.date > ?
        AND m.cache_has_attachments = 1
    `;
    const params: (number | string)[] = [cocoaTimestamp];

    if (contact) {
      const formattedContact = formatPhoneNumber(contact);
      query += ` AND (h.id LIKE ? OR h.id = ? OR h.id LIKE ?)`;
      params.push(`%${contact}%`, formattedContact, `%${formattedContact}%`);
    }

    query += ` ORDER BY m.date DESC LIMIT ?`;
    params.push(limit);

    const messages = db.prepare(query).all(...params) as RawMessageRow[];

    return messages.map((msg) => ({
      message: {
        id: msg.rowid,
        text: msg.text || "(attachment)",
        date: formatDate(cocoaTimestampToDate(msg.date)),
        isFromMe: msg.is_from_me === 1,
        hasAttachments: true,
        contact: msg.handle_id || "Unknown",
        chatName: msg.chat_name || msg.chat_identifier || "Direct Message",
      },
      attachments: getAttachmentsForMessage(msg.rowid),
    }));
  } finally {
    db.close();
  }
}

/**
 * Get group chat members
 */
export function getGroupChatMembers(chatIdentifier: string): string[] {
  const db = getDatabase();
  try {
    const members = db
      .prepare(
        `
      SELECT h.id
      FROM handle h
      JOIN chat_handle_join chj ON h.rowid = chj.handle_id
      JOIN chat c ON chj.chat_id = c.rowid
      WHERE c.chat_identifier = ?
    `
      )
      .all(chatIdentifier) as Array<{ id: string }>;

    return members.map((m) => m.id);
  } finally {
    db.close();
  }
}

/**
 * Find chat by contact
 */
export function findChatByContact(contact: string): Chat | null {
  const db = getDatabase();
  try {
    const formattedContact = formatPhoneNumber(contact);

    const chat = db
      .prepare(
        `
      SELECT
        c.rowid,
        c.chat_identifier,
        c.display_name,
        c.service_name,
        c.style,
        (SELECT COUNT(*) FROM chat_message_join WHERE chat_id = c.rowid) as message_count,
        (SELECT MAX(m.date) FROM message m
         JOIN chat_message_join cmj ON m.rowid = cmj.message_id
         WHERE cmj.chat_id = c.rowid) as last_message_date
      FROM chat c
      WHERE c.chat_identifier LIKE ? OR c.chat_identifier = ? OR c.chat_identifier LIKE ?
      ORDER BY last_message_date DESC
      LIMIT 1
    `
      )
      .get(`%${contact}%`, formattedContact, `%${formattedContact}%`) as RawChatRow | undefined;

    if (!chat) return null;

    return {
      id: chat.rowid,
      identifier: chat.chat_identifier,
      displayName: chat.display_name || chat.chat_identifier,
      service: chat.service_name,
      isGroupChat: chat.style === 43,
      messageCount: chat.message_count,
      lastMessageDate: chat.last_message_date
        ? formatDate(cocoaTimestampToDate(chat.last_message_date))
        : "Unknown",
    };
  } finally {
    db.close();
  }
}
