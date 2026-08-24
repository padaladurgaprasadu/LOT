import { NextRequest, NextResponse } from "next/server";
import { transcribeAudioWithWhisper } from "@/lib/whisper";
import { verifyJwt } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("lot_session_token")?.value;
    const session = token ? verifyJwt(token) : null;
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required for voice transcription." },
        { status: 401 }
      );
    }

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("audio") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const result = await transcribeAudioWithWhisper(buffer, file.name, file.type);

      return NextResponse.json(result);
    }

    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { base64Audio, mimeType, fileName } = body;

      if (!base64Audio) {
        return NextResponse.json({ error: "No base64 audio provided" }, { status: 400 });
      }

      const cleanBase64 = base64Audio.replace(/^data:audio\/\w+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");
      const result = await transcribeAudioWithWhisper(buffer, fileName || "recording.webm", mimeType || "audio/webm");

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Whisper transcription failed" },
      { status: 500 }
    );
  }
}
