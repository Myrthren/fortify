import { db } from "@/lib/db";

export type CreditReservation = { id: string; userId: string; amount: number; source: string };

/** Conditional debit and ledger entry commit together, even with concurrent requests. */
export async function reserveCredits(userId: string, amount: number, source: string): Promise<CreditReservation | null> {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid credit reservation");
  return db.$transaction(async (tx) => {
    const debit = await tx.user.updateMany({
      where: { id: userId, credits: { gte: amount } },
      data: { credits: { decrement: amount } },
    });
    if (debit.count !== 1) return null;
    const entry = await tx.creditTransaction.create({ data: { userId, amount: -amount, source } });
    return { id: entry.id, userId, amount, source };
  });
}

/** Deterministic refund ID makes retries safe; the transaction prevents partial refunds. */
export async function refundCredits(reservation: CreditReservation): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      await tx.creditTransaction.create({ data: {
        id: `refund:${reservation.id}`, userId: reservation.userId,
        amount: reservation.amount, source: `refund_${reservation.source}`,
      } });
      await tx.user.update({ where: { id: reservation.userId }, data: { credits: { increment: reservation.amount } } });
    });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const existing = await db.creditTransaction.findUnique({ where: { id: `refund:${reservation.id}` } });
      if (existing?.userId === reservation.userId && existing.amount === reservation.amount) return;
    }
    throw error;
  }
}
