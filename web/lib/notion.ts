import { Client } from "@notionhq/client";

// ── OAuth helpers ──────────────────────────────────────────────────────────────

export function buildNotionAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.NOTION_CLIENT_ID!,
    redirect_uri: process.env.NOTION_REDIRECT_URI!,
    response_type: "code",
    owner: "user",
    state,
  });
  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
}

export async function exchangeNotionCode(code: string): Promise<{
  accessToken: string;
  botId: string;
  workspaceName: string;
  workspaceIcon: string | null;
}> {
  const credentials = Buffer.from(
    `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.NOTION_REDIRECT_URI!,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Notion token exchange failed: ${(err as any).error ?? res.status}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    botId: data.bot_id,
    workspaceName: data.workspace_name ?? "",
    workspaceIcon: data.workspace_icon?.emoji ?? data.workspace_icon?.external?.url ?? null,
  };
}

// ── Notion client ──────────────────────────────────────────────────────────────

export function notionClient(accessToken: string) {
  return new Client({ auth: accessToken });
}

// ── Export helpers ─────────────────────────────────────────────────────────────

/** Get a list of pages the bot has access to, for letting the user pick a root page */
export async function getAccessiblePages(accessToken: string) {
  const notion = notionClient(accessToken);
  const res = await notion.search({
    filter: { value: "page", property: "object" },
    sort: { direction: "descending", timestamp: "last_edited_time" },
    page_size: 20,
  });
  return res.results
    .filter((r): r is Extract<typeof r, { object: "page" }> => r.object === "page")
    .map((p) => ({
      id: p.id,
      title:
        "properties" in p && p.properties
          ? extractPageTitle(p.properties)
          : "Untitled",
    }));
}

function extractPageTitle(properties: Record<string, any>): string {
  for (const prop of Object.values(properties)) {
    if (prop.type === "title" && prop.title?.[0]?.plain_text) {
      return prop.title[0].plain_text;
    }
  }
  return "Untitled";
}

// ── Export: Competitor report ──────────────────────────────────────────────────

export async function exportCompetitorReport(
  accessToken: string,
  parentPageId: string,
  competitor: {
    name: string;
    url: string;
    lastReport: any;
    lastScanned: string | null;
  }
) {
  const notion = notionClient(accessToken);
  const r = competitor.lastReport;

  const children: any[] = [
    heading2("Overview"),
    paragraph(`URL: ${competitor.url}`),
    paragraph(`Last scanned: ${competitor.lastScanned ? new Date(competitor.lastScanned).toLocaleString() : "Never"}`),
    ...(r?.positioning ? [heading2("Positioning"), paragraph(r.positioning)] : []),
    ...(r?.summary ? [heading2("Bottom Line"), paragraph(r.summary)] : []),
    ...bulletSection("Recent Moves", r?.recentMoves),
    ...bulletSection("Strengths", r?.strengths),
    ...bulletSection("Weaknesses", r?.weaknesses),
    ...bulletSection("Opportunities for You", r?.opportunities),
  ];

  return notion.pages.create({
    parent: { page_id: parentPageId },
    properties: {
      title: [{ type: "text", text: { content: `Competitor Intel: ${competitor.name}` } }] as any,
    },
    children,
  });
}

// ── Export: Content brief ──────────────────────────────────────────────────────

export async function exportContentIdeas(
  accessToken: string,
  parentPageId: string,
  niche: string,
  ideas: { hook: string; angle: string; format: string }[]
) {
  const notion = notionClient(accessToken);

  const children: any[] = [
    heading2(`Niche: ${niche}`),
    paragraph(`Generated ${new Date().toLocaleDateString()}`),
    ...ideas.flatMap((idea, i) => [
      heading3(`${i + 1}. ${idea.hook}`),
      paragraph(`Angle: ${idea.angle}`),
      paragraph(`Format: ${idea.format}`),
    ]),
  ];

  return notion.pages.create({
    parent: { page_id: parentPageId },
    properties: {
      title: [{ type: "text", text: { content: `Content Ideas: ${niche}` } }] as any,
    },
    children,
  });
}

// ── Export: Virality analysis ──────────────────────────────────────────────────

export async function exportViralityReport(
  accessToken: string,
  parentPageId: string,
  item: {
    title: string;
    viralityReport: any;
    targetPlatforms: string[];
  }
) {
  const notion = notionClient(accessToken);
  const r = item.viralityReport;

  const children: any[] = [
    heading2("Target Platforms"),
    paragraph(item.targetPlatforms.join(", ")),
    ...(r?.summary ? [heading2("Summary"), paragraph(r.summary)] : []),
    ...item.targetPlatforms.flatMap((platform) => {
      const p = r?.platforms?.[platform];
      if (!p) return [];
      return [
        heading2(`${platform.charAt(0).toUpperCase() + platform.slice(1)} — Score: ${p.score}/10`),
        ...(p.verdict ? [paragraph(p.verdict)] : []),
        ...bulletSection("Suggestions", p.suggestions),
        ...bulletSection("Recommended Tags", p.tags),
        ...(p.bestTime ? [paragraph(`Best time to post: ${p.bestTime}`)] : []),
      ];
    }),
  ];

  return notion.pages.create({
    parent: { page_id: parentPageId },
    properties: {
      title: [{ type: "text", text: { content: `Virality Analysis: ${item.title}` } }] as any,
    },
    children,
  });
}

// ── Block builders ─────────────────────────────────────────────────────────────

function heading2(text: string) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function heading3(text: string) {
  return {
    object: "block",
    type: "heading_3",
    heading_3: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function paragraph(text: string) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function bulletSection(title: string, items?: string[]) {
  if (!items?.length) return [];
  return [
    heading3(title),
    ...items.map((item) => ({
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: { rich_text: [{ type: "text", text: { content: item } }] },
    })),
  ];
}
