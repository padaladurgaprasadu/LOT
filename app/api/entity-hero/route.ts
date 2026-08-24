import { NextRequest, NextResponse } from "next/server";
import { resolveEntityHero } from "@/lib/entityHero";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ hero: null });
  }

  const hero = await resolveEntityHero(q);

  return NextResponse.json(
    { hero },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
