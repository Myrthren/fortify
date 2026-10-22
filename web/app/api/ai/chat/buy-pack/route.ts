import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Paid members now continue on alternative AI when their included Claude budget is used.
// Do not mint legacy packs that cannot add to the new weekly allowance.
export async function POST() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json({ error: "Fortify AI now uses weekly Claude allowances with alternative AI afterwards. Extra chat packs are unavailable." }, { status: 409 });
}
