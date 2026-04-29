"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const discord_js_1 = require("discord.js");
const hook = __importStar(require("./commands/hook"));
const upgrade = __importStar(require("./commands/upgrade"));
const profile = __importStar(require("./commands/profile"));
const voice = __importStar(require("./commands/voice"));
const outreach = __importStar(require("./commands/outreach"));
const audit = __importStar(require("./commands/audit"));
const chat_1 = require("./lib/chat");
const commands = new discord_js_1.Collection();
for (const cmd of [hook, upgrade, profile, voice, outreach, audit]) {
    commands.set(cmd.data.name, cmd);
}
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent, // privileged — must be enabled in Discord Dev Portal
    ],
});
client.once(discord_js_1.Events.ClientReady, (c) => {
    console.log(`✅ Fortify bot online as ${c.user.tag}`);
});
client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand())
        return;
    const command = commands.get(interaction.commandName);
    if (!command)
        return;
    try {
        await command.execute(interaction);
    }
    catch (err) {
        console.error(err);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: "Command failed.", ephemeral: true });
        }
        else {
            await interaction.reply({ content: "Command failed.", ephemeral: true });
        }
    }
});
client.on(discord_js_1.Events.MessageCreate, async (message) => {
    if (message.author.bot)
        return;
    if (!client.user)
        return;
    const mentioned = message.mentions.users.has(client.user.id) ||
        message.content.includes(`<@${client.user.id}>`);
    console.log(`[msg] ${message.author.username} in ${message.channelId} | mentioned=${mentioned} | content="${message.content.slice(0, 60)}"`);
    if (!mentioned)
        return;
    await (0, chat_1.handleMention)(message).catch((err) => {
        console.error("handleMention error:", err);
        message.reply("Something went wrong. Try again.").catch(() => { });
    });
});
client.login(process.env.DISCORD_BOT_TOKEN);
