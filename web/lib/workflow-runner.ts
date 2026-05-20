/**
 * Fortify Workflow Execution Engine
 * -----------------------------------
 * Walks the saved node graph, executes each node type,
 * interpolates {{variables}}, and records per-node logs
 * in a WorkflowRun row.
 *
 * Capacity cost: 100 units per run.
 */

import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { getCapacityInfo } from "@/lib/workflow-capacity";
import { braveSearch } from "@/lib/brave";
import type { Tier } from "@prisma/client";

// ── Constants ──────────────────────────────────────────────────────────────────
const CAPACITY_PER_RUN = 100;
const MAX_LOOP_ITERATIONS = 50;
const MAX_DELAY_SECONDS = 30; // cap server-side delays

// ── Types ─────────────────────────────────────────────────────────────────────
type WFNode = {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  config: Record<string, string>;
};

type Conn = {
  id: string;
  fromId: string;
  fromPort: string;
  toId: string;
};

type LogEntry = {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: "ok" | "error" | "skipped";
  output?: string;
  error?: string;
  ms: number;
  timestamp: string;
};

type RunContext = {
  vars: Record<string, string>;
  userId: string;
  workflowId: string;
  runId: string;
  logs: LogEntry[];
  // adjacency: port output → next node id
  adj: Map<string, string>; // key: `${fromId}:${fromPort}` → toId
  nodes: Map<string, WFNode>;
};

// Trigger data passed in when a trigger fires
export type TriggerPayload = {
  memberName?: string;
  memberEmail?: string;
  memberTier?: string;
  memberCredits?: string;
  watchName?: string;
  leadScore?: string;
  webhookBody?: Record<string, unknown>;
};

// ── Variable interpolation ────────────────────────────────────────────────────
function interp(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? "");
}

function interpObj(obj: Record<string, string>, vars: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = interp(v, vars);
  return out;
}

// ── Condition evaluator ───────────────────────────────────────────────────────
function evalCondition(left: string, op: string, right: string): boolean {
  const l = left.trim();
  const r = right.trim();
  const lNum = parseFloat(l);
  const rNum = parseFloat(r);
  switch (op) {
    case "==":          return l === r;
    case "!=":          return l !== r;
    case ">":           return !isNaN(lNum) && !isNaN(rNum) ? lNum > rNum : l > r;
    case "<":           return !isNaN(lNum) && !isNaN(rNum) ? lNum < rNum : l < r;
    case ">=":          return !isNaN(lNum) && !isNaN(rNum) ? lNum >= rNum : l >= r;
    case "<=":          return !isNaN(lNum) && !isNaN(rNum) ? lNum <= rNum : l <= r;
    case "contains":    return l.includes(r);
    case "not_contains": return !l.includes(r);
    default:            return false;
  }
}

// ── Filter expression evaluator ───────────────────────────────────────────────
// Supports: value op value, AND, OR (simple left-to-right)
function evalFilter(expr: string, vars: Record<string, string>): boolean {
  // Interpolate first
  const resolved = interp(expr, vars);
  // Split on AND/OR (very simple parser)
  const andParts = resolved.split(/\bAND\b/i);
  return andParts.every(andPart => {
    const orParts = andPart.split(/\bOR\b/i);
    return orParts.some(orPart => {
      const m = orPart.match(/^\s*(.+?)\s*(==|!=|>=|<=|>|<|contains|not_contains)\s*(.+?)\s*$/i);
      if (!m) return orPart.trim().length > 0 && orPart.trim() !== "false" && orPart.trim() !== "0";
      return evalCondition(m[1].replace(/['"]/g, ""), m[2], m[3].replace(/['"]/g, ""));
    });
  });
}

// ── AI helper ─────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function callClaude(prompt: string, model: string, maxTokens: number): Promise<string> {
  const modelId = model === "sonnet" ? "claude-sonnet-4-5" : "claude-haiku-4-5";
  const msg = await anthropic.messages.create({
    model: modelId,
    max_tokens: Math.min(maxTokens, 2000),
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("").trim();
}

// ── Discord channel post ──────────────────────────────────────────────────────
async function discordPostToChannel(
  channelId: string,
  message: string,
  embedTitle?: string,
  embedColor?: string,
  username?: string,
): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN not set");

  const body: Record<string, unknown> = {};
  if (message) body.content = message.slice(0, 2000);

  if (embedTitle) {
    body.embeds = [{
      title: embedTitle,
      description: message,
      color: embedColor
        ? parseInt(embedColor.replace("#", ""), 16)
        : 0x5865f2,
    }];
    // Don't duplicate as content when using embed
    if (embedTitle) delete body.content;
  }

  if (username) body.username = username;

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Discord API error ${res.status}: ${err}`);
  }
}

// ── Slack post ────────────────────────────────────────────────────────────────
async function slackPost(webhookUrl: string, message: string, username?: string, emoji?: string): Promise<void> {
  const body: Record<string, unknown> = { text: message };
  if (username) body.username = username;
  if (emoji) body.icon_emoji = emoji;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Slack webhook error ${res.status}`);
}

// ── Email (Resend) ────────────────────────────────────────────────────────────
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

async function sendEmail(to: string, subject: string, body: string, fromName: string): Promise<void> {
  const { error } = await getResend().emails.send({
    from: `${fromName || "Fortify"} <noreply@fortify-io.com>`,
    to,
    subject,
    html: body.replace(/\n/g, "<br>"),
    text: body,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ── HTTP Request ──────────────────────────────────────────────────────────────
async function httpRequest(
  url: string,
  method: string,
  headersJson: string,
  bodyJson: string,
): Promise<string> {
  let headers: Record<string, string> = {};
  let bodyStr: string | undefined;

  try { headers = headersJson ? JSON.parse(headersJson) : {}; } catch { /* ignore */ }
  try { bodyStr = bodyJson ? JSON.stringify(JSON.parse(bodyJson)) : undefined; } catch {
    bodyStr = bodyJson || undefined;
  }

  const res = await fetch(url, {
    method: method || "GET",
    headers: { "Content-Type": "application/json", ...headers },
    body: bodyStr,
  });
  return await res.text();
}

// ── Notion page creation ──────────────────────────────────────────────────────
async function notionCreatePage(
  databaseId: string,
  title: string,
  content: string,
  userNotionToken?: string | null,
): Promise<void> {
  const token = userNotionToken || process.env.NOTION_INTERNAL_TOKEN;
  if (!token) throw new Error("No Notion token available. Connect your Notion account in Settings.");

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      parent: { database_id: databaseId.replace(/-/g, "") },
      properties: {
        title: { title: [{ text: { content: title || "Untitled" } }] },
      },
      children: content
        ? [{
            object: "block",
            type: "paragraph",
            paragraph: { rich_text: [{ type: "text", text: { content: content.slice(0, 2000) } }] },
          }]
        : [],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API error ${res.status}: ${err}`);
  }
}

// ── Execute a single node ─────────────────────────────────────────────────────
// Returns the port that should fire after execution ("out"|"yes"|"no"|"a"|"b"|"c"|"d"|null)
async function execNode(
  node: WFNode,
  ctx: RunContext,
  // Optional notion token from user's connected account
  notionToken?: string | null,
): Promise<{ firedPort: string | null; output?: string; error?: string }> {
  const c = interpObj(node.config, ctx.vars);

  switch (node.type) {

    // ── Triggers (just flow through) ─────────────────────────────────────────
    case "trigger_schedule":
    case "trigger_webhook":
    case "trigger_new_member":
    case "trigger_competitor":
    case "trigger_lead":
      return { firedPort: "out" };

    // ── AI Generate ──────────────────────────────────────────────────────────
    case "ai_generate": {
      const text = await callClaude(
        c.prompt || "Hello",
        c.model || "haiku",
        parseInt(c.maxTokens || "500", 10),
      );
      const outVar = c.outputVar || "generated_text";
      ctx.vars[outVar] = text;
      ctx.vars.previous_output = text;
      return { firedPort: "out", output: text.slice(0, 200) };
    }

    // ── AI Summarise ─────────────────────────────────────────────────────────
    case "ai_summarise": {
      const input = c.input || ctx.vars.previous_output || "";
      const maxLen = c.maxLength || "150 words";
      const prompt = `Summarise the following text in ${maxLen}:\n\n${input}`;
      const text = await callClaude(prompt, "haiku", 600);
      const outVar = c.outputVar || "summary";
      ctx.vars[outVar] = text;
      ctx.vars.previous_output = text;
      return { firedPort: "out", output: text.slice(0, 200) };
    }

    // ── AI Analyse ───────────────────────────────────────────────────────────
    case "ai_analyse": {
      const input = c.input || ctx.vars.previous_output || "";
      const criteria = c.criteria || "tone, clarity, key themes";
      const prompt = `Analyse the following text for ${criteria}:\n\n${input}`;
      const text = await callClaude(prompt, "haiku", 800);
      const outVar = c.outputVar || "analysis";
      ctx.vars[outVar] = text;
      ctx.vars.previous_output = text;
      return { firedPort: "out", output: text.slice(0, 200) };
    }

    // ── AI Classify ──────────────────────────────────────────────────────────
    case "ai_classify": {
      const input = c.input || ctx.vars.previous_output || "";
      const categories = c.categories || "positive, negative, neutral";
      const prompt = `Classify the following text into exactly one of these categories: ${categories}.\nRespond with only the category name.\n\nText: ${input}`;
      const text = await callClaude(prompt, "haiku", 50);
      const outVar = c.outputVar || "category";
      // Clean to just the category
      const cleanedCategory = text.split("\n")[0].trim();
      ctx.vars[outVar] = cleanedCategory;
      ctx.vars.previous_output = cleanedCategory;
      return { firedPort: "out", output: cleanedCategory };
    }

    // ── Discord Post ─────────────────────────────────────────────────────────
    case "action_discord": {
      const channelId = c.channel;
      if (!channelId) throw new Error("No channel ID configured");
      const message = c.message || ctx.vars.previous_output || "(empty message)";
      await discordPostToChannel(channelId, message, c.embedTitle, c.embedColor, c.username);
      return { firedPort: "out", output: `Sent to #${channelId}` };
    }

    // ── Send Email ───────────────────────────────────────────────────────────
    case "action_email": {
      const to = c.to;
      if (!to) throw new Error("No 'To' address configured");
      const subject = c.subject || "Message from Fortify";
      const body = c.body || ctx.vars.previous_output || "";
      await sendEmail(to, subject, body, c.fromName || "Fortify");
      return { firedPort: "out", output: `Email sent to ${to}` };
    }

    // ── Slack Post ───────────────────────────────────────────────────────────
    case "action_slack": {
      const webhookUrl = c.webhookUrl;
      if (!webhookUrl) throw new Error("No Slack webhook URL configured");
      const message = c.message || ctx.vars.previous_output || "(empty)";
      await slackPost(webhookUrl, message, c.username, c.emoji);
      return { firedPort: "out", output: `Sent to Slack` };
    }

    // ── Notion Create ────────────────────────────────────────────────────────
    case "action_notion": {
      const dbId = c.database;
      if (!dbId) throw new Error("No Notion database ID configured");
      await notionCreatePage(
        dbId,
        interp(c.title || "Untitled", ctx.vars),
        c.content || ctx.vars.previous_output || "",
        notionToken,
      );
      return { firedPort: "out", output: `Notion page created in DB ${dbId.slice(0, 8)}…` };
    }

    // ── Webhook Out ──────────────────────────────────────────────────────────
    case "action_webhook_out": {
      const url = c.url;
      if (!url) throw new Error("No webhook URL configured");
      const resp = await httpRequest(url, c.method || "POST", c.headers || "", c.body || "");
      ctx.vars.previous_output = resp.slice(0, 1000);
      return { firedPort: "out", output: `HTTP ${c.method || "POST"} → ${url.slice(0, 60)} (${resp.length} bytes)` };
    }

    // ── HTTP Request ─────────────────────────────────────────────────────────
    case "action_http_request": {
      const url = c.url;
      if (!url) throw new Error("No URL configured");
      const resp = await httpRequest(url, c.method || "GET", c.headers || "", c.body || "");
      const outVar = c.outputVar || "http_response";
      ctx.vars[outVar] = resp.slice(0, 5000);
      ctx.vars.previous_output = resp.slice(0, 1000);
      return { firedPort: "out", output: `${c.method || "GET"} ${url.slice(0, 60)} → ${resp.length} bytes` };
    }

    // ── Twitter / X ──────────────────────────────────────────────────────────
    case "action_twitter": {
      const twitterKey    = process.env.TWITTER_API_KEY;
      const twitterSecret = process.env.TWITTER_API_SECRET;
      const accessToken   = process.env.TWITTER_ACCESS_TOKEN;
      const accessSecret  = process.env.TWITTER_ACCESS_TOKEN_SECRET;

      if (!twitterKey || !twitterSecret || !accessToken || !accessSecret) {
        throw new Error(
          "Twitter not connected. Add TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, " +
          "and TWITTER_ACCESS_TOKEN_SECRET to your Netlify environment variables to enable Twitter posting."
        );
      }

      const tweetText = (c.message || ctx.vars.previous_output || "").slice(0, 280);
      if (!tweetText) throw new Error("Twitter: no message to post");

      // OAuth 1.0a signature for Twitter API v2 POST /2/tweets
      const oauthParams: Record<string, string> = {
        oauth_consumer_key:     twitterKey,
        oauth_nonce:            Math.random().toString(36).slice(2) + Date.now().toString(36),
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
        oauth_token:            accessToken,
        oauth_version:          "1.0",
      };

      // Build signature base string
      const url = "https://api.twitter.com/2/tweets";
      const paramStr = Object.entries(oauthParams)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
      const signatureBase = [
        "POST",
        encodeURIComponent(url),
        encodeURIComponent(paramStr),
      ].join("&");

      // Sign with HMAC-SHA1
      const { createHmac } = await import("crypto");
      const signingKey = `${encodeURIComponent(twitterSecret)}&${encodeURIComponent(accessSecret)}`;
      const signature = createHmac("sha1", signingKey)
        .update(signatureBase)
        .digest("base64");
      oauthParams.oauth_signature = signature;

      const authHeader =
        "OAuth " +
        Object.entries(oauthParams)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
          .join(", ");

      const tweetRes = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: tweetText }),
      });

      if (!tweetRes.ok) {
        const errBody = await tweetRes.text();
        throw new Error(`Twitter API error ${tweetRes.status}: ${errBody.slice(0, 200)}`);
      }

      const tweetData = await tweetRes.json() as { data?: { id?: string } };
      const tweetId   = tweetData?.data?.id ?? "unknown";
      const tweetUrl  = tweetId !== "unknown"
        ? `https://twitter.com/i/web/status/${tweetId}`
        : "https://twitter.com";

      ctx.vars.previous_output = tweetUrl;
      ctx.vars.tweet_url       = tweetUrl;
      ctx.vars.tweet_id        = tweetId;
      return { firedPort: "out", output: `Tweet posted: ${tweetUrl}` };
    }

    // ── Shopify ───────────────────────────────────────────────────────────────
    case "action_shopify": {
      const shopifyConn = await db.shopifyConnection.findUnique({
        where: { userId: ctx.userId },
        select: { shop: true, accessToken: true },
      });
      if (!shopifyConn) {
        throw new Error(
          "Shopify not connected. Go to Dashboard → Shopify and connect your store first."
        );
      }

      const { shop, accessToken: shopToken } = shopifyConn;
      const apiVersion = "2024-10";
      const action = c.action || "create_product";

      switch (action) {
        case "create_product": {
          const title  = c.title  || ctx.vars.previous_output || "New Product";
          const body   = c.body   || "";
          const price  = c.price  || "0.00";
          const vendor = c.vendor || "";

          const res = await fetch(
            `https://${shop}/admin/api/${apiVersion}/products.json`,
            {
              method: "POST",
              headers: {
                "X-Shopify-Access-Token": shopToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                product: {
                  title,
                  body_html: body,
                  vendor,
                  variants: [{ price }],
                },
              }),
            }
          );
          if (!res.ok) {
            const err = await res.text();
            throw new Error(`Shopify create_product error ${res.status}: ${err.slice(0, 200)}`);
          }
          const data = await res.json() as { product?: { id?: number; title?: string } };
          const productId  = data?.product?.id ?? "unknown";
          const productUrl = `https://${shop}/admin/products/${productId}`;
          ctx.vars.previous_output  = productUrl;
          ctx.vars.shopify_product_id  = String(productId);
          ctx.vars.shopify_product_url = productUrl;
          return { firedPort: "out", output: `Product created: "${title}" (ID ${productId})` };
        }

        case "create_draft_order": {
          const variantId = c.variantId || "";
          const qty       = parseInt(c.quantity || "1", 10);
          const email     = c.email || ctx.vars["member.email"] || "";

          if (!variantId) throw new Error("Shopify create_draft_order: no variantId configured");

          const res = await fetch(
            `https://${shop}/admin/api/${apiVersion}/draft_orders.json`,
            {
              method: "POST",
              headers: {
                "X-Shopify-Access-Token": shopToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                draft_order: {
                  line_items: [{ variant_id: variantId, quantity: qty }],
                  ...(email ? { email } : {}),
                },
              }),
            }
          );
          if (!res.ok) {
            const err = await res.text();
            throw new Error(`Shopify create_draft_order error ${res.status}: ${err.slice(0, 200)}`);
          }
          const data = await res.json() as { draft_order?: { id?: number; invoice_url?: string } };
          const orderId   = data?.draft_order?.id ?? "unknown";
          const invoiceUrl = data?.draft_order?.invoice_url ?? "";
          ctx.vars.previous_output      = invoiceUrl || String(orderId);
          ctx.vars.shopify_order_id     = String(orderId);
          ctx.vars.shopify_invoice_url  = invoiceUrl;
          return { firedPort: "out", output: `Draft order created: ID ${orderId}` };
        }

        case "get_orders": {
          const limit  = Math.min(parseInt(c.limit || "10", 10), 50);
          const status = c.status || "any";
          const res = await fetch(
            `https://${shop}/admin/api/${apiVersion}/orders.json?limit=${limit}&status=${status}`,
            {
              headers: { "X-Shopify-Access-Token": shopToken },
            }
          );
          if (!res.ok) {
            const err = await res.text();
            throw new Error(`Shopify get_orders error ${res.status}: ${err.slice(0, 200)}`);
          }
          const data = await res.json() as { orders?: unknown[] };
          const orders    = data?.orders ?? [];
          const ordersJson = JSON.stringify(orders);
          const outVar    = c.outputVar || "shopify_orders";
          ctx.vars[outVar]         = ordersJson;
          ctx.vars.previous_output = ordersJson.slice(0, 2000);
          ctx.vars.shopify_order_count = String(orders.length);
          return { firedPort: "out", output: `Fetched ${orders.length} order(s) from Shopify` };
        }

        case "update_inventory": {
          const inventoryItemId = c.inventoryItemId || "";
          const locationId      = c.locationId || "";
          const available       = parseInt(c.available || "0", 10);

          if (!inventoryItemId || !locationId) {
            throw new Error("Shopify update_inventory: inventoryItemId and locationId are required");
          }

          const res = await fetch(
            `https://${shop}/admin/api/${apiVersion}/inventory_levels/set.json`,
            {
              method: "POST",
              headers: {
                "X-Shopify-Access-Token": shopToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ inventory_item_id: inventoryItemId, location_id: locationId, available }),
            }
          );
          if (!res.ok) {
            const err = await res.text();
            throw new Error(`Shopify update_inventory error ${res.status}: ${err.slice(0, 200)}`);
          }
          ctx.vars.previous_output = `Inventory updated: ${available} units`;
          return { firedPort: "out", output: `Inventory set to ${available} for item ${inventoryItemId}` };
        }

        default:
          throw new Error(`Shopify: unknown action "${action}". Supported: create_product, create_draft_order, get_orders, update_inventory`);
      }
    }

    // ── Condition ────────────────────────────────────────────────────────────
    case "logic_condition": {
      const left  = interp(c.leftSide || "", ctx.vars);
      const right = interp(c.rightSide || "", ctx.vars);
      const op    = c.operator || "==";
      const result = evalCondition(left, op, right);
      return { firedPort: result ? "yes" : "no", output: `${left} ${op} ${right} → ${result}` };
    }

    // ── Delay ────────────────────────────────────────────────────────────────
    case "logic_delay": {
      const dur  = parseInt(c.duration || "1", 10);
      const unit = c.unit || "minutes";
      let seconds = dur;
      if (unit === "minutes") seconds = dur * 60;
      else if (unit === "hours")   seconds = dur * 3600;
      else if (unit === "days")    seconds = dur * 86400;
      const capped = Math.min(seconds, MAX_DELAY_SECONDS);
      if (capped > 0) await new Promise(r => setTimeout(r, capped * 1000));
      return { firedPort: "out", output: `Waited ${capped}s (requested ${seconds}s)` };
    }

    // ── Filter ───────────────────────────────────────────────────────────────
    case "logic_filter": {
      const expr = c.expression || "true";
      const pass = evalFilter(expr, ctx.vars);
      // null port = stop execution of this branch
      return { firedPort: pass ? "out" : null, output: `Filter: ${pass ? "PASSED" : "STOPPED"} — ${expr.slice(0, 60)}` };
    }

    // ── Switch ───────────────────────────────────────────────────────────────
    case "logic_switch": {
      const value = interp(c.variable || "", ctx.vars);
      let port: string | null = null;
      if (c.caseA && value === c.caseA) port = "a";
      else if (c.caseB && value === c.caseB) port = "b";
      else if (c.caseC && value === c.caseC) port = "c";
      else port = "d"; // fallback
      return { firedPort: port, output: `Switched on "${value}" → port ${port}` };
    }

    // ── Transform ────────────────────────────────────────────────────────────
    case "logic_transform": {
      const result = interp(c.template || c.input || "", ctx.vars);
      const outVar = c.outputVar || "transformed_output";
      ctx.vars[outVar] = result;
      ctx.vars.previous_output = result;
      return { firedPort: "out", output: result.slice(0, 200) };
    }

    // ── Loop / Iterator ───────────────────────────────────────────────────────
    // NOTE: Loop runs sub-graph for each item by recursively executing the
    // next connected node(s) multiple times. The caller handles this via
    // loop_items returned.
    case "logic_loop": {
      const raw = interp(c.items || "[]", ctx.vars);
      let items: string[] = [];
      try {
        const parsed = JSON.parse(raw);
        items = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
      } catch {
        items = raw.split(",").map(s => s.trim()).filter(Boolean);
      }
      const maxIter = Math.min(parseInt(c.maxIterations || "50", 10), MAX_LOOP_ITERATIONS);
      items = items.slice(0, maxIter);

      const outVar = c.outputVar || "loop_item";
      // Store items in context for the loop execution in the main runner
      ctx.vars.__loop_items__ = JSON.stringify(items);
      ctx.vars.__loop_item_var__ = outVar;
      return { firedPort: "out", output: `Loop: ${items.length} items` };
    }

    // ── Error / Retry ─────────────────────────────────────────────────────────
    case "logic_retry": {
      // Just stores retry config in vars — the main runner checks these
      ctx.vars.__retry_max__   = c.maxRetries || "3";
      ctx.vars.__retry_delay__ = c.delaySeconds || "5";
      ctx.vars.__retry_error_var__ = c.errorOutputVar || "error_message";
      return { firedPort: "out", output: `Retry wrapper: ${c.maxRetries || 3} attempts` };
    }

    // ── Lead Search ──────────────────────────────────────────────────────────
    case "action_lead_search": {
      const icp = c.icp?.trim();
      if (!icp || icp.length < 5) throw new Error("Lead Search: ICP not configured (minimum 5 characters)");

      // Credit check and deduction
      const freshUser = await db.user.findUnique({ where: { id: ctx.userId }, select: { credits: true } });
      if (!freshUser) throw new Error("Lead Search: user not found");
      if (freshUser.credits < 50) throw new Error(`Lead Search: insufficient credits (need 50, have ${freshUser.credits})`);

      await db.user.update({ where: { id: ctx.userId }, data: { credits: { decrement: 50 } } });
      await db.creditTransaction.create({
        data: { userId: ctx.userId, amount: -50, source: "spend_leads" },
      });

      const location = c.location?.trim() ?? "";
      const signal   = c.signal?.trim()   ?? "";
      const maxCount = Math.min(parseInt(c.count || "8", 10), 15);
      const outVar   = c.outputVar?.trim() || "leads";

      const query = [icp, location, signal, "company"].filter(Boolean).join(" ");
      const results = await braveSearch({ query, count: 15 });

      if (!results.length) {
        ctx.vars[outVar]         = "[]";
        ctx.vars.previous_output = "[]";
        ctx.vars.lead_count      = "0";
        return { firedPort: "out", output: `Lead Search: no results for "${icp.slice(0, 40)}"` };
      }

      const resultList = results
        .map((r, i) => `${i + 1}. Title: "${r.title}" | URL: ${r.url} | Snippet: ${r.description}`)
        .join("\n");

      const prompt = `You are a B2B sales prospecting expert. The user is looking for leads matching this ideal customer profile (ICP): "${icp}"${location ? `, located in: ${location}` : ""}${signal ? `, with buying signal: ${signal}` : ""}.

Below are web search results. For each result that looks like a real company or person matching the ICP, output a scored lead entry. Skip irrelevant results (news articles, job boards, directories, etc.).

Search results:
${resultList}

Return ONLY a JSON array of up to ${maxCount} lead objects with this exact shape:
[{"company":"name","website":"url","fitScore":7,"fitReason":"one sentence","hook":"personalised opening line for cold outreach"}]`;

      const raw = await callClaude(prompt, "sonnet", 2000);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);

      let leads: unknown[] = [];
      if (jsonMatch) {
        try { leads = JSON.parse(jsonMatch[0]); } catch { /* malformed — return empty */ }
      }

      const leadsJson = JSON.stringify(leads);
      ctx.vars[outVar]         = leadsJson;
      ctx.vars.previous_output = leadsJson;
      ctx.vars.lead_count      = String(leads.length);

      await db.generation.create({
        data: { userId: ctx.userId, type: "lead-sourcing", input: query, output: leadsJson },
      });

      return { firedPort: "out", output: `Found ${leads.length} lead(s) for "${icp.slice(0, 40)}"` };
    }

    default:
      return { firedPort: "out", output: `[Unknown node type: ${node.type}]` };
  }
}

// ── Main runner ───────────────────────────────────────────────────────────────
export async function runWorkflow(
  workflowId: string,
  userId: string,
  triggerPayload: TriggerPayload = {},
): Promise<{ runId: string; status: string; message?: string }> {

  // 1. Load workflow
  const workflow = await db.workflow.findFirst({ where: { id: workflowId, userId } });
  if (!workflow) return { runId: "", status: "error", message: "Workflow not found" };

  // 2. Check capacity
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { runId: "", status: "error", message: "User not found" };

  const cap = await getCapacityInfo(userId, user.tier as Tier);
  if (!cap.isUnlimited && cap.remaining < CAPACITY_PER_RUN) {
    return { runId: "", status: "error", message: `Insufficient workflow capacity (${cap.remaining} units remaining, ${CAPACITY_PER_RUN} required). Buy a capacity pack at /dashboard/workflows.` };
  }

  // 3. Parse graph
  const raw = workflow.nodes as any;
  let nodes: WFNode[] = [];
  let connections: Conn[] = [];

  if (raw && typeof raw === "object" && Array.isArray(raw.nodes)) {
    nodes = raw.nodes;
    connections = raw.connections ?? [];
  } else if (Array.isArray(raw)) {
    nodes = raw;
  }

  if (!nodes.length) {
    return { runId: "", status: "error", message: "Workflow has no nodes" };
  }

  // 4. Create WorkflowRun record
  const run = await db.workflowRun.create({
    data: { workflowId, status: "running", usedCapacity: CAPACITY_PER_RUN },
  });

  // 5. Build adjacency map
  const adj = new Map<string, string>();
  for (const conn of connections) {
    adj.set(`${conn.fromId}:${conn.fromPort}`, conn.toId);
  }

  const nodeMap = new Map<string, WFNode>(nodes.map(n => [n.id, n]));

  // 6. Get user's Notion token (if connected)
  let notionToken: string | null = null;
  try {
    const notionConn = await db.socialConnection.findFirst({
      where: { userId, platform: "notion" },
    });
    notionToken = notionConn?.accessToken ?? null;
  } catch { /* ignore */ }

  // 7. Seed initial variables
  const vars: Record<string, string> = {
    "member.name":    triggerPayload.memberName    ?? user.name ?? "",
    "member.email":   triggerPayload.memberEmail   ?? user.email ?? "",
    "member.tier":    triggerPayload.memberTier    ?? user.tier  ?? "",
    "member.credits": triggerPayload.memberCredits ?? String(user.credits ?? 0),
    "watch.name":     triggerPayload.watchName     ?? "",
    "lead.score":     triggerPayload.leadScore     ?? "",
    date:             new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    previous_output:  "",
  };

  // Inject webhook body fields as vars
  if (triggerPayload.webhookBody) {
    for (const [k, v] of Object.entries(triggerPayload.webhookBody)) {
      if (typeof v === "string" || typeof v === "number") {
        vars[`webhook.${k}`] = String(v);
      }
    }
  }

  const logs: LogEntry[] = [];
  const ctx: RunContext = { vars, userId, workflowId, runId: run.id, logs, adj, nodes: nodeMap };

  // 8. Find start node(s) — nodes with no incoming connections
  const hasIncoming = new Set(connections.map(c => c.toId));
  const startNodes = nodes.filter(n => !hasIncoming.has(n.id));

  if (!startNodes.length) {
    // Fallback: use first trigger node found, or first node
    const first = nodes.find(n => n.type.startsWith("trigger_")) ?? nodes[0];
    if (first) startNodes.push(first);
  }

  // 9. Execute graph via BFS queue
  const queue: string[] = startNodes.map(n => n.id);
  const visited = new Set<string>();
  let failed = false;

  async function execChain(nodeId: string, retryCount = 0): Promise<void> {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = ctx.nodes.get(nodeId);
    if (!node) return;

    const t0 = Date.now();
    let entry: LogEntry;

    try {
      const { firedPort, output } = await execNode(node, ctx, notionToken);
      const ms = Date.now() - t0;
      entry = {
        nodeId: node.id,
        nodeType: node.type,
        nodeLabel: node.label,
        status: "ok",
        output: output?.slice(0, 500),
        ms,
        timestamp: new Date().toISOString(),
      };
      logs.push(entry);

      if (firedPort === null) {
        // Filter stopped execution of this branch
        return;
      }

      // Handle loop node — run next nodes for each item
      if (node.type === "logic_loop") {
        const itemsRaw = ctx.vars.__loop_items__ ?? "[]";
        const itemVar  = ctx.vars.__loop_item_var__ ?? "loop_item";
        let items: string[] = [];
        try { items = JSON.parse(itemsRaw); } catch { items = []; }

        const nextId = adj.get(`${node.id}:out`);
        if (nextId) {
          for (const item of items) {
            ctx.vars[itemVar] = item;
            ctx.vars.loop_item = item;
            visited.delete(nextId); // allow re-execution for each iteration
            await execChain(nextId);
          }
        }
        return;
      }

      // Follow the fired port
      const nextId = adj.get(`${node.id}:${firedPort}`);
      if (nextId) {
        visited.delete(nextId); // allow downstream
        await execChain(nextId);
      }

    } catch (err: any) {
      const ms = Date.now() - t0;
      const errMsg = err?.message ?? String(err);

      // Check retry wrapper
      const maxRetries = parseInt(ctx.vars.__retry_max__ ?? "0", 10);
      const retryDelay = parseInt(ctx.vars.__retry_delay__ ?? "5", 10);

      if (maxRetries > 0 && retryCount < maxRetries) {
        entry = {
          nodeId: node.id, nodeType: node.type, nodeLabel: node.label,
          status: "error", error: `${errMsg} (retry ${retryCount + 1}/${maxRetries})`,
          ms, timestamp: new Date().toISOString(),
        };
        logs.push(entry);
        visited.delete(nodeId);
        await new Promise(r => setTimeout(r, Math.min(retryDelay, 15) * 1000));
        await execChain(nodeId, retryCount + 1);
        return;
      }

      entry = {
        nodeId: node.id, nodeType: node.type, nodeLabel: node.label,
        status: "error", error: errMsg.slice(0, 500),
        ms, timestamp: new Date().toISOString(),
      };
      logs.push(entry);

      const errVar = ctx.vars.__retry_error_var__ ?? "error_message";
      ctx.vars[errVar] = errMsg;
      ctx.vars.previous_output = `ERROR: ${errMsg}`;
      failed = true;
    }
  }

  // Execute all start nodes in parallel
  await Promise.all(queue.map(id => execChain(id)));

  // 10. Finalize the run record
  const finalStatus = failed ? "failed" : "completed";
  await db.workflowRun.update({
    where: { id: run.id },
    data: { status: finalStatus, log: logs, completedAt: new Date() },
  });

  return { runId: run.id, status: finalStatus };
}

// ── Cron expression matcher ───────────────────────────────────────────────────
// Checks if a cron expression (minute hour dom month dow) matches the current time.
// Supports: * / lists and ranges (covers 99% of user-entered crons).
export function cronMatches(expr: string, now: Date = new Date()): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minPart, hourPart, domPart, monthPart, dowPart] = parts;

  function matchField(part: string, val: number, min: number, max: number): boolean {
    if (part === "*") return true;
    for (const seg of part.split(",")) {
      if (seg.includes("/")) {
        const [rangeStr, stepStr] = seg.split("/");
        const step = parseInt(stepStr, 10);
        const [lo, hi] = rangeStr === "*" ? [min, max] : rangeStr.split("-").map(Number);
        for (let i = lo; i <= (hi ?? lo); i += step) {
          if (i === val) return true;
        }
      } else if (seg.includes("-")) {
        const [lo, hi] = seg.split("-").map(Number);
        if (val >= lo && val <= hi) return true;
      } else {
        if (parseInt(seg, 10) === val) return true;
      }
    }
    return false;
  }

  const m  = now.getUTCMinutes();
  const h  = now.getUTCHours();
  const d  = now.getUTCDate();
  const mo = now.getUTCMonth() + 1;
  const dw = now.getUTCDay();

  return (
    matchField(minPart,  m,  0, 59) &&
    matchField(hourPart, h,  0, 23) &&
    matchField(domPart,  d,  1, 31) &&
    matchField(monthPart, mo, 1, 12) &&
    matchField(dowPart,  dw, 0, 6)
  );
}
