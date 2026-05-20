import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * DELETE /api/user/delete
 * Anonymises and deletes all personal data for the authenticated user.
 *
 * Strategy: delete linked data, then anonymise the User row so foreign-key
 * integrity is preserved (e.g., generation logs referenced by other systems).
 * The user row is stripped of all personal identifiers.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  try {
    await db.$transaction(async (tx) => {
      // Delete user-owned content in dependency order
      await tx.chatSession.deleteMany({ where: { userId } });
      await tx.aiSession.deleteMany({ where: { userId } });
      await tx.generation.deleteMany({ where: { userId } });
      await tx.watchTerm.deleteMany({ where: { userId } });
      await tx.abuseAlert.deleteMany({ where: { userId } });
      await tx.creditTransaction.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.brandVoice.deleteMany({ where: { userId } });
      await tx.reconSearch.deleteMany({ where: { userId } });
      await tx.workflow.deleteMany({ where: { userId } });
      await tx.competitor.deleteMany({ where: { userId } });
      await tx.competitorWatch.deleteMany({ where: { userId } });
      await tx.companyDna.deleteMany({ where: { userId } });
      await tx.mediaItem.deleteMany({ where: { userId } });
      await tx.dealPost.deleteMany({ where: { userId } });
      await tx.forumPost.deleteMany({ where: { userId } });
      await tx.forumComment.deleteMany({ where: { userId } });
      await tx.paypalConnection.deleteMany({ where: { userId } });
      await tx.workflowCapacityPack.deleteMany({ where: { userId } });

      // Cancel active subscriptions (mark as cancelled in DB)
      await tx.subscription.updateMany({
        where: { userId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });

      // Delete social / profile data
      await tx.profile.deleteMany({ where: { userId } });
      await tx.userConnection.deleteMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      });
      await tx.userMessage.deleteMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      });
      await tx.podMember.deleteMany({ where: { userId } });

      // Delete integrations
      await tx.googleConnection.deleteMany({ where: { userId } });
      await tx.metaConnection.deleteMany({ where: { userId } });
      await tx.shopifyConnection.deleteMany({ where: { userId } });
      await tx.stripeConnection.deleteMany({ where: { userId } });
      await tx.notionConnection.deleteMany({ where: { userId } });
      await tx.notificationPrefs.deleteMany({ where: { userId } });

      // Anonymise the User row — strip all personal identifiers
      await tx.user.update({
        where: { id: userId },
        data: {
          email:        null,
          name:         "Deleted User",
          username:     null,
          discordId:    null,
          image:        null,
          tier:         "FREE",
          credits:      0,
          freeAiUsed:   false,
        },
      });

      // Invalidate all sessions
      await tx.session.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
    });

    return NextResponse.json({ deleted: true });
  } catch (e: any) {
    console.error("[user/delete]", e);
    return NextResponse.json({ error: "Failed to delete account. Please contact support." }, { status: 500 });
  }
}
