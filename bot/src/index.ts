import "dotenv/config";
import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Interaction,
  Message,
} from "discord.js";
import * as hook from "./commands/hook";
import * as upgrade from "./commands/upgrade";
import * as profile from "./commands/profile";
import * as voice from "./commands/voice";
import * as outreach from "./commands/outreach";
import * as audit from "./commands/audit";
import { handleMention } from "./lib/chat";

type Command = { data: { name: string }; execute: (i: any) => Promise<void> };

const commands = new Collection<string, Command>();
for (const cmd of [hook, upgrade, profile, voice, outreach, audit] as Command[]) {
  commands.set(cmd.data.name, cmd);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privileged — must be enabled in Discord Dev Portal
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Fortify bot online as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: "Command failed.", ephemeral: true });
    } else {
      await interaction.reply({ content: "Command failed.", ephemeral: true });
    }
  }
});

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  if (!client.user) return;

  const mentioned =
    message.mentions.users.has(client.user.id) ||
    message.content.includes(`<@${client.user.id}>`);

  console.log(
    `[msg] ${message.author.username} in ${message.channelId} | mentioned=${mentioned} | content="${message.content.slice(0, 60)}"`
  );

  if (!mentioned) return;

  await handleMention(message).catch((err) => {
    console.error("handleMention error:", err);
    message.reply("Something went wrong. Try again.").catch(() => {});
  });
});

client.login(process.env.DISCORD_BOT_TOKEN);
