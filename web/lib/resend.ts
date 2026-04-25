import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping email");
    return;
  }
  return resend.emails.send({
    from: process.env.RESEND_FROM ?? "Fortify <hello@fortify.app>",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}

export function welcomeEmail(name: string, tier: string) {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h1 style="font-size: 24px; margin: 0 0 16px;">Welcome to Fortify, ${name}.</h1>
      <p style="color: #555; line-height: 1.6;">
        You've unlocked the <strong>${tier}</strong> tier. Head to your dashboard to start using your new tools.
      </p>
      <a href="https://fortify.app/dashboard" style="display: inline-block; margin-top: 24px; background: #000; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 500;">
        Open dashboard →
      </a>
    </div>
  `;
}
