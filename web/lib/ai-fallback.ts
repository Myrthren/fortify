// Only provider availability failures qualify. Invalid prompts, oversized input,
// safety refusals and application errors must not be retried at another provider.
export function canFallback(error: unknown): boolean {
  const e = error as { status?: number; name?: string; error?: unknown; message?: string };
  if (!e || typeof e !== "object") return false;
  if ([401, 402, 408, 429].includes(e.status ?? 0) || (e.status ?? 0) >= 500) return true;
  if (["APIConnectionError", "APIConnectionTimeoutError"].includes(e.name ?? "")) return true;
  const details = `${e.message ?? ""} ${JSON.stringify(e.error ?? {})}`;
  return e.status === 400 && /credit balance is too low|insufficient[_ ](?:credit|quota)|billing[_ ]hard[_ ]limit/i.test(details);
}
