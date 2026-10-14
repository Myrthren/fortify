import { db } from "@/lib/db";
import { buildBusinessContext } from "@/lib/business-context";

export async function clientContext(userId: string, workspaceId: string, voiceId?: string | null) {
  if (!workspaceId || workspaceId.length > 100) throw new Error("Invalid client context");
  const client = await db.clientWorkspace.findFirst({ where: { id: workspaceId, userId }, select: { name: true, entries: true, brandVoiceId: true } });
  if (!client) throw new Error("Client context unavailable");
  // Never fall back to the account's active voice when a client has none.
  const selectedVoice = voiceId === undefined ? client.brandVoiceId : voiceId;
  const voice = selectedVoice ? await db.brandVoice.findFirst({ where: { id: selectedVoice, userId }, select: { name: true, systemPrompt: true } }) : null;
  if (selectedVoice && !voice) throw new Error("Client voice unavailable");
  const businessContext = buildBusinessContext(client.entries);
  return { businessContext, voice, contextUsed: { companyDna: !!businessContext, brandVoice: voice?.name ?? null, client: client.name } };
}
