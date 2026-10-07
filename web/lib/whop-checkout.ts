/** Use exact dashboard URLs; never construct or rewrite affiliate tracking links. */
export function whopUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "whop.com" && !url.username && !url.password
      ? value : null;
  } catch { return null; }
}

export function whopCheckoutUrls() {
  return {
    pro: whopUrl(process.env.WHOP_CHECKOUT_PRO),
    elite: whopUrl(process.env.WHOP_CHECKOUT_ELITE),
    apex: whopUrl(process.env.WHOP_CHECKOUT_APEX),
  };
}
