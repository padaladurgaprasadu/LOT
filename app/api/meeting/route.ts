import { NextRequest, NextResponse } from "next/server";
import { parseMeetingTranscript } from "@/lib/meeting/meetilyEngine";
import { verifyJwt } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("lot_session_token")?.value;
    const session = token ? verifyJwt(token) : null;
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required for Meeting Assistant." },
        { status: 401 }
      );
    }

    const { transcript, title } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Valid transcript text is required." },
        { status: 400 }
      );
    }

    const report = parseMeetingTranscript(transcript, title || "Executive Meeting Sync");

    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process meeting intelligence report." },
      { status: 500 }
    );
  }
}
