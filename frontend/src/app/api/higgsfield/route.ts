import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, aspectRatio = "16:9", motion = "zoom_in_dynamic" } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "A valid prompt string is required" },
        { status: 400 }
      );
    }

    const jobId = `hf_${Math.random().toString(36).substring(2, 10)}`;

    return NextResponse.json({
      jobId,
      prompt,
      aspectRatio,
      motion,
      status: "queued",
      progress: 10,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId query param required" }, { status: 400 });
  }

  return NextResponse.json({
    jobId,
    status: "completed",
    progress: 100,
    mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    previewUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
    completedAt: new Date().toISOString(),
  });
}
