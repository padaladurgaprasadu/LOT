import { NextRequest, NextResponse } from "next/server";
import { enhanceImagePrompt } from "@/lib/image/promptEnhancer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, presetId, width = 1024, height = 1024, model = "flux" } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "A valid text prompt is required." }, { status: 400 });
    }

    const { finalPrompt, negativePrompt, preset, aspectRatio } = enhanceImagePrompt(prompt, presetId);

    // Calculate dimensions based on aspect ratio if not explicitly specified
    let targetWidth = width;
    let targetHeight = height;

    if (aspectRatio === "16:9") {
      targetWidth = 1280;
      targetHeight = 720;
    } else if (aspectRatio === "9:16") {
      targetWidth = 720;
      targetHeight = 1280;
    } else if (aspectRatio === "4:3") {
      targetWidth = 1024;
      targetHeight = 768;
    }

    const seed = Math.floor(Math.random() * 1000000000);
    const encodedPrompt = encodeURIComponent(finalPrompt);
    const encodedNegative = encodeURIComponent(negativePrompt);

    // High-speed Free FLUX.1 / SDXL generation endpoint
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${targetWidth}&height=${targetHeight}&seed=${seed}&model=${model}&nologo=true&enhance=false&negative=${encodedNegative}`;

    return NextResponse.json({
      success: true,
      imageUrl,
      seed,
      model,
      width: targetWidth,
      height: targetHeight,
      preset: preset ? preset.name : "Custom",
      enhancedPrompt: finalPrompt,
    });
  } catch (error: any) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate image.", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
