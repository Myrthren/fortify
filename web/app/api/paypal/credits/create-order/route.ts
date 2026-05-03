import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPayPalAccessToken } from "@/lib/paypal";
import { getPackById } from "@/lib/credit-packs";

const PAYPAL_BASE =
  process.env.PAYPAL_ENV === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

const BASE_URL = "https://fortify-io.com";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { packId } = (await req.json()) as { packId?: string };
  const pack = packId ? getPackById(packId) : null;
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
          description: `Fortify ${pack.credits.toLocaleString()} Credits`,
          amount: {
            currency_code: "GBP",
            value: pack.price,
          },
        },
      ],
      application_context: {
        brand_name: "Fortify",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: `${BASE_URL}/dashboard/credits/confirm`,
        cancel_url: `${BASE_URL}/dashboard/credits?cancelled=1`,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[credits/create-order] PayPal error:", err);
    return NextResponse.json({ error: "PayPal order creation failed" }, { status: 502 });
  }

  const order = await res.json();
  const approveLink = order.links?.find((l: any) => l.rel === "approve")?.href;

  if (!approveLink) {
    return NextResponse.json({ error: "No approve link in PayPal response" }, { status: 502 });
  }

  return NextResponse.json({ orderId: order.id, approveUrl: approveLink });
}
