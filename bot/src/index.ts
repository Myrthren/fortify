import "dotenv/config";
import { Client, Collection, Events, GatewayIntentBits, Interaction } from "discord.js";
import * as hook from "./commands/hook";
import * as upgrade from "./commands/upgrade";
import * as profile from "./commands/profile";

const commands = new Collection<string, typeof hook>();
commands.set(hook.data.name, hook);
commands.set(upgrade.data.name, upgrade as any);
commands.set(profile.data.name, profile as any);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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

client.login(process.env.DISCORD_BOT_TOKEN);
