import type { Exchange, PersonId, World } from "./research-institute";

export type RecordedExchange = Exchange & { id: string; round: number; eventId: number; detail: string };
export function teamExchanges(world: World): RecordedExchange[] {
  return world.events.flatMap(event => (event.exchanges ?? []).map((exchange, i) => ({
    ...exchange, id: `${event.id}:${i}`, eventId: event.id, round: event.round, detail: event.text,
  })));
}
export function currentExchanges(world: World, person?: PersonId) {
  return teamExchanges(world).filter(exchange => exchange.round === world.round && (!person || exchange.from === person || exchange.to === person));
}
export function focusExchanges(world: World, person: PersonId) {
  const priority = { review: 4, support: 3, handoff: 3, request: 2, coordination: 1 };
  const threads = new Map<string, RecordedExchange>();
  for (const exchange of currentExchanges(world, person)) {
    const key = [exchange.from, exchange.to].sort().join(":") + `:${exchange.trialId ?? "work"}`;
    const previous = threads.get(key);
    // Everyone chooses from the prior snapshot. A redundant request can resolve
    // after its actual review in the same round; keep the recorded response in
    // focus while preserving both events in the chronological log.
    if (!previous || priority[exchange.kind] >= priority[previous.kind]) threads.set(key, exchange);
  }
  return [...threads.values()].sort((a, b) => priority[a.kind] - priority[b.kind] || a.eventId - b.eventId).slice(-3);
}
export function conversationPartner(world: World, person: PersonId): PersonId | null {
  if (world.status !== "active") return null;
  const agent = world.agents.find(a => a.id === person)!;
  // Looking across a room is a presentation of an actual communication. A
  // remote support message never teleports either person into a conversation.
  if (agent.location !== "meeting" && agent.location !== "analysis") return null;
  const exchanges = currentExchanges(world, person).slice().reverse();
  for (const exchange of exchanges) {
    const partner = exchange.from === person ? exchange.to : exchange.from;
    if (world.agents.find(a => a.id === partner)?.location === agent.location) return partner;
  }
  return null;
}
