/**
 * LOT-OS Real-Time Web Grounding Route (app/api/web-grounding/route.ts)
 * Ingests live external intelligence via Jina Reader, Google News RSS, and ArXiv query API.
 */

import { NextRequest, NextResponse } from "next/server";
import { WebGroundingRequest, WebGroundingResponse } from "@/lib/lot-os/types";
import { executeWebGrounding } from "@/lib/lot-os/webGrounding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body: WebGroundingRequest = await req.json().catch(() => ({}));
    const result = await executeWebGrounding(body);

    return NextResponse.json<WebGroundingResponse>(result, {
      status: 200,
      headers: {
        "X-LOT-Grounding": "active",
      },
    });
  } catch (err: any) {
    console.error("[WebGrounding Route] Unexpected error:", err);

    return NextResponse.json<WebGroundingResponse>(
      {
        success: false,
        markdown: "### ⚠️ Grounding Unreachable\nUnable to ingest external ground sources.",
        sources: [],
        error: err?.message || "Grounding pipeline encountered an unexpected failure.",
      },
      { status: 200 } // Keep 200 OK so client components can display fallback gracefully
    );
  }
}
