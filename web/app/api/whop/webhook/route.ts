import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDM } from "@/lib/discord";
import { alertOwner } from "@/lib/notifications";
import {
  parseMembershipEvent,
  revokeWhopTier,
  syncWhopTier,
  verifyWebhook,
} from "@/lib/whop";

export async function POST(req: Request) {
  const raw = await req.text();

  if (!verifyWebhook(req.headers, raw)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }

  // Whop is inconsistent across webhook systems: the v2 company API registers
  // `membership_went_valid` / `membership_went_invalid`, while the newer app
  // webhooks use `membership.activated` / `membership.deactivated`. Accept both.
  const rawType = (event?.type ?? event?.action ?? "") as string;
  const type =
    {
      membership_went_valid: "activated",
      "membership.activated": "activated",
      membership_went_invalid: "deactivated",
      "membership.deactivated": "deactivated",
    }[rawType] ?? null;

  if (!type) return NextResponse.json({ ok: true });

  // v2 delivers the membership at the payload root; app webhooks nest it in `data`.
  const { whopUserId } = parseMembershipEvent(event.data ?? event);
  if (!whopUserId) {
    console.error("[whop/webhook] no user id in payload", type);
    return NextResponse.json({ ok: true });
  }

  // We only act on Whop accounts already linked to a Fortify user.
  const user = await db.user.findUnique({
    where: { whopUserId },
    select: { id: true, name: true, email: true, discordId: true },
  });
  if (!user) return NextResponse.json({ ok: true });

  try {
    switch (type) {
      case "activated": {
        const { tier, applied } = await syncWhopTier(user.id, whopUserId);
        if (applied) {
          await alertOwner(
            "dmOwnerNewSub",
            `New Whop subscriber: **${user.name ?? user.email ?? "unknown"}** — ${tier} tier`
          );
        }
        break;
      }

      case "deactivated": {
        const res = await revokeWhopTier(user.id, whopUserId);
        if ("revoked" in res && res.revoked) {
          if (user.discordId) {
            await sendDM(
              user.discordId,
              "Your Fortify membership on Whop has ended. You've been moved to the Free tier. Resubscribe any time at https://fortify-io.com/pricing"
            );
          }
          await alertOwner(
            "dmOwnerChurn",
            `Whop churn: **${user.name ?? user.email ?? "unknown"}**`
          );
        }
        break;
      }

      // trial_ending_soon / other events: no tier change needed.
    }
  } catch (e: any) {
    console.error(`[whop/webhook] ${type}`, e);
    // 500 so Whop retries rather than dropping the event.
    return new NextResponse("Handler error", { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
