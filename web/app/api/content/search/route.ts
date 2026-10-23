import { NextResponse } from "next/server";
import { braveSearch } from "@/lib/brave";
import { contentUrl } from "@/lib/content-workspace";
import {
  contentActor,
  contentBody,
  contentError,
  ContentError,
  requireContentAccess,
} from "@/lib/content-storage";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
export async function POST(req: Request) {
  try {
    const user = await contentActor(req);
    if (user instanceof Response) return user;
    requireContentAccess("research", user.tier);
    const limit = rateLimit(`content-search:${user.id}`, 5, 60000);
    if (!limit.ok) return rateLimitResponse(limit.resetMs);
    const body = await contentBody(req);
    if (
      typeof body.query !== "string" ||
      body.query.trim().length < 3 ||
      body.query.length > 200
    )
      throw new ContentError(
        "Enter a research question between 3 and 200 characters.",
      );
    if (!process.env.BRAVE_API_KEY)
      return NextResponse.json(
        {
          error:
            "Web search is not connected. You can still add your own interviews, comments and source links.",
        },
        { status: 503 },
      );
    const items = await braveSearch({ query: body.query.trim(), count: 10 });
    const results = items.flatMap((item) => {
      try {
        const url = contentUrl(item.url);
        if (!url || !item.description?.trim()) return [];
        return [
          {
            title: item.title.slice(0, 200),
            excerpt: item.description.slice(0, 4000),
            url,
            source: item.source || new URL(url).hostname,
            date: new Date().toISOString().slice(0, 10),
          },
        ];
      } catch {
        return [];
      }
    });
    return NextResponse.json({
      results,
      note: "Search snippets, not full-page quotations. Dates show when results were collected.",
    });
  } catch (e) {
    return contentError(e);
  }
}
