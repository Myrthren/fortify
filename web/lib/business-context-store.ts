import { db } from "@/lib/db";
import { buildBusinessContext } from "@/lib/business-context";

/** Scope every lookup to the authenticated owner. null explicitly disables voice. */
export async function loadBusinessContext(userId: string, voiceId?: string | null) {
  const [dna, voice] = await Promise.all([
    db.companyDna.findUnique({ where: { userId }, select: { entries: true } }),
    voiceId === null ? Promise.resolve(null) : db.brandVoice.findFirst({
      where: voiceId ? { userId, id: voiceId } : { userId, isActive: true },
      select: { name: true, systemPrompt: true },
    }),
  ]);
  const businessContext = buildBusinessContext(dna?.entries);
  return { businessContext, voice, contextUsed: { companyDna: !!businessContext, brandVoice: voice?.name ?? null } };
}
