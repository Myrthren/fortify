import test from "node:test";
import assert from "node:assert/strict";
import { MISSION_GOALS, missionMilestonesForStage, missionNextStep, missionProgress, parseMissionInput } from "../lib/growth-mission.ts";

const now = new Date("2026-10-28T12:00:00.000Z");
const valid = { businessId: "business-1", goal: "booked-calls", target: 10, deadline: "2026-11-27", offer: "Website design for clinics", audience: "Independent clinics" };

test("mission setup accepts a measurable goal and bounded deadline", () => {
  const result = parseMissionInput(valid, now);
  assert.equal(result.target, 10);
  assert.equal(result.deadline.toISOString(), "2026-11-27T23:59:59.999Z");
  assert.equal(parseMissionInput({ ...valid, deadline: "2027-10-28" }, now).deadline.toISOString().slice(0, 10), "2027-10-28");
  assert.equal(MISSION_GOALS.length, 3);
});

test("mission setup rejects impossible targets and expired dates", () => {
  assert.throws(() => parseMissionInput({ ...valid, target: 0 }, now), /target/i);
  assert.throws(() => parseMissionInput({ ...valid, deadline: "2026-10-27" }, now), /deadline/i);
  assert.throws(() => parseMissionInput({ ...valid, deadline: "2027-11-28" }, now), /deadline/i);
  assert.throws(() => parseMissionInput({ ...valid, goal: "revenue" }, now), /goal/i);
});

test("progress counts reached milestones even after the current stage changes", () => {
  const leads = [{ status: "new" }, { status: "contacted" }, { status: "replied" }, { status: "meeting-booked" }, { status: "won" }, { status: "dead", bookedAt: now }];
  assert.equal(missionProgress("qualified-replies", leads), 1);
  assert.equal(missionProgress("booked-calls", leads), 2);
  assert.equal(missionProgress("won-clients", leads), 1);
  assert.equal(missionProgress("booked-calls", [{ status: "won" }]), 0);
  assert.equal(missionProgress("qualified-replies", [{ status: "meeting-booked" }]), 0);
  assert.deepEqual(missionMilestonesForStage("won"), { replied: false, booked: false, won: true });
  assert.deepEqual(missionMilestonesForStage("meeting-booked"), { replied: false, booked: true, won: false });
});

test("next step follows the review and outreach queue", () => {
  assert.match(missionNextStep(2, ["contacted"]), /Review 2/);
  assert.match(missionNextStep(0, []), /Add prospects/);
  assert.match(missionNextStep(0, ["draft-ready"]), /Prepare and send/);
  assert.match(missionNextStep(0, ["contacted"]), /Check the 1 contacted/);
});
