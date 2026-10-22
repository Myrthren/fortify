import { randomInt } from "node:crypto";
import { openrouterMessage, openrouterConfigured, validateOpenrouterRequest } from "./openrouter";
import { reserveAiCall, settleAiCall, failAiCall } from "./ai-budget";
import { canFallback } from "./ai-fallback";

export const AI_MODELS = {
  fast: process.env.OPENROUTER_CLAUDE_MODEL?.trim() || "anthropic/claude-sonnet-5.5",
  premium: process.env.OPENROUTER_CLAUDE_PREMIUM_MODEL?.trim() || "anthropic/claude-opus-5.5",
};
const FALLBACKS = ["minimax/minimax-m2.5", "moonshotai/kimi-k2.5", "qwen/qwen3.5-397b-a17b"];
type Model = { id: string; context_length: number; pricing: Record<string, string>; supported_parameters?: string[]; architecture?: { input_modalities?: string[] } };
let catalog: { at: number; models: Model[] } | undefined;
let exchange: { at: number; rate: number } | undefined;

async function modelCatalog() {
  if (catalog && Date.now() - catalog.at < 300000) return catalog.models;
  const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("AI model catalogue is unavailable");
  const body = await res.json() as { data?: Model[] };
  if (!Array.isArray(body.data) || !body.data.length) throw new Error("Invalid AI model catalogue");
  catalog = { at: Date.now(), models: body.data };
  return catalog.models;
}

/** GBP policy uses a recorded ECB reference rate, not a claimed card/bank charge. */
export async function usdToGbp() {
  if (process.env.AI_USD_TO_GBP) {
    const rate = Number(process.env.AI_USD_TO_GBP);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 10) throw new Error("Invalid AI exchange rate");
    return rate;
  }
  if (exchange && Date.now() - exchange.at < 21600000) return exchange.rate;
  const res = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("AI exchange rate is unavailable");
  const xml = await res.text();
  const value = (currency: string) => Number(new RegExp(`currency=['"]${currency}['"]\\s+rate=['"]([0-9.]+)['"]`).exec(xml)?.[1]);
  const published = /time=['"]([0-9-]+)['"]/.exec(xml)?.[1];
  const age = published ? Date.now() - Date.parse(published + "T00:00:00Z") : Infinity;
  const rate = value("GBP") / value("USD");
  if (!Number.isFinite(rate) || rate <= 0 || age < -86400000 || age > 7 * 86400000) throw new Error("AI exchange rate is invalid or stale");
  exchange = { at: Date.now(), rate };
  return rate;
}

export function fallbackPool() {
  const configured = process.env.OPENROUTER_FALLBACK_MODELS?.split(",").map(s => s.trim()).filter(Boolean) ?? FALLBACKS;
  const unique = [...new Set(configured)];
  if (!unique.length || unique.length > 10 || unique.some(id => !/^[a-z0-9_.-]+\/[a-z0-9_.:-]+$/i.test(id) || /^(anthropic|openrouter)\//i.test(id))) throw new Error("Invalid fallback model pool");
  return unique;
}

export function quoteCall(params: any, model: Model, fx: number) {
  // A deliberately conservative text/image byte bound plus framing/tool overhead.
  // Unknown delivery outcomes keep this reservation rather than granting spend again.
  let images = 0;
  const boundedMessages = params.messages?.map((message: any) => ({ ...message,
    content: Array.isArray(message.content) ? message.content.map((block: any) => {
      if (block.type !== "image") return block;
      images++;
      return { type: "image", source: "reserved-image" };
    }) : message.content,
  }));
  const input = Buffer.byteLength(JSON.stringify({ system: params.system, messages: boundedMessages, tools: params.tools }), "utf8") + 4096 + images * 32768;
  const output = Math.min((params.max_tokens ?? 1024) + (model.id.startsWith("openai/gpt-oss") ? 1024 : 0), 32768);
  const inputRate = Number(model.pricing?.prompt), outputRate = Number(model.pricing?.completion), requestRate = Number(model.pricing?.request ?? 0), imageRate = Number(model.pricing?.image ?? 0);
  if (![inputRate, outputRate, requestRate, imageRate].every(n => Number.isFinite(n) && n >= 0) || !Number.isSafeInteger(output) || output <= 0) throw new Error("Unsupported AI pricing or token limit");
  if (input + output > model.context_length) throw new Error("AI request exceeds the model context limit");
  return Math.ceil((input * inputRate + output * outputRate + requestRate + images * imageRate) * fx * 1_000_000);
}

function compatible(model: Model, params: any) {
  if (params.tools?.length && !model.supported_parameters?.includes("tools")) return false;
  const hasImages = (params.messages ?? []).some((m: any) => Array.isArray(m.content) && m.content.some((b: any) => b.type === "image"));
  return !hasImages || !!model.architecture?.input_modalities?.includes("image");
}

export async function routedAiMessage(userId: string, params: any, options?: { signal?: AbortSignal | null }): Promise<any> {
  if (!openrouterConfigured()) throw new Error("OPENROUTER_API_KEY is not configured");
  if (!userId) throw new Error("AI requests require a member account");
  if (options?.signal?.aborted) throw new Error("Generation cancelled");
  const deadline = AbortSignal.timeout(40000);
  options = { ...options, signal: options?.signal ? AbortSignal.any([options.signal, deadline]) : deadline };
  validateOpenrouterRequest(params, AI_MODELS.fast);
  const [models, fx] = await Promise.all([modelCatalog(), usdToGbp()]);
  const primaryId = params.model === AI_MODELS.premium || /opus|premium/.test(params.model ?? "") ? AI_MODELS.premium : AI_MODELS.fast;
  if (!primaryId.startsWith("anthropic/claude-")) throw new Error("The primary AI model must be Claude");
  const primary = models.find(m => m.id === primaryId && compatible(m, params));
  const invoke = async (model: Model, primaryCall: boolean) => {
    const quote = quoteCall(params, model, fx);
    const reservation = await reserveAiCall(userId, model.id, quote, fx, primaryCall);
    if (!reservation) return null;
    let costGbp = reservation.reservedMicros / 1_000_000;
    try {
      if (options?.signal?.aborted) { await failAiCall(reservation, { status: 400 }); throw new Error("Generation cancelled"); }
      const result = await openrouterMessage(params, { ...options, model: model.id, onUsage: async raw => { costGbp = await settleAiCall(reservation, raw); } });
      return { ...result, fortify: { model: result.model, routedModel: model.id, fallback: !primaryCall, costGbp } };
    } catch (error) { await failAiCall(reservation, error); throw error; }
  };
  const pool = fallbackPool();
  const continuation = pool.includes(params.model) ? params.model : null;
  if (primary && !continuation) {
    try { const result = await invoke(primary, true); if (result) return result; }
    catch (error) { if (options?.signal?.aborted || !canFallback(error)) throw error; }
  }
  const candidates = (continuation ? [continuation] : pool).map(id => models.find(m => m.id === id)).filter((m): m is Model => {
    if (!m || !compatible(m, params)) return false;
    try { quoteCall(params, m, fx); return true; } catch { return false; }
  });
  // One random choice per provider call. No retry chain that multiplies charges.
  if (!candidates.length) throw new Error("No configured fallback supports this request");
  return invoke(candidates[randomInt(candidates.length)], false);
}
