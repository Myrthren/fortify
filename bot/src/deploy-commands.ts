import "dotenv/config";
import { REST, Routes } from "discord.js";
import * as hook from "./commands/hook";
import * as upgrade from "./commands/upgrade";
import * as profile from "./commands/profile";
import * as voice from "./commands/voice";
import * as outreach from "./commands/outreach";
import * as audit from "./commands/audit";
import * as trends from "./commands/trends";
import * as competitors from "./commands/competitors";
import * as matchmake from "./commands/matchmake";

const commands = [
  hook.data.toJSON(),
  upgrade.data.toJSON(),
  profile.data.toJSON(),
  voice.data.toJSON(),
  outreach.data.toJSON(),
  audit.data.toJSON(),
  trends.data.toJSON(),
  competitors.data.toJSON(),
  matchmake.data.toJSON(),
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN!);

(async () => {
  try {
    console.log("Deploying slash commands…");
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID!,
        process.env.DISCORD_GUILD_ID!
      ),
      { body: commands }
    );
    console.log(`✅ Deployed ${commands.length} commands.`);
  } catch (err) {
    console.error(err);
  }
})();
