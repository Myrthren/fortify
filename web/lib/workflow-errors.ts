// Turns a raw workflow step error into something a member can act on.
// Used when a run is logged and again when old runs are displayed, so
// messages saved before this existed are translated too. Errors written for
// users ("No channel ID configured") pass through unchanged.
export function readableRunError(raw: string): string {
  const msg = raw.trim();

  if (/credit balance is too low|insufficient[_ ](?:credit|quota)|billing[_ ]hard[_ ]limit|overloaded|rate[_ ]?limit|ECONNRESET|ETIMEDOUT|timed? ?out|No text-generation provider/i.test(msg)
    || /^(?:401|402|408|429|5\d\d)\b/.test(msg)) {
    return "The AI service was unavailable for this step. Run the workflow again in a few minutes.";
  }

  if (/is not a function|is not defined|cannot read propert|of undefined|of null|TypeError|ReferenceError/i.test(msg)) {
    return "Fortify hit an internal error on this step. Run it again, and contact support if it keeps happening.";
  }

  // Provider error bodies look like `400 {"type":"error","error":{"message":"..."}}`.
  const body = msg.match(/^\d{3}\s+(\{[\s\S]*\})$/);
  if (body) {
    try {
      const inner = JSON.parse(body[1])?.error?.message;
      if (typeof inner === "string" && inner) return inner;
    } catch {
      // Not JSON after all; fall through to the raw message.
    }
  }

  return msg;
}
