import { db } from "@/lib/db";
import { buildBusinessContext } from "@/lib/business-context";
import { clientContext } from "@/lib/client-context";

/** Scope every lookup to the authenticated owner. null explicitly disables voice. */
export async function loadBusinessContext(userId: string, voiceId?: string | null, clientWorkspaceId?: string | null) {
  if (clientWorkspaceId) return clientContext(userId, clientWorkspaceId, voiceId);
  const [dna, voice] = await Promise.all([
    db.companyDna.findUnique({ where: { userId }, select: { entries: true } }),
    voiceId === null ? Promise.resolve(null) : db.brandVoice.findFirst({
      where: voiceId ? { userId, id: voiceId } : { userId, isActive: true },
      select: { name: true, systemPrompt: true },
    }),
  ]);
  const businessContext = buildBusinessContext(dna?.entries);
  return { businessContext, voice, contextUsed: { companyDna: !!businessContext, brandVoice: voice?.name ?? null, client: null } };
}
