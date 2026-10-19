// Shared, provider-free session state. Progress uses the existing message JSON.
export const ADVISOR_SECTIONS = [
  { title: "Diagnosis", instruction: "Diagnose the challenge using the member's actual context. Explain the main constraint, missing evidence and the opportunities that matter most." },
  { title: "Recommended strategy", instruction: "Recommend a strategy that addresses the diagnosis. Explain the tradeoffs, alternatives and specific Fortify tools or outside work required. Do not repeat the diagnosis." },
  { title: "Prioritised action plan", instruction: "Finish with a numbered, prioritised action plan. Explain what to do first, which available tools to use and how to assess progress. Separate proposed targets from known results. Do not repeat the earlier sections." },
] as const;

export type AdvisorProgress = {
  version: 1;
  sections: string[];
  attempts: number;
  leaseId: string | null;
  leaseUntil: number;
};

export type AdvisorSession = {
  id: string;
  title: string;
  messages: { role: "user" | "assistant"; content: string }[];
  createdAt: string;
  // null identifies historical sessions and monthly Growth Briefs.
  completedSections: number | null;
};

export function initialAdvisorProgress(): AdvisorProgress {
  return { version: 1, sections: [], attempts: 0, leaseId: null, leaseUntil: 0 };
}

export function readAdvisorProgress(messages: unknown): AdvisorProgress | null {
  if (!Array.isArray(messages) || messages[0]?.role !== "user") return null;
  const value = messages[0]?.advisor;
  if (value?.version !== 1 || !Array.isArray(value.sections) ||
      value.sections.length > ADVISOR_SECTIONS.length ||
      !value.sections.every((s: unknown) => typeof s === "string" && s.trim()) ||
      !Number.isInteger(value.attempts) || value.attempts < 0 ||
      !(value.leaseId === null || typeof value.leaseId === "string") ||
      !Number.isFinite(value.leaseUntil)) return null;
  return value as AdvisorProgress;
}

export function advisorMessages(challenge: string, progress: AdvisorProgress) {
  return [
    { role: "user", content: challenge, advisor: progress },
    ...(progress.sections.length ? [{ role: "assistant", content: progress.sections.join("\n\n") }] : []),
  ];
}

export function advisorSessionView(session: { id: string; title: string; messages: unknown; createdAt: Date }): AdvisorSession {
  const progress = readAdvisorProgress(session.messages);
  return {
    id: session.id, title: session.title, createdAt: session.createdAt.toISOString(),
    messages: Array.isArray(session.messages) ? session.messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content })) : [],
    completedSections: progress?.sections.length ?? null,
  };
}

/** Separate HTTP requests give every section its own function time budget. */
export async function runAdvisorRequests(
  input: { challenge: string } | { session: AdvisorSession },
  onProgress: (session: AdvisorSession) => void,
  send: typeof fetch = fetch,
): Promise<AdvisorSession> {
  async function request(body: object): Promise<AdvisorSession> {
    const response = await send("/api/ai/advisor", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (data.session) onProgress(data.session);
    if (!response.ok) throw new Error(data.error ?? "The Advisor is unavailable. Try again shortly.");
    if (!data.session) throw new Error("The Advisor returned an invalid response. Try again shortly.");
    return data.session;
  }

  let session = "session" in input ? input.session : await request({ challenge: input.challenge });
  while (session.completedSections !== null && session.completedSections < ADVISOR_SECTIONS.length) {
    const previous = session.completedSections;
    session = await request({ sessionId: session.id, step: previous });
    if (session.completedSections === null || session.completedSections <= previous) {
      throw new Error("Your progress is saved. Please continue the session shortly.");
    }
  }
  return session;
}
