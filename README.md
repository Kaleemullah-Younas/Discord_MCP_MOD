# Discord MCP Server

A Model Context Protocol (MCP) server that enables LLMs to interact with Discord channels, allowing them to send and read messages through Discord's API. Using this server, LLMs like Claude can directly interact with Discord channels while maintaining user control and security.

## Features

- Send messages to Discord channels
- Read recent messages from channels
- Automatic server and channel discovery
- Support for both channel names and IDs
- Proper error handling and validation

## Prerequisites

- Node.js 16.x or higher
- A Discord bot token
- The bot must be invited to your server with proper permissions:
  - Read Messages/View Channels
  - Send Messages
  - Read Message History

## Setup

1. Clone this repository:
```bash
git clone https://github.com/yourusername/discordmcp.git
cd discordmcp
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Discord bot token:
```
DISCORD_TOKEN=your_discord_bot_token_here
```

4. Build the server:
```bash
npm run build
```

## Usage with Claude for Desktop

1. Open your Claude for Desktop configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the Discord MCP server configuration:
```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["path/to/discordmcp/build/index.js"],
      "env": {
        "DISCORD_TOKEN": "your_discord_bot_token_here"
      }
    }
  }
}
```

3. Restart Claude for Desktop

## Available Tools

### send-message
Sends a message to a specified Discord channel.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)
- `channel`: Channel name (e.g., "general") or ID
- `message`: Message content to send

Example:
```json
{
  "channel": "general",
  "message": "Hello from MCP!"
}
```

### read-messages
Reads recent messages from a specified Discord channel.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)
- `channel`: Channel name (e.g., "general") or ID
- `limit` (optional): Number of messages to fetch (default: 50, max: 100)

Example:
```json
{
  "channel": "general",
  "limit": 10
}
```

### list-servers
Lists all servers (guilds) the bot is currently connected to.

Parameters:
- None

Example:
```json
{}
```

### list-channels
Lists all text channels in a specific server.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)

Example:
```json
{
  "server": "My Cool Server"
}
```

### create-channel
Creates a new text channel in a specific server.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)
- `channelName`: Name for the new text channel

Example:
```json
{
  "server": "My Cool Server",
  "channelName": "new-project-discussion"
}
```

### read-multiple-channels
Reads recent messages from multiple text channels in a server.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)
- `channels` (optional): List of channel names or IDs (defaults to all text channels if omitted)
- `limitPerChannel` (optional): Max messages per channel (default: 10, max: 50)

Example (read from specific channels):
```json
{
  "server": "My Cool Server",
  "channels": ["general", "announcements"],
  "limitPerChannel": 5
}
```

Example (read from all channels):
```json
{
  "server": "My Cool Server",
  "limitPerChannel": 3
}
```

### list-roles
Lists all roles in a specific server.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)

Example:
```json
{
  "server": "My Cool Server"
}
```

### assign-role
Assigns a role to a user in a server.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)
- `user`: User name#discriminator, user ID, or user mention
- `role`: Role name or ID

Example:
```json
{
  "server": "My Cool Server",
  "user": "SomeUser#1234",
  "role": "Moderator"
}
```

### remove-role
Removes a role from a user in a server.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)
- `user`: User name#discriminator, user ID, or user mention
- `role`: Role name or ID

Example:
```json
{
  "server": "My Cool Server",
  "user": "SomeUser#1234",
  "role": "Moderator"
}
```

### create-role
Creates a new role in a server.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)
- `roleName`: Name for the new role
- `color` (optional): Hex color code (e.g., "#FF0000")
- `permissions` (optional): List of permission names (e.g., ["SendMessages", "ManageMessages"])
- `mentionable` (optional): Boolean, whether the role is mentionable (default: false)

Example:
```json
{
  "server": "My Cool Server",
  "roleName": "Team Alpha",
  "color": "#3498db",
  "mentionable": true
}
```

### delete-role
Deletes a role from a server.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)
- `role`: Role name or ID to delete

Example:
```json
{
  "server": "My Cool Server",
  "role": "Old Role Name"
}
```

### update-role
Updates an existing role in a server.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)
- `role`: Role name or ID to update
- `newName` (optional): New name for the role
- `newColor` (optional): New hex color code
- `newPermissions` (optional): New list of permission names (replaces existing)
- `newMentionable` (optional): New mentionable status

Example:
```json
{
  "server": "My Cool Server",
  "role": "Team Alpha",
  "newName": "Team Bravo",
  "newColor": "#e67e22"
}
```

## Development

1. Install development dependencies:
```bash
npm install --save-dev typescript @types/node
```

2. Start the server in development mode:
```bash
npm run dev
```

## Testing

You can test the server using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

## Examples

Here are some example interactions you can try with Claude after setting up the Discord MCP server:

1. "Can you read the last 5 messages from the general channel?"
2. "Please send a message to the announcements channel saying 'Meeting starts in 10 minutes'"
3. "What were the most recent messages in the development channel about the latest release?"

Claude will use the appropriate tools to interact with Discord while asking for your approval before sending any messages.

## Security Considerations

- The bot requires proper Discord permissions to function
- All message sending operations require explicit user approval
- Environment variables should be properly secured
- Token should never be committed to version control
- Channel access is limited to channels the bot has been given access to

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions:
1. Check the GitHub Issues section
2. Consult the MCP documentation at https://modelcontextprotocol.io
3. Open a new issue with detailed reproduction steps