import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from 'dotenv';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Client, GatewayIntentBits, TextChannel, ChannelType, Role, GuildMember, PermissionsBitField, ColorResolvable } from 'discord.js'; // Added Role, GuildMember, PermissionsBitField, ColorResolvable
import { z } from 'zod';
import path from 'path'; // Import the path module
import { fileURLToPath } from 'url'; // Import fileURLToPath

// Determine the directory of the current module (__dirname equivalent for ES Modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in the project root (one level up from build)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Discord client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // Added GuildMembers intent for role management
  ],
});

// Helper function to find a guild by name or ID
async function findGuild(guildIdentifier?: string) {
  if (!guildIdentifier) {
    // If no guild specified and bot is only in one guild, use that
    if (client.guilds.cache.size === 1) {
      return client.guilds.cache.first()!;
    }
    // List available guilds
    const guildList = Array.from(client.guilds.cache.values())
      .map(g => `"${g.name}"`).join(', ');
    throw new Error(`Bot is in multiple servers. Please specify server name or ID. Available servers: ${guildList}`);
  }

  // Try to fetch by ID first
  try {
    const guild = await client.guilds.fetch(guildIdentifier);
    if (guild) return guild;
  } catch {
    // If ID fetch fails, search by name
    const guilds = client.guilds.cache.filter(
      g => g.name.toLowerCase() === guildIdentifier.toLowerCase()
    );
    
    if (guilds.size === 0) {
      const availableGuilds = Array.from(client.guilds.cache.values())
        .map(g => `"${g.name}"`).join(', ');
      throw new Error(`Server "${guildIdentifier}" not found. Available servers: ${availableGuilds}`);
    }
    if (guilds.size > 1) {
      const guildList = guilds.map(g => `${g.name} (ID: ${g.id})`).join(', ');
      throw new Error(`Multiple servers found with name "${guildIdentifier}": ${guildList}. Please specify the server ID.`);
    }
    return guilds.first()!;
  }
  throw new Error(`Server "${guildIdentifier}" not found`);
}

// Helper function to find a channel by name or ID within a specific guild
async function findChannel(channelIdentifier: string, guildIdentifier?: string): Promise<TextChannel> {
  const guild = await findGuild(guildIdentifier);
  
  // First try to fetch by ID
  try {
    const channel = await client.channels.fetch(channelIdentifier);
    if (channel instanceof TextChannel && channel.guild.id === guild.id) {
      return channel;
    }
  } catch {
    // If fetching by ID fails, search by name in the specified guild
    const channels = guild.channels.cache.filter(
      (channel): channel is TextChannel =>
        channel instanceof TextChannel &&
        (channel.name.toLowerCase() === channelIdentifier.toLowerCase() ||
         channel.name.toLowerCase() === channelIdentifier.toLowerCase().replace('#', ''))
    );

    if (channels.size === 0) {
      const availableChannels = guild.channels.cache
        .filter((c): c is TextChannel => c instanceof TextChannel)
        .map(c => `"#${c.name}"`).join(', ');
      throw new Error(`Channel "${channelIdentifier}" not found in server "${guild.name}". Available channels: ${availableChannels}`);
    }
    if (channels.size > 1) {
      const channelList = channels.map(c => `#${c.name} (${c.id})`).join(', ');
      throw new Error(`Multiple channels found with name "${channelIdentifier}" in server "${guild.name}": ${channelList}. Please specify the channel ID.`);
    }
    return channels.first()!;
  }
  throw new Error(`Channel "${channelIdentifier}" is not a text channel or not found in server "${guild.name}"`);
}

// Helper function to find a role by name or ID within a specific guild
async function findRole(roleIdentifier: string, guildIdentifier?: string): Promise<Role> {
  const guild = await findGuild(guildIdentifier);

  // Try fetching by ID first
  let role = guild.roles.cache.get(roleIdentifier);
  if (role) return role;

  // If not found by ID, search by name (case-insensitive)
  role = guild.roles.cache.find(r => r.name.toLowerCase() === roleIdentifier.toLowerCase());
  if (role) return role;

  // If still not found, try fetching all roles and searching again (in case cache is stale)
  try {
    await guild.roles.fetch(); // Refresh cache
    role = guild.roles.cache.get(roleIdentifier) ?? guild.roles.cache.find(r => r.name.toLowerCase() === roleIdentifier.toLowerCase());
    if (role) return role;
  } catch (error) {
    console.error(`Error fetching roles for guild ${guild.id}:`, error);
    // Fall through to throw not found error
  }

  const availableRoles = guild.roles.cache.map(r => `"${r.name}"`).join(', ');
  throw new Error(`Role "${roleIdentifier}" not found in server "${guild.name}". Available roles: ${availableRoles}`);
}

// Helper function to find a guild member by ID, username#discriminator, or mention
async function findMember(userIdentifier: string, guildIdentifier?: string): Promise<GuildMember> {
  const guild = await findGuild(guildIdentifier);

  // Try fetching by ID
  try {
    const member = await guild.members.fetch(userIdentifier.replace(/[<@!>]/g, '')); // Clean potential mention syntax
    if (member) return member;
  } catch {
    // Ignore error if ID fetch fails
  }

  // Try searching by username#discriminator
  const lowerUserIdentifier = userIdentifier.toLowerCase();
  let member = guild.members.cache.find(m => m.user.tag.toLowerCase() === lowerUserIdentifier);
  if (member) return member;

  // Try searching by nickname or username (less reliable)
  member = guild.members.cache.find(m =>
    (m.nickname?.toLowerCase() === lowerUserIdentifier) ||
    (m.user.username.toLowerCase() === lowerUserIdentifier)
  );
  if (member) return member;

  // If still not found, try fetching all members and searching again
  try {
    await guild.members.fetch(); // Refresh cache
    member = guild.members.cache.get(userIdentifier.replace(/[<@!>]/g, '')) ??
             guild.members.cache.find(m => m.user.tag.toLowerCase() === lowerUserIdentifier) ??
             guild.members.cache.find(m =>
               (m.nickname?.toLowerCase() === lowerUserIdentifier) ||
               (m.user.username.toLowerCase() === lowerUserIdentifier)
             );
    if (member) return member;
  } catch (error) {
    console.error(`Error fetching members for guild ${guild.id}:`, error);
    // Fall through to throw not found error
  }

  throw new Error(`User "${userIdentifier}" not found in server "${guild.name}".`);
}

// Updated validation schemas
const SendMessageSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  channel: z.string().describe('Channel name (e.g., "general") or ID'),
  message: z.string(),
});

const ReadMessagesSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  channel: z.string().describe('Channel name (e.g., "general") or ID'),
  limit: z.number().min(1).max(100).default(50),
});

// New validation schemas
const ReadMultipleChannelsSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  channels: z.array(z.string()).optional().describe('List of channel names or IDs (optional, defaults to all text channels)'),
  limitPerChannel: z.number().min(1).max(50).default(10).describe('Max messages per channel (default 10, max 50)'),
});
const ListChannelsSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
});

const ListServersSchema = z.object({}); // No arguments needed

const CreateChannelSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  channelName: z.string().describe('Name for the new text channel'),
});

// --- Role Management Schemas ---
const ListRolesSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
});

const AssignRoleSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  user: z.string().describe('User name#discriminator, user ID, or user mention'),
  role: z.string().describe('Role name or ID'),
});

const RemoveRoleSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  user: z.string().describe('User name#discriminator, user ID, or user mention'),
  role: z.string().describe('Role name or ID'),
});

const CreateRoleSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  roleName: z.string().describe('Name for the new role'),
  color: z.string().optional().describe('Hex color code for the role (e.g., #FF0000)'),
  permissions: z.array(z.string()).optional().describe('List of permission names (e.g., ["SendMessages", "ManageMessages"])'),
  mentionable: z.boolean().optional().default(false).describe('Whether the role should be mentionable'),
});

const DeleteRoleSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  role: z.string().describe('Role name or ID to delete'),
});

const UpdateRoleSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  role: z.string().describe('Role name or ID to update'),
  newName: z.string().optional().describe('New name for the role'),
  newColor: z.string().optional().describe('New hex color code for the role'),
  newPermissions: z.array(z.string()).optional().describe('New list of permission names (replaces existing)'),
  newMentionable: z.boolean().optional().describe('New mentionable status'),
});
// --- End Role Management Schemas ---

// --- Member Count Schemas ---
const GetMemberCountSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
});

const GetRoleMemberCountSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  role: z.string().describe('Role name or ID'),
});
// --- End Member Count Schemas ---

// Create server instance
const server = new Server(
  {
    name: "discord",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {}, // This might be dynamically populated or just a placeholder
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "send-message",
        description: "Send a message to a Discord channel",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Server name or ID (optional if bot is only in one server)',
            },
            channel: {
              type: "string",
              description: 'Channel name (e.g., "general") or ID',
            },
            message: {
              type: "string",
              description: "Message content to send",
            },
          },
          required: ["channel", "message"],
        },
      },
      {
        name: "read-messages",
        description: "Read recent messages from a Discord channel",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Server name or ID (optional if bot is only in one server)',
            },
            channel: {
              type: "string",
              description: 'Channel name (e.g., "general") or ID',
            },
            limit: {
              type: "number",
              description: "Number of messages to fetch (max 100)",
              default: 50,
            },
          },
          required: ["channel"],
        },
      },
      // New tool definitions
      {
        name: "list-channels",
        description: "List all text channels in a specific server",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Server name or ID (optional if bot is only in one server)',
            },
          },
          required: [], // Server is optional if bot is in only one
        },
      },
      {
        name: "list-servers",
        description: "List all servers the bot is connected to",
        inputSchema: { type: "object", properties: {} }, // No input needed
      },
      {
        name: "create-channel",
        description: "Create a new text channel in a specific server",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Server name or ID (optional if bot is only in one server)',
            },
            channelName: {
              type: "string",
              description: "Name for the new text channel",
            },
          },
          required: ["channelName"],
        },
      },
      // New tool: read-multiple-channels
      {
        name: "read-multiple-channels",
        description: "Read recent messages from multiple text channels in a server",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Server name or ID (optional if bot is only in one server)',
            },
            channels: {
              type: "array",
              items: { type: "string" },
              description: 'List of channel names or IDs (optional, defaults to all text channels)',
            },
            limitPerChannel: {
              type: "number",
              description: "Max messages per channel (default 10, max 50)",
              default: 10,
            },
          },
          required: [], // Server is optional, channels are optional
        },
      },
      // --- Role Management Tools ---
      {
        name: "list-roles",
        description: "List all roles in a specific server",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Server name or ID (optional if bot is only in one server)',
            },
          },
          required: [],
        },
      },
      {
        name: "assign-role",
        description: "Assign a role to a user in a server",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Server name or ID (optional if bot is only in one server)',
            },
            user: {
              type: "string",
              description: 'User name#discriminator, user ID, or user mention',
            },
            role: {
              type: "string",
              description: 'Role name or ID',
            },
          },
          required: ["user", "role"],
        },
      },
      {
        name: "remove-role",
        description: "Remove a role from a user in a server",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Server name or ID (optional if bot is only in one server)',
            },
            user: {
              type: "string",
              description: 'User name#discriminator, user ID, or user mention',
            },
            role: {
              type: "string",
              description: 'Role name or ID',
            },
          },
          required: ["user", "role"],
        },
      },
      {
        name: "create-role",
        description: "Create a new role in a server",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Server name or ID (optional if bot is only in one server)',
            },
            roleName: {
              type: "string",
              description: 'Name for the new role',
            },
            color: {
              type: "string",
              description: 'Hex color code for the role (e.g., #FF0000)',
            },
            permissions: {
              type: "array",
              items: { type: "string" },
              description: 'List of permission names (e.g., ["SendMessages", "ManageMessages"])',
            },
            mentionable: {
              type: "boolean",
              description: 'Whether the role should be mentionable',
              default: false,
            },
          },
          required: ["roleName"],
        },
      },
      {
        name: "delete-role",
        description: "Delete a role from a server",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Server name or ID (optional if bot is only in one server)',
            },
            role: {
              type: "string",
              description: 'Role name or ID to delete',
            },
          },
          required: ["role"],
        },
      },
      {
        name: "update-role",
        description: "Update an existing role in a server",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Server name or ID (optional if bot is only in one server)',
            },
            role: {
              type: "string",
              description: 'Role name or ID to update',
            },
            newName: {
              type: "string",
              description: 'New name for the role',
            },
            newColor: {
              type: "string",
              description: 'New hex color code for the role',
            },
            newPermissions: {
              type: "array",
              items: { type: "string" },
              description: 'New list of permission names (replaces existing)',
            },
            newMentionable: {
              type: "boolean",
              description: 'New mentionable status',
            },
          },
          required: ["role"],
        },
      },
      // --- End Role Management Tools ---
      // --- Member Count Tools ---
      {
        name: "get-member-count",
        description: "Get the total number of members in a specific server",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Server name or ID (optional if bot is only in one server)',
            },
          },
          required: [],
        },
      },
      {
        name: "get-role-member-count",
        description: "Get the number of members that have a specific role in a server",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Server name or ID (optional if bot is only in one server)',
            },
            role: {
              type: "string",
              description: 'Role name or ID',
            },
          },
          required: ["role"],
        },
      },
      // --- End Member Count Tools ---
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "send-message": {
        const { server: serverIdentifier, channel: channelIdentifier, message } = SendMessageSchema.parse(args);
        const channel = await findChannel(channelIdentifier, serverIdentifier);

        const sent = await channel.send(message);
        return {
          content: [{
            type: "text",
            text: `Message sent successfully to #${channel.name} in ${channel.guild.name}. Message ID: ${sent.id}`,
          }],
        };
      }

      case "read-messages": {
        const { server: serverIdentifier, channel: channelIdentifier, limit } = ReadMessagesSchema.parse(args);
        const channel = await findChannel(channelIdentifier, serverIdentifier);

        const messages = await channel.messages.fetch({ limit });
        const formattedMessages = Array.from(messages.values()).map(msg => ({
          channel: `#${channel.name}`,
          server: channel.guild.name,
          author: msg.author.tag,
          content: msg.content,
          timestamp: msg.createdAt.toISOString(),
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(formattedMessages, null, 2),
          }],
        };
      }

      // New tool handlers
      case "list-channels": {
        const { server: serverIdentifier } = ListChannelsSchema.parse(args);
        const guild = await findGuild(serverIdentifier);
        const textChannels = guild.channels.cache
          .filter((c): c is TextChannel => c instanceof TextChannel)
          .map(c => ({ id: c.id, name: c.name }));

        return {
          content: [{
            type: "text",
            text: `Text channels in server "${guild.name}":\n${JSON.stringify(textChannels, null, 2)}`,
          }],
        };
      }

      case "list-servers": {
        ListServersSchema.parse(args); // Validate no args are passed
        const guilds = Array.from(client.guilds.cache.values()).map(g => ({ id: g.id, name: g.name }));
        return {
          content: [{
            type: "text",
            text: `Bot is connected to the following servers:\n${JSON.stringify(guilds, null, 2)}`,
          }],
        };
      }

      case "create-channel": {
        const { server: serverIdentifier, channelName } = CreateChannelSchema.parse(args);
        const guild = await findGuild(serverIdentifier);

        // Check if channel already exists (case-insensitive)
        const existingChannel = guild.channels.cache.find(
          c => c.name.toLowerCase() === channelName.toLowerCase() && c.type === ChannelType.GuildText
        );
        if (existingChannel) {
          throw new Error(`A text channel named "${channelName}" already exists in server "${guild.name}".`);
        }

        const createdChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
        });

        return {
          content: [{
            type: "text",
            text: `Successfully created text channel #${createdChannel.name} (ID: ${createdChannel.id}) in server "${guild.name}".`,
          }],
        };
      }

      case "read-multiple-channels": {
        const { server: serverIdentifier, channels: channelIdentifiers, limitPerChannel } = ReadMultipleChannelsSchema.parse(args);
        const guild = await findGuild(serverIdentifier);

        let targetChannels: TextChannel[];

        if (channelIdentifiers && channelIdentifiers.length > 0) {
          // Find specified channels
          targetChannels = await Promise.all(
            channelIdentifiers.map(id => findChannel(id, guild.id))
          );
        } else {
          // Find all text channels in the guild
          targetChannels = Array.from(guild.channels.cache.values()).filter(
            (c): c is TextChannel => c instanceof TextChannel
          );
        }

        if (targetChannels.length === 0) {
          return {
            content: [{ type: "text", text: `No text channels found or specified in server "${guild.name}".` }],
          };
        }

        const allMessages: any[] = [];
        for (const channel of targetChannels) {
          try {
            const messages = await channel.messages.fetch({ limit: limitPerChannel });
            const formattedMessages = Array.from(messages.values()).map(msg => ({
              channel: `#${channel.name}`,
              server: channel.guild.name,
              author: msg.author.tag,
              content: msg.content,
              timestamp: msg.createdAt.toISOString(),
            }));
            allMessages.push(...formattedMessages);
          } catch (channelError) {
            // Log error fetching from a specific channel but continue with others
            console.error(`Error fetching messages from #${channel.name}:`, channelError);
            allMessages.push({
              channel: `#${channel.name}`,
              server: channel.guild.name,
              error: `Failed to fetch messages: ${channelError instanceof Error ? channelError.message : 'Unknown error'}`, 
            });
          }
        }

        // Sort messages by timestamp descending (newest first)
        allMessages.sort((a, b) => (b.timestamp && a.timestamp ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() : 0));

        return {
          content: [{ 
            type: "text", 
            text: `Fetched messages from ${targetChannels.length} channel(s) in "${guild.name}":\n${JSON.stringify(allMessages, null, 2)}` 
          }],
        };
      }

      // --- Role Management Handlers ---
      case "list-roles": {
        const { server: serverIdentifier } = ListRolesSchema.parse(args);
        const guild = await findGuild(serverIdentifier);
        await guild.roles.fetch(); // Ensure cache is up-to-date
        const roles = guild.roles.cache.map(role => ({
          id: role.id,
          name: role.name,
          color: role.hexColor,
          position: role.position,
          permissions: role.permissions.toArray(),
          mentionable: role.mentionable,
        })); //.sort((a, b) => b.position - a.position); // Sort by position

        return {
          content: [{
            type: "text",
            text: `Roles in server "${guild.name}":\n${JSON.stringify(roles, null, 2)}`,
          }],
        };
      }

      case "assign-role": {
        const { server: serverIdentifier, user: userIdentifier, role: roleIdentifier } = AssignRoleSchema.parse(args);
        const guild = await findGuild(serverIdentifier);
        const member = await findMember(userIdentifier, guild.id);
        const role = await findRole(roleIdentifier, guild.id);

        if (member.roles.cache.has(role.id)) {
          throw new Error(`User ${member.user.tag} already has the role "${role.name}".`);
        }

        await member.roles.add(role);
        return {
          content: [{
            type: "text",
            text: `Successfully assigned role "${role.name}" to user ${member.user.tag} in server "${guild.name}".`,
          }],
        };
      }

      case "remove-role": {
        const { server: serverIdentifier, user: userIdentifier, role: roleIdentifier } = RemoveRoleSchema.parse(args);
        const guild = await findGuild(serverIdentifier);
        const member = await findMember(userIdentifier, guild.id);
        const role = await findRole(roleIdentifier, guild.id);

        if (!member.roles.cache.has(role.id)) {
          throw new Error(`User ${member.user.tag} does not have the role "${role.name}".`);
        }

        await member.roles.remove(role);
        return {
          content: [{
            type: "text",
            text: `Successfully removed role "${role.name}" from user ${member.user.tag} in server "${guild.name}".`,
          }],
        };
      }

      case "create-role": {
        const { server: serverIdentifier, roleName, color, permissions, mentionable } = CreateRoleSchema.parse(args);
        const guild = await findGuild(serverIdentifier);

        // Check if role already exists (case-insensitive)
        const existingRole = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
        if (existingRole) {
          throw new Error(`A role named "${roleName}" already exists in server "${guild.name}".`);
        }

        // Validate permissions if provided
        let validatedPermissions: bigint[] | undefined = undefined;
        if (permissions) {
          validatedPermissions = permissions.map(p => {
            if (!(p in PermissionsBitField.Flags)) {
              throw new Error(`Invalid permission name: ${p}. Valid permissions: ${Object.keys(PermissionsBitField.Flags).join(', ')}`);
            }
            return PermissionsBitField.Flags[p as keyof typeof PermissionsBitField.Flags];
          });
        }

        const createdRole = await guild.roles.create({
          name: roleName,
          color: color as ColorResolvable | undefined, // Type assertion
          permissions: validatedPermissions,
          mentionable: mentionable,
        });

        return {
          content: [{
            type: "text",
            text: `Successfully created role "${createdRole.name}" (ID: ${createdRole.id}) in server "${guild.name}".`,
          }],
        };
      }

      case "delete-role": {
        const { server: serverIdentifier, role: roleIdentifier } = DeleteRoleSchema.parse(args);
        const guild = await findGuild(serverIdentifier);
        const role = await findRole(roleIdentifier, guild.id);

        await role.delete(`Deleted via MCP tool by request`);
        return {
          content: [{
            type: "text",
            text: `Successfully deleted role "${role.name}" (ID: ${role.id}) from server "${guild.name}".`,
          }],
        };
      }

      case "update-role": {
        const { server: serverIdentifier, role: roleIdentifier, newName, newColor, newPermissions, newMentionable } = UpdateRoleSchema.parse(args);
        const guild = await findGuild(serverIdentifier);
        const role = await findRole(roleIdentifier, guild.id);

        const updates: { name?: string; color?: ColorResolvable; permissions?: bigint[]; mentionable?: boolean } = {};
        if (newName !== undefined) updates.name = newName;
        if (newColor !== undefined) updates.color = newColor as ColorResolvable;
        if (newMentionable !== undefined) updates.mentionable = newMentionable;

        if (newPermissions !== undefined) {
          updates.permissions = newPermissions.map(p => {
            if (!(p in PermissionsBitField.Flags)) {
              throw new Error(`Invalid permission name: ${p}. Valid permissions: ${Object.keys(PermissionsBitField.Flags).join(', ')}`);
            }
            return PermissionsBitField.Flags[p as keyof typeof PermissionsBitField.Flags];
          });
        }

        if (Object.keys(updates).length === 0) {
          throw new Error("No update parameters provided for the role.");
        }

        // Apply updates with reason
        const updatedRole = await role.edit({
          ...updates,
          reason: `Updated via MCP tool by request`
        });

        return {
          content: [{
            type: "text",
            text: `Successfully updated role "${updatedRole.name}" (ID: ${updatedRole.id}) in server "${guild.name}".`,
          }],
        };
      }
      // --- End Role Management Handlers ---

      // --- Member Count Handlers ---
      case "get-member-count": {
        const { server: serverIdentifier } = GetMemberCountSchema.parse(args);
        const guild = await findGuild(serverIdentifier);
        // Ensure member count is up-to-date by fetching the guild object again or fetching members
        await guild.members.fetch(); // Fetching members often updates the count implicitly
        const memberCount = guild.memberCount;

        return {
          content: [{
            type: "text",
            text: `Server "${guild.name}" has ${memberCount} members.`,
          }],
        };
      }

      case "get-role-member-count": {
        const { server: serverIdentifier, role: roleIdentifier } = GetRoleMemberCountSchema.parse(args);
        const guild = await findGuild(serverIdentifier);
        const role = await findRole(roleIdentifier, guild.id);

        // Fetch all members to ensure the cache is populated for accurate filtering
        await guild.members.fetch();
        const membersWithRole = guild.members.cache.filter(member => member.roles.cache.has(role.id));

        return {
          content: [{
            type: "text",
            text: `There are ${membersWithRole.size} members with the role "${role.name}" in server "${guild.name}".`,
          }],
        };
      }
      // --- End Member Count Handlers ---

      default:
        throw new Error(`Unknown tool: ${name}`);
    } // End switch
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    // Rethrow other errors, including Discord API errors or custom errors
    if (error instanceof Error) {
        throw new Error(`Tool execution failed: ${error.message}`);
    }
    throw new Error(`An unknown error occurred during tool execution.`);
  }
});

// Discord client login and error handling
client.once('ready', () => {
  console.error('Discord bot is ready!');
});

// Start the server
async function main() {
  // Check for Discord token
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error('DISCORD_TOKEN environment variable is not set');
  }
  
  try {
    // Login to Discord
    await client.login(token);

    // Start MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Discord MCP Server running on stdio");
  } catch (error) {
    console.error("Fatal error in main():", error);
    process.exit(1);
  }
}

main();