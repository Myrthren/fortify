import { ChannelType, Guild, TextChannel, type Client } from "discord.js";

/**
 * Server admin tools for the Discord assistant.
 *
 * SECURITY MODEL — read before adding a tool.
 *
 * The assistant reads channel messages and feeds them to Claude, so any message
 * it can see is candidate instruction text. Three rules keep that from turning
 * into a server takeover:
 *
 *  1. Owner only, by user id. buildAdminTools() returns [] for everyone else, so
 *     for any other user these tools do not exist in the request at all — there
 *     is no prompt to talk past. Tier gating would not be enough: any Elite
 *     subscriber could otherwise restructure the server by asking politely.
 *  2. Tier roles are never assignable. They are billing state owned by the
 *     PayPal/Whop webhooks. If the assistant could grant Apex, the paywall would
 *     be decorative.
 *  3. Every mutating tool requires confirm:true. The first call returns a preview
 *     only, so the owner sees exactly what will happen and has to say yes.
 *
 * Every executed action is mirrored to ADMIN_AUDIT_CHANNEL_ID when set.
 */

export const OWNER_ID = "731207920007643167";

/** Billing-owned roles. Never assignable or removable through the assistant. */
const PROTECTED_ROLE_IDS = new Set([
  "1497408012816744568", // Apex
  "1497408076486148247", // Elite
  "1497408133444931664", // Pro
]);

const AUDIT_CHANNEL_ID = process.env.ADMIN_AUDIT_CHANNEL_ID ?? "";

// ── Tool definitions ─────────────────────────────────────────────────────────

const confirmProp = {
  confirm: {
    type: "boolean" as const,
    description:
      "Must be true to actually perform this. Call once without it to get a preview, show that preview to the user, and only call again with confirm:true after they explicitly agree.",
  },
};

export const ADMIN_TOOLS = [
  {
    name: "list_channels",
    description: "List the server's channels and categories with their ids. Use this to resolve a channel name to an id before acting on it.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "list_roles",
    description: "List the server's roles with their ids and positions. Use this to resolve a role name to an id.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "find_member",
    description: "Look up a guild member by username or display name. Returns their user id.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "Username or display name to search for." } },
      required: ["query"],
    },
  },
  {
    name: "create_channel",
    description: "Create a text channel, optionally inside a category.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Channel name, e.g. 'announcements'." },
        categoryId: { type: "string", description: "Optional category id to nest it under." },
        ...confirmProp,
      },
      required: ["name"],
    },
  },
  {
    name: "create_category",
    description: "Create a category to group channels under.",
    input_schema: {
      type: "object" as const,
      properties: { name: { type: "string" }, ...confirmProp },
      required: ["name"],
    },
  },
  {
    name: "rename_channel",
    description: "Rename an existing channel.",
    input_schema: {
      type: "object" as const,
      properties: {
        channelId: { type: "string" },
        name: { type: "string", description: "The new name." },
        ...confirmProp,
      },
      required: ["channelId", "name"],
    },
  },
  {
    name: "create_role",
    description: "Create a new role. Cannot grant administrator or other privileged permissions.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        colour: { type: "string", description: "Optional hex colour, e.g. '#5865F2'." },
        hoist: { type: "boolean", description: "Show members with this role separately in the member list." },
        ...confirmProp,
      },
      required: ["name"],
    },
  },
  {
    name: "assign_role",
    description:
      "Add or remove a role for a member. Subscription tier roles (Pro/Elite/Apex) are protected and will always be refused — those are set by billing.",
    input_schema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Discord user id — use find_member first if you only have a name." },
        roleId: { type: "string" },
        action: { type: "string", enum: ["add", "remove"] },
        ...confirmProp,
      },
      required: ["userId", "roleId", "action"],
    },
  },
  {
    name: "send_channel_message",
    description: "Post a message to a channel as the bot. This is publicly visible — always preview it first.",
    input_schema: {
      type: "object" as const,
      properties: {
        channelId: { type: "string" },
        content: { type: "string" },
        ...confirmProp,
      },
      required: ["channelId", "content"],
    },
  },
  {
    name: "set_channel_permissions",
    description:
      "Allow or deny a role's access to a channel. Only view/send/read-history are adjustable.",
    input_schema: {
      type: "object" as const,
      properties: {
        channelId: { type: "string" },
        roleId: { type: "string" },
        canView: { type: "boolean" },
        canSend: { type: "boolean" },
        ...confirmProp,
      },
      required: ["channelId", "roleId"],
    },
  },
  {
    name: "pin_message",
    description: "Pin a message in a channel.",
    input_schema: {
      type: "object" as const,
      properties: {
        channelId: { type: "string" },
        messageId: { type: "string" },
        ...confirmProp,
      },
      required: ["channelId", "messageId"],
    },
  },
];

/**
 * Returns the admin tool set only for the owner. Everyone else gets none, so the
 * tools are absent from the request entirely rather than merely refused.
 */
export function buildAdminTools(authorId: string) {
  return authorId === OWNER_ID ? ADMIN_TOOLS : [];
}

// ── Execution ────────────────────────────────────────────────────────────────

async function audit(client: Client, line: string) {
  if (!AUDIT_CHANNEL_ID) return;
  try {
    const ch = await client.channels.fetch(AUDIT_CHANNEL_ID);
    if (ch?.isTextBased()) await (ch as TextChannel).send(`🛠️ ${line}`);
  } catch {
    // auditing must never block the action
  }
}

function needsConfirm(preview: string): string {
  return `NOT YET DONE — confirmation required.\n\n${preview}\n\nShow this to the user and ask them to confirm. Only if they explicitly agree, call the tool again with confirm:true.`;
}

/**
 * Runs an admin tool. Re-checks the owner id even though buildAdminTools already
 * gated it — defence in depth, so a future refactor can't silently open this up.
 */
export async function runAdminTool(
  name: string,
  input: any,
  ctx: { guild: Guild | null; client: Client; authorId: string }
): Promise<string> {
  if (ctx.authorId !== OWNER_ID) return "Refused: these tools are owner-only.";
  const guild = ctx.guild;
  if (!guild) return "Refused: this must be used inside the server, not a DM.";

  try {
    switch (name) {
      case "list_channels": {
        const channels = await guild.channels.fetch();
        const lines = [...channels.values()]
          .filter(Boolean)
          .map((c: any) =>
            `${c.type === ChannelType.GuildCategory ? "[category]" : "[channel] "} ${c.name} — ${c.id}`
          );
        return lines.join("\n") || "No channels found.";
      }

      case "list_roles": {
        const roles = await guild.roles.fetch();
        return (
          [...roles.values()]
            .sort((a, b) => b.position - a.position)
            .map((r) => {
              const locked = PROTECTED_ROLE_IDS.has(r.id) ? " (PROTECTED — billing)" : "";
              return `${r.name} — ${r.id} (position ${r.position})${locked}`;
            })
            .join("\n") || "No roles found."
        );
      }

      case "find_member": {
        const q = String(input.query ?? "").toLowerCase();
        if (!q) return "Provide a query.";
        const members = await guild.members.fetch();
        const hits = [...members.values()]
          .filter(
            (m) =>
              m.user.username.toLowerCase().includes(q) ||
              (m.displayName ?? "").toLowerCase().includes(q)
          )
          .slice(0, 10);
        if (hits.length === 0) return `No member matching "${input.query}".`;
        return hits.map((m) => `${m.displayName} (@${m.user.username}) — ${m.id}`).join("\n");
      }

      case "create_category": {
        const chanName = String(input.name ?? "").trim();
        if (!chanName) return "Provide a name.";
        if (!input.confirm) return needsConfirm(`Create a new category named "${chanName}".`);
        const created = await guild.channels.create({
          name: chanName,
          type: ChannelType.GuildCategory,
        });
        await audit(ctx.client, `Created category **${created.name}** (${created.id})`);
        return `Created category "${created.name}" (${created.id}).`;
      }

      case "create_channel": {
        const chanName = String(input.name ?? "").trim();
        if (!chanName) return "Provide a name.";
        if (!input.confirm) {
          return needsConfirm(
            `Create a text channel "#${chanName}"${input.categoryId ? ` under category ${input.categoryId}` : ""}.`
          );
        }
        const created = await guild.channels.create({
          name: chanName,
          type: ChannelType.GuildText,
          ...(input.categoryId ? { parent: String(input.categoryId) } : {}),
        });
        await audit(ctx.client, `Created channel **#${created.name}** (${created.id})`);
        return `Created channel #${created.name} (${created.id}).`;
      }

      case "rename_channel": {
        const ch: any = await guild.channels.fetch(String(input.channelId));
        if (!ch) return "Channel not found.";
        const newName = String(input.name ?? "").trim();
        if (!newName) return "Provide a new name.";
        if (!input.confirm) return needsConfirm(`Rename #${ch.name} to "#${newName}".`);
        const before = ch.name;
        await ch.setName(newName);
        await audit(ctx.client, `Renamed channel **#${before}** → **#${newName}**`);
        return `Renamed #${before} to #${newName}.`;
      }

      case "create_role": {
        const roleName = String(input.name ?? "").trim();
        if (!roleName) return "Provide a name.";
        if (!input.confirm) return needsConfirm(`Create a role named "${roleName}" with no special permissions.`);
        const created = await guild.roles.create({
          name: roleName,
          hoist: input.hoist === true,
          ...(input.colour ? { color: input.colour as any } : {}),
          permissions: [], // never create a role that carries privileges
        });
        await audit(ctx.client, `Created role **${created.name}** (${created.id})`);
        return `Created role "${created.name}" (${created.id}) with no permissions.`;
      }

      case "assign_role": {
        const roleId = String(input.roleId);
        const userId = String(input.userId);
        const action = input.action === "remove" ? "remove" : "add";

        if (PROTECTED_ROLE_IDS.has(roleId)) {
          return "Refused: that is a subscription tier role. Tier roles are set by the billing webhooks and cannot be changed here.";
        }

        const role = await guild.roles.fetch(roleId);
        if (!role) return "Role not found.";
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return "Member not found.";

        // The bot cannot manage a role at or above its own highest role.
        const me = await guild.members.fetchMe();
        if (role.position >= me.roles.highest.position) {
          return `Refused: "${role.name}" sits at or above my highest role, so Discord won't let me manage it.`;
        }

        if (!input.confirm) {
          return needsConfirm(
            `${action === "add" ? "Add" : "Remove"} role "${role.name}" ${action === "add" ? "to" : "from"} ${member.displayName} (@${member.user.username}).`
          );
        }

        if (action === "add") await member.roles.add(role);
        else await member.roles.remove(role);

        await audit(
          ctx.client,
          `${action === "add" ? "Added" : "Removed"} role **${role.name}** ${action === "add" ? "to" : "from"} **${member.user.username}**`
        );
        return `${action === "add" ? "Added" : "Removed"} "${role.name}" ${action === "add" ? "to" : "from"} ${member.displayName}.`;
      }

      case "send_channel_message": {
        const ch: any = await guild.channels.fetch(String(input.channelId));
        if (!ch?.isTextBased()) return "Channel not found or not a text channel.";
        const content = String(input.content ?? "").slice(0, 1900);
        if (!content) return "Provide message content.";
        if (!input.confirm) {
          return needsConfirm(`Post this to #${ch.name}:\n\n---\n${content}\n---`);
        }
        await ch.send(content);
        await audit(ctx.client, `Posted a message to **#${ch.name}**`);
        return `Posted to #${ch.name}.`;
      }

      case "set_channel_permissions": {
        const ch: any = await guild.channels.fetch(String(input.channelId));
        if (!ch) return "Channel not found.";
        const role = await guild.roles.fetch(String(input.roleId));
        if (!role) return "Role not found.";

        const overwrite: Record<string, boolean> = {};
        if (typeof input.canView === "boolean") {
          overwrite.ViewChannel = input.canView;
          overwrite.ReadMessageHistory = input.canView;
        }
        if (typeof input.canSend === "boolean") overwrite.SendMessages = input.canSend;
        if (Object.keys(overwrite).length === 0) return "Specify canView and/or canSend.";

        if (!input.confirm) {
          const desc = Object.entries(overwrite)
            .map(([k, v]) => `${v ? "allow" : "deny"} ${k}`)
            .join(", ");
          return needsConfirm(`In #${ch.name}, set "${role.name}" to: ${desc}.`);
        }

        await ch.permissionOverwrites.edit(role, overwrite);

        await audit(ctx.client, `Updated permissions for **${role.name}** in **#${ch.name}**`);
        return `Updated ${role.name}'s access to #${ch.name}.`;
      }

      case "pin_message": {
        const ch: any = await guild.channels.fetch(String(input.channelId));
        if (!ch?.isTextBased()) return "Channel not found or not a text channel.";
        const msg = await ch.messages.fetch(String(input.messageId)).catch(() => null);
        if (!msg) return "Message not found.";
        if (!input.confirm) {
          return needsConfirm(`Pin this message in #${ch.name}:\n\n"${String(msg.content).slice(0, 200)}"`);
        }
        await msg.pin();
        await audit(ctx.client, `Pinned a message in **#${ch.name}**`);
        return `Pinned the message in #${ch.name}.`;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (e: any) {
    // Usually a missing permission or a role-hierarchy problem.
    return `Failed: ${e?.message ?? "unknown error"}`;
  }
}
