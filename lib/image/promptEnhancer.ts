import { PHOTOSHOOT_PRESETS, PhotoshootPreset } from "./presets";

export function enhanceImagePrompt(userPrompt: string, presetId?: string): {
  finalPrompt: string;
  negativePrompt: string;
  preset: PhotoshootPreset | null;
  aspectRatio: string;
} {
  const preset = PHOTOSHOOT_PRESETS.find((p) => p.id === presetId) || null;

  if (preset) {
    const finalPrompt = `${userPrompt.trim()}, ${preset.promptSuffix}`;
    return {
      finalPrompt,
      negativePrompt: preset.negativePrompt,
      preset,
      aspectRatio: preset.aspectRatio,
    };
  }

  // Default smart enhancement if no specific preset is selected
  const defaultSuffix = "masterpiece, ultra-detailed 8k resolution, cinematic photorealistic lighting, sharp focus, professional color grading";
  const defaultNegative = "blurry, low quality, distorted, extra limbs, bad anatomy, deformed eyes, watermark, noise";

  return {
    finalPrompt: `${userPrompt.trim()}, ${defaultSuffix}`,
    negativePrompt: defaultNegative,
    preset: null,
    aspectRatio: "1:1",
  };
}
