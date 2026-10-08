import test from "node:test";
import assert from "node:assert/strict";
import { WORKFLOW_STARTERS, activationIssue, validCron, cronTimeAt } from "../lib/workflow-starters.ts";

test("starters are connected drafts with no external action", () => {
  for (const starter of WORKFLOW_STARTERS) {
    assert.equal(activationIssue({ nodes: starter.nodes, connections: starter.connections }), null);
    assert.equal(starter.nodes.some((node) => node.type.startsWith("action_")), false);
  }
});

test("activation rejects incomplete or unsafe triggers", () => {
  assert.match(activationIssue([]), /at least one/);
  assert.match(activationIssue([{ id: "ai", type: "ai_generate", label: "AI", config: { prompt: "hello" } }]), /trigger/);
  assert.match(activationIssue([{ id: "schedule", type: "trigger_schedule", label: "Schedule", config: {} }]), /schedule/);
  assert.match(activationIssue([{ id: "hook", type: "trigger_webhook", label: "Webhook", config: {} }]), /secret/);
  assert.equal(validCron("*/0 * * * *"), false);
  assert.equal(validCron("0 25 * * *"), false);
  assert.equal(validCron("0 8 * * 1"), true);
});

test("activation rejects disconnected or unconfigured delivery actions", () => {
  const trigger = { id: "trigger", type: "trigger_schedule", label: "Schedule", config: { cron: "0 9 * * 1" } };
  const email = { id: "email", type: "action_email", label: "Email", config: {} };
  assert.match(activationIssue({ nodes: [trigger, email], connections: [] }), /Connect/);
  assert.match(activationIssue({ nodes: [trigger, email], connections: [{ fromId: "trigger", fromPort: "out", toId: "email" }] }), /recipient/);
  assert.match(activationIssue({ nodes: [trigger, email], connections: [
    { fromId: "trigger", fromPort: "out", toId: "email" },
    { fromId: "email", fromPort: "out", toId: "trigger" },
  ] }), /recipient/);
  const idea = { id: "idea", type: "ai_generate", label: "Idea", config: { prompt: "Hello" } };
  assert.match(activationIssue({ nodes: [trigger, idea], connections: [
    { fromId: "trigger", fromPort: "out", toId: "idea" },
    { fromId: "idea", fromPort: "out", toId: "trigger" },
  ] }), /loop/);
});

test("scheduled workflows use the configured local time across seasons", () => {
  assert.equal(cronTimeAt(new Date("2026-01-01T08:00:00Z"), "Europe/London")?.hour, 8);
  assert.equal(cronTimeAt(new Date("2026-07-01T07:00:00Z"), "Europe/London")?.hour, 8);
  assert.equal(cronTimeAt(new Date("2026-07-01T07:00:00Z"), "Not/AZone"), null);
});
