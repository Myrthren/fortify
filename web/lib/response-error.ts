/** Read an unsuccessful response once, including non-JSON auth/proxy errors. */
export async function responseError(response: Response): Promise<string> {
  if (response.status === 401) return "Your session expired. Sign in again and retry.";
  if (response.status >= 500) return `Generation is temporarily unavailable (HTTP ${response.status}). Please try again later.`;
  const text = await response.text().catch(() => "");
  try {
    const data: unknown = JSON.parse(text);
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      return data.error;
    }
  } catch { /* Plain-text validation responses are also supported. */ }
  // Do not display proxy HTML or arbitrary remote response bodies.
  if (text && !text.includes("<") && text.length <= 250) return text;
  return `Generation failed (HTTP ${response.status}). Please try again.`;
}
