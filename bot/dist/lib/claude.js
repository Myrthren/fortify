"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLAUDE_MODELS = void 0;
exports.claude = claude;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
let _client = null;
function claude() {
    if (!_client) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey)
            throw new Error("ANTHROPIC_API_KEY is not set");
        _client = new sdk_1.default({ apiKey });
    }
    return _client;
}
exports.CLAUDE_MODELS = {
    fast: "claude-sonnet-4-6",
    premium: "claude-opus-4-7",
};
