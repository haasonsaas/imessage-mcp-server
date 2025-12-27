#!/usr/bin/env node
/**
 * Enhanced iMessage MCP Server
 *
 * A comprehensive MCP server for iMessage that provides:
 * - Send messages via AppleScript (iMessage + SMS fallback)
 * - Read messages directly from the Messages database
 * - Search messages by content
 * - List and manage conversations
 * - Contact management and search
 * - Group chat support
 * - iMessage availability checking
 * - Attachment information
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { checkDatabaseAccess, getRecentMessages, getConversation, searchMessages, listChats, getUnreadCount, getDatabaseStats, getRecentAttachments, getGroupChatMembers, findChatByContact, } from "./lib/database.js";
import { sendMessage, checkImessageAvailable, getAllContacts, searchContacts, } from "./lib/applescript.js";
import { getErrorMessage, normalizeLimit, normalizeHours, normalizeDays, formatFileSize, } from "./lib/utils.js";
const VERSION = "0.2.0";
// Server setup
const server = new Server({
    name: "imessage-mcp-server",
    version: VERSION,
}, {
    capabilities: {
        resources: {},
        tools: {},
    },
});
// Resources
server.setRequestHandler(ListResourcesRequestSchema, () => __awaiter(void 0, void 0, void 0, function* () {
    return {
        resources: [
            {
                uri: "contacts://all",
                mimeType: "application/json",
                name: "All Contacts",
                description: "List of all contacts from the Contacts app",
            },
            {
                uri: "messages://recent",
                mimeType: "application/json",
                name: "Recent Messages",
                description: "Recent messages from all conversations (last 24 hours)",
            },
            {
                uri: "chats://all",
                mimeType: "application/json",
                name: "All Chats",
                description: "List of all chat conversations",
            },
        ],
    };
}));
server.setRequestHandler(ReadResourceRequestSchema, (request) => __awaiter(void 0, void 0, void 0, function* () {
    const uri = request.params.uri;
    if (uri === "contacts://all") {
        try {
            const contacts = yield getAllContacts();
            return {
                contents: [{ uri, mimeType: "application/json", text: JSON.stringify(contacts, null, 2) }],
            };
        }
        catch (error) {
            throw new Error(`Failed to fetch contacts: ${getErrorMessage(error)}`);
        }
    }
    if (uri === "messages://recent") {
        const dbCheck = checkDatabaseAccess();
        if (!dbCheck.accessible) {
            throw new Error(dbCheck.error);
        }
        const messages = getRecentMessages(24, undefined, 100);
        return {
            contents: [{ uri, mimeType: "application/json", text: JSON.stringify(messages, null, 2) }],
        };
    }
    if (uri === "chats://all") {
        const dbCheck = checkDatabaseAccess();
        if (!dbCheck.accessible) {
            throw new Error(dbCheck.error);
        }
        const chats = listChats(50, true);
        return {
            contents: [{ uri, mimeType: "application/json", text: JSON.stringify(chats, null, 2) }],
        };
    }
    throw new Error(`Unknown resource: ${uri}`);
}));
// Tools
server.setRequestHandler(ListToolsRequestSchema, () => __awaiter(void 0, void 0, void 0, function* () {
    return {
        tools: [
            {
                name: "send_message",
                description: "Send an iMessage or SMS. Automatically falls back to SMS if iMessage is unavailable.",
                inputSchema: {
                    type: "object",
                    properties: {
                        recipient: {
                            type: "string",
                            description: "Phone number or email of the recipient",
                        },
                        message: {
                            type: "string",
                            description: "Message content to send",
                        },
                        groupChat: {
                            type: "boolean",
                            description: "Set to true if sending to a group chat (use chat identifier as recipient)",
                            default: false,
                        },
                    },
                    required: ["recipient", "message"],
                },
            },
            {
                name: "get_recent_messages",
                description: "Get recent messages, optionally filtered by contact or time range",
                inputSchema: {
                    type: "object",
                    properties: {
                        hours: {
                            type: "number",
                            description: "Number of hours to look back (default: 24, max: 168)",
                            default: 24,
                        },
                        contact: {
                            type: "string",
                            description: "Filter by phone number or email (optional)",
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of messages to return (default: 50, max: 500)",
                            default: 50,
                        },
                    },
                },
            },
            {
                name: "get_conversation",
                description: "Get the conversation history with a specific contact",
                inputSchema: {
                    type: "object",
                    properties: {
                        contact: {
                            type: "string",
                            description: "Phone number or email of the contact",
                        },
                        days: {
                            type: "number",
                            description: "Number of days to look back (default: 7, max: 365)",
                            default: 7,
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of messages to return (default: 100, max: 1000)",
                            default: 100,
                        },
                    },
                    required: ["contact"],
                },
            },
            {
                name: "search_messages",
                description: "Search messages by text content",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Text to search for in messages",
                        },
                        days: {
                            type: "number",
                            description: "Number of days to search back (default: 30, max: 365)",
                            default: 30,
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of results (default: 50, max: 200)",
                            default: 50,
                        },
                    },
                    required: ["query"],
                },
            },
            {
                name: "list_chats",
                description: "List all chat conversations including group chats",
                inputSchema: {
                    type: "object",
                    properties: {
                        limit: {
                            type: "number",
                            description: "Maximum number of chats to return (default: 30, max: 100)",
                            default: 30,
                        },
                        includeGroupChats: {
                            type: "boolean",
                            description: "Include group chats in results (default: true)",
                            default: true,
                        },
                    },
                },
            },
            {
                name: "get_unread_count",
                description: "Get the count of unread messages",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "check_imessage_available",
                description: "Check if a recipient has iMessage available (vs SMS only)",
                inputSchema: {
                    type: "object",
                    properties: {
                        recipient: {
                            type: "string",
                            description: "Phone number or email to check",
                        },
                    },
                    required: ["recipient"],
                },
            },
            {
                name: "search_contacts",
                description: "Search contacts by name, phone number, or email",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Search query (name, phone, or email)",
                        },
                    },
                    required: ["query"],
                },
            },
            {
                name: "get_attachments",
                description: "Get recent message attachments (photos, videos, files)",
                inputSchema: {
                    type: "object",
                    properties: {
                        days: {
                            type: "number",
                            description: "Number of days to look back (default: 7, max: 30)",
                            default: 7,
                        },
                        contact: {
                            type: "string",
                            description: "Filter by phone number or email (optional)",
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of messages with attachments (default: 20, max: 100)",
                            default: 20,
                        },
                    },
                },
            },
            {
                name: "get_group_chat_members",
                description: "Get the members of a group chat",
                inputSchema: {
                    type: "object",
                    properties: {
                        chatIdentifier: {
                            type: "string",
                            description: "The chat identifier (can be found from list_chats)",
                        },
                    },
                    required: ["chatIdentifier"],
                },
            },
            {
                name: "find_chat",
                description: "Find a chat by contact phone number or email",
                inputSchema: {
                    type: "object",
                    properties: {
                        contact: {
                            type: "string",
                            description: "Phone number or email to search for",
                        },
                    },
                    required: ["contact"],
                },
            },
            {
                name: "check_database_access",
                description: "Check if the Messages database is accessible. Useful for diagnosing permission issues.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
        ],
    };
}));
server.setRequestHandler(CallToolRequestSchema, (request) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, arguments: args } = request.params;
    switch (name) {
        case "send_message": {
            const recipient = String((args === null || args === void 0 ? void 0 : args.recipient) || "");
            const message = String((args === null || args === void 0 ? void 0 : args.message) || "");
            const groupChat = Boolean(args === null || args === void 0 ? void 0 : args.groupChat);
            if (!recipient || !message) {
                throw new Error("Recipient and message are required");
            }
            try {
                const result = yield sendMessage(recipient, message, groupChat);
                return {
                    content: [{ type: "text", text: result }],
                };
            }
            catch (error) {
                return {
                    content: [{ type: "text", text: getErrorMessage(error) }],
                    isError: true,
                };
            }
        }
        case "get_recent_messages": {
            const hours = normalizeHours(args === null || args === void 0 ? void 0 : args.hours, 24, 168);
            const contact = (args === null || args === void 0 ? void 0 : args.contact) ? String(args.contact) : undefined;
            const limit = normalizeLimit(args === null || args === void 0 ? void 0 : args.limit, 50, 500);
            const dbCheck = checkDatabaseAccess();
            if (!dbCheck.accessible) {
                return {
                    content: [{ type: "text", text: dbCheck.error }],
                    isError: true,
                };
            }
            const messages = getRecentMessages(hours, contact, limit);
            return {
                content: [{ type: "text", text: JSON.stringify(messages, null, 2) }],
            };
        }
        case "get_conversation": {
            const contact = String((args === null || args === void 0 ? void 0 : args.contact) || "");
            const days = normalizeDays(args === null || args === void 0 ? void 0 : args.days, 7, 365);
            const limit = normalizeLimit(args === null || args === void 0 ? void 0 : args.limit, 100, 1000);
            if (!contact) {
                throw new Error("Contact is required");
            }
            const dbCheck = checkDatabaseAccess();
            if (!dbCheck.accessible) {
                return {
                    content: [{ type: "text", text: dbCheck.error }],
                    isError: true,
                };
            }
            const messages = getConversation(contact, days, limit);
            return {
                content: [
                    {
                        type: "text",
                        text: `Conversation with ${contact} (last ${days} days):\n\n${JSON.stringify(messages, null, 2)}`,
                    },
                ],
            };
        }
        case "search_messages": {
            const query = String((args === null || args === void 0 ? void 0 : args.query) || "");
            const days = normalizeDays(args === null || args === void 0 ? void 0 : args.days, 30, 365);
            const limit = normalizeLimit(args === null || args === void 0 ? void 0 : args.limit, 50, 200);
            if (!query) {
                throw new Error("Search query is required");
            }
            const dbCheck = checkDatabaseAccess();
            if (!dbCheck.accessible) {
                return {
                    content: [{ type: "text", text: dbCheck.error }],
                    isError: true,
                };
            }
            const messages = searchMessages(query, days, limit);
            return {
                content: [
                    {
                        type: "text",
                        text: `Found ${messages.length} messages matching "${query}":\n\n${JSON.stringify(messages, null, 2)}`,
                    },
                ],
            };
        }
        case "list_chats": {
            const limit = normalizeLimit(args === null || args === void 0 ? void 0 : args.limit, 30, 100);
            const includeGroupChats = (args === null || args === void 0 ? void 0 : args.includeGroupChats) !== false;
            const dbCheck = checkDatabaseAccess();
            if (!dbCheck.accessible) {
                return {
                    content: [{ type: "text", text: dbCheck.error }],
                    isError: true,
                };
            }
            const chats = listChats(limit, includeGroupChats);
            return {
                content: [{ type: "text", text: JSON.stringify(chats, null, 2) }],
            };
        }
        case "get_unread_count": {
            const dbCheck = checkDatabaseAccess();
            if (!dbCheck.accessible) {
                return {
                    content: [{ type: "text", text: dbCheck.error }],
                    isError: true,
                };
            }
            const count = getUnreadCount();
            return {
                content: [{ type: "text", text: `You have ${count} unread message(s).` }],
            };
        }
        case "check_imessage_available": {
            const recipient = String((args === null || args === void 0 ? void 0 : args.recipient) || "");
            if (!recipient) {
                throw new Error("Recipient is required");
            }
            try {
                const isAvailable = yield checkImessageAvailable(recipient);
                return {
                    content: [
                        {
                            type: "text",
                            text: isAvailable
                                ? `✅ ${recipient} has iMessage available - messages will be sent via iMessage`
                                : `📱 ${recipient} does not have iMessage - messages will be sent via SMS`,
                        },
                    ],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Could not determine iMessage availability: ${getErrorMessage(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
        case "search_contacts": {
            const query = String((args === null || args === void 0 ? void 0 : args.query) || "");
            if (!query) {
                throw new Error("Search query is required");
            }
            try {
                const contacts = yield searchContacts(query);
                return {
                    content: [{ type: "text", text: JSON.stringify(contacts, null, 2) }],
                };
            }
            catch (error) {
                return {
                    content: [{ type: "text", text: `Search failed: ${getErrorMessage(error)}` }],
                    isError: true,
                };
            }
        }
        case "get_attachments": {
            const days = normalizeDays(args === null || args === void 0 ? void 0 : args.days, 7, 30);
            const contact = (args === null || args === void 0 ? void 0 : args.contact) ? String(args.contact) : undefined;
            const limit = normalizeLimit(args === null || args === void 0 ? void 0 : args.limit, 20, 100);
            const dbCheck = checkDatabaseAccess();
            if (!dbCheck.accessible) {
                return {
                    content: [{ type: "text", text: dbCheck.error }],
                    isError: true,
                };
            }
            const results = getRecentAttachments(days, contact, limit);
            const formatted = results.map((item) => ({
                message: Object.assign(Object.assign({}, item.message), { attachments: item.attachments.map((att) => ({
                        filename: att.filename,
                        type: att.mimeType,
                        size: formatFileSize(att.fileSize),
                        isSticker: att.isSticker,
                        isAudioMessage: att.isAudioMessage,
                    })) }),
            }));
            return {
                content: [
                    {
                        type: "text",
                        text: `Found ${results.length} messages with attachments:\n\n${JSON.stringify(formatted, null, 2)}`,
                    },
                ],
            };
        }
        case "get_group_chat_members": {
            const chatIdentifier = String((args === null || args === void 0 ? void 0 : args.chatIdentifier) || "");
            if (!chatIdentifier) {
                throw new Error("Chat identifier is required");
            }
            const dbCheck = checkDatabaseAccess();
            if (!dbCheck.accessible) {
                return {
                    content: [{ type: "text", text: dbCheck.error }],
                    isError: true,
                };
            }
            const members = getGroupChatMembers(chatIdentifier);
            return {
                content: [
                    {
                        type: "text",
                        text: members.length > 0
                            ? `Group chat members:\n${members.map((m) => `- ${m}`).join("\n")}`
                            : "No members found or this is not a group chat.",
                    },
                ],
            };
        }
        case "find_chat": {
            const contact = String((args === null || args === void 0 ? void 0 : args.contact) || "");
            if (!contact) {
                throw new Error("Contact is required");
            }
            const dbCheck = checkDatabaseAccess();
            if (!dbCheck.accessible) {
                return {
                    content: [{ type: "text", text: dbCheck.error }],
                    isError: true,
                };
            }
            const chat = findChatByContact(contact);
            if (chat) {
                return {
                    content: [{ type: "text", text: JSON.stringify(chat, null, 2) }],
                };
            }
            else {
                return {
                    content: [{ type: "text", text: `No chat found for ${contact}` }],
                };
            }
        }
        case "check_database_access": {
            const result = checkDatabaseAccess();
            if (result.accessible) {
                const stats = getDatabaseStats();
                return {
                    content: [
                        {
                            type: "text",
                            text: `✅ Database access OK!\n\nStats:\n- Total messages: ${stats.totalMessages}\n- Total chats: ${stats.totalChats}\n- Total contacts in Messages: ${stats.totalContacts}`,
                        },
                    ],
                };
            }
            else {
                return {
                    content: [
                        {
                            type: "text",
                            text: `❌ Database access failed:\n\n${result.error}\n\nTo fix:\n1. Open System Preferences → Privacy & Security → Full Disk Access\n2. Add your terminal application (Terminal, iTerm2, etc.)\n3. Restart your terminal`,
                        },
                    ],
                    isError: true,
                };
            }
        }
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}));
// Main entry point
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const transport = new StdioServerTransport();
            yield server.connect(transport);
            console.error(`Enhanced iMessage MCP server started (v${VERSION})`);
        }
        catch (error) {
            console.error("Server error:", error);
            process.exit(1);
        }
    });
}
main();
