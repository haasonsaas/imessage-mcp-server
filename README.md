# Enhanced iMessage MCP Server

A comprehensive MCP (Model Context Protocol) server for iMessage on macOS. Read, send, and search your messages with AI assistants like Claude.

## Features

### Tools (12 total)

| Tool | Description |
|------|-------------|
| `send_message` | Send iMessage or SMS with automatic fallback |
| `get_recent_messages` | Get recent messages with time/contact filters |
| `get_conversation` | Get conversation history with a specific contact |
| `search_messages` | Search messages by text content |
| `list_chats` | List all conversations including group chats |
| `get_unread_count` | Get count of unread messages |
| `check_imessage_available` | Check if recipient has iMessage |
| `search_contacts` | Search contacts by name, phone, or email |
| `get_attachments` | Get recent message attachments (photos, videos, files) |
| `get_group_chat_members` | Get members of a group chat |
| `find_chat` | Find a chat by contact info |
| `check_database_access` | Diagnose permission issues |

### Resources

| Resource | Description |
|----------|-------------|
| `contacts://all` | List of all contacts from Contacts app |
| `messages://recent` | Recent messages (last 24 hours) |
| `chats://all` | List of all chat conversations |

### Key Improvements Over Original

- **Read messages** - Query the Messages database directly
- **Search functionality** - Find messages by content
- **Conversation history** - Get full chat history with any contact
- **Group chat support** - Send messages to group chats, list members
- **SMS fallback** - Automatically falls back to SMS when iMessage unavailable
- **Unread count** - Check how many unread messages you have
- **Attachment info** - View details about photos, videos, and files
- **Database diagnostics** - Built-in permission troubleshooting
- **Modular codebase** - Well-organized, tested code

## Requirements

- macOS (Messages app integration)
- Node.js 18 or higher
- Full Disk Access permission (for reading Messages database)
- Active iMessage account

## Installation

### With Claude Code

```bash
claude mcp add imessage -- npx -y imessage-mcp-server
```

### With Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "imessage": {
      "command": "npx",
      "args": ["-y", "imessage-mcp-server"]
    }
  }
}
```

### From Source

```bash
git clone https://github.com/haasonsaas/imessage-mcp-server.git
cd imessage-mcp-server
npm install
npm run build
```

## Permissions

### Full Disk Access (Required for reading messages)

1. Open **System Preferences → Privacy & Security → Full Disk Access**
2. Click the lock to unlock settings
3. Click **+** and add your terminal app (Terminal, iTerm2, VS Code, etc.)
4. Restart your terminal/application

### Messages & Contacts Access

When you first use the server, macOS will prompt for:
- **Contacts access** - For contact search features
- **Messages access** - For sending messages via AppleScript

## Usage Examples

Once installed, you can interact naturally:

```
"Show me my recent messages"
"Get my conversation with John"
"Search my messages for 'dinner plans'"
"Send a message to 555-123-4567 saying I'm running late"
"How many unread messages do I have?"
"List my group chats"
"Check if john@example.com has iMessage"
"Show me recent photo attachments"
"Who's in the Family group chat?"
```

## How It Works

This server uses a hybrid approach:

- **AppleScript** for sending messages (reliable, works with iMessage/SMS)
- **SQLite** for reading messages (direct database access, fast queries)

The Messages database is located at `~/Library/Messages/chat.db` and requires Full Disk Access to read.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run watch

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Format
npm run format

# Full check (typecheck + lint + format + test)
npm run check

# Test with MCP Inspector
npm run inspector
```

## Project Structure

```
src/
├── index.ts           # Main MCP server entry point
└── lib/
    ├── types.ts       # TypeScript type definitions
    ├── utils.ts       # Pure utility functions
    ├── database.ts    # SQLite database operations
    └── applescript.ts # AppleScript operations
tests/
└── utils.test.ts      # Unit tests for utilities
```

## Troubleshooting

### "Cannot access Messages database"

1. Grant Full Disk Access (see Permissions above)
2. Restart your terminal
3. Run `check_database_access` tool to verify

### Messages not sending

1. Ensure Messages app is signed in
2. Check that the recipient is valid
3. For group chats, use the `groupChat: true` option

### No contacts showing

1. Grant Contacts access when prompted
2. Ensure Contacts app has contacts

## Security Notes

- All data stays local on your machine
- Database is opened in read-only mode
- No external network requests
- Messages are sent through your local Messages app

## License

MIT

## Credits

Based on [marissamarym/imessage-mcp-server](https://github.com/marissamarym/imessage-mcp-server), enhanced with:
- Direct database reading (inspired by [hannesrudolph/imessage-query-fastmcp-mcp-server](https://github.com/hannesrudolph/imessage-query-fastmcp-mcp-server))
- Additional tools from [carterlasalle/mac_messages_mcp](https://github.com/carterlasalle/mac_messages_mcp)
