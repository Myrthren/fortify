import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getPayPalAccessToken } from "@/lib/paypal";
import { getCapPackById } from "@/lib/workflow-capacity";

const PAYPAL_BASE =
  process.env.PAYPAL_ENV === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

const BASE_URL = "https://fortify-io.com";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true } });
  if (!user || (user.tier !== "ELITE" && user.tier !== "APEX")) {
    return NextResponse.json({ error: "Requires Elite or Apex plan" }, { status: 403 });
  }

  const { packId } = (await req.json()) as { packId?: string };
  const pack = packId ? getCapPackById(packId) : null;
  if (!pack) return NextResponse.json({ error: "Invalid pack" }, { status: 400 });

  const token = await getPayPalAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: pack.id,
          description: `Fortify Workflow Capacity — ${pack.label}`,
          amount: { currency_code: "GBP", value: pack.price },
        },
      ],
      application_context: {
        brand_name: "Fortify",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: `${BASE_URL}/dashboard/workflows/confirm`,
        cancel_url: `${BASE_URL}/dashboard/workflows?cancelled=1`,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[workflows/capacity/create-order] PayPal error:", err);
    return NextResponse.json({ error: "PayPal order creation failed" }, { status: 502 });
  }

  const order = await res.json();
  const approveLink = order.links?.find((l: any) => l.rel === "approve")?.href;
  if (!approveLink) return NextResponse.json({ error: "No approve link" }, { status: 502 });

  return NextResponse.json({ orderId: order.id, approveUrl: approveLink });
}
