import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { refreshPayPalToken } from "@/lib/paypal-merchant";

// POST — connect PayPal with Client ID + Secret
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const { clientId, clientSecret } = await req.json();
  if (!clientId?.trim() || !clientSecret?.trim()) {
    return NextResponse.json({ error: "Client ID and Secret required" }, { status: 400 });
  }

  let tokenData: { accessToken: string; expiresAt: Date };
  try {
    tokenData = await refreshPayPalToken(clientId.trim(), clientSecret.trim());
  } catch (e: any) {
    return NextResponse.json({ error: `Could not authenticate: ${e.message}` }, { status: 400 });
  }

  // Get merchant profile
  let merchantId = "connected";
  try {
    const profile = await fetch(
      "https://api-m.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1",
      {
        headers: { Authorization: `Bearer ${tokenData.accessToken}` },
      }
    );
    if (profile.ok) {
      const pd = await profile.json();
      merchantId = pd.payer_id ?? pd.user_id ?? "connected";
    }
  } catch {}

  await db.paypalConnection.upsert({
    where: { userId },
    create: {
      userId,
      merchantId,
      clientId: clientId.trim(),
      accessToken: tokenData.accessToken,
      expiresAt: tokenData.expiresAt,
    },
    update: {
      merchantId,
      clientId: clientId.trim(),
      accessToken: tokenData.accessToken,
      expiresAt: tokenData.expiresAt,
    },
  });

  return NextResponse.json({ ok: true, merchantId });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  await db.paypalConnection.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
