import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getPayPalTransactions, refreshPayPalToken } from "@/lib/paypal-merchant";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const paypalConn = await db.paypalConnection.findUnique({ where: { userId } });
  if (!paypalConn) return NextResponse.json({ error: "PayPal not connected" }, { status: 404 });

  let token = paypalConn.accessToken;

  // Refresh if expired
  if (paypalConn.expiresAt < new Date()) {
    try {
      const newToken = await refreshPayPalToken(paypalConn.clientId, ""); // secret not stored — re-auth needed
      await db.paypalConnection.update({
        where: { userId },
        data: { accessToken: newToken.accessToken, expiresAt: newToken.expiresAt },
      });
      token = newToken.accessToken;
    } catch {
      return NextResponse.json({ error: "PayPal token expired. Please reconnect." }, { status: 401 });
    }
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    const summary = await getPayPalTransactions(token, thirtyDaysAgo, now);
    return NextResponse.json(summary);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
