import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const DISCORD_API = "https://discord.com/api/v10";
const OWNER_DISCORD_ID = "731207920007643167";

function botHeaders() {
  return {
    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { subject?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { subject, message } = body;
  if (!message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: (session.user as any).id },
    select: { discordId: true, name: true },
  });

  if (!user?.discordId) {
    return NextResponse.json({ error: "Discord account not linked" }, { status: 400 });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 500 });
  }

  // Open (or reuse) a DM channel with the owner
  const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: botHeaders(),
    body: JSON.stringify({ recipient_id: OWNER_DISCORD_ID }),
  });

  if (!dmRes.ok) {
    console.error("[support] createDM failed:", dmRes.status, await dmRes.text());
    return NextResponse.json({ error: "Failed to reach owner" }, { status: 500 });
  }

  const { id: channelId } = await dmRes.json();

  const embed = {
    color: 0xffffff,
    title: "Support Message",
    fields: [
      {
        name: "From",
        value: `${user.name ?? "Unknown"} (\`${user.discordId}\`)`,
        inline: true,
      },
      {
        name: "Subject",
        value: (subject || "General enquiry").slice(0, 100),
        inline: true,
      },
      {
        name: "Message",
        value: message.trim().slice(0, 1024),
      },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: "Fortify Support · from web dashboard" },
  };

  const components = [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 1, // Primary
          label: "Open Ticket",
          custom_id: `support_open_${user.discordId}`,
          emoji: { name: "🎫" },
        },
        {
          type: 2,
          style: 2, // Secondary
          label: "Dismiss",
          custom_id: `support_dismiss_${user.discordId}`,
        },
      ],
    },
  ];

  const msgRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: botHeaders(),
    body: JSON.stringify({ embeds: [embed], components }),
  });

  if (!msgRes.ok) {
    console.error("[support] sendMessage failed:", msgRes.status, await msgRes.text());
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
