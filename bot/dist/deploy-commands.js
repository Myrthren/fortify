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
const trends = __importStar(require("./commands/trends"));
const competitors = __importStar(require("./commands/competitors"));
const matchmake = __importStar(require("./commands/matchmake"));
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
const rest = new discord_js_1.REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
(async () => {
    try {
        console.log("Deploying slash commands…");
        await rest.put(discord_js_1.Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID), { body: commands });
        console.log(`✅ Deployed ${commands.length} commands.`);
    }
    catch (err) {
        console.error(err);
    }
})();
