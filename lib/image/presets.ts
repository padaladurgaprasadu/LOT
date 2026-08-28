export interface PhotoshootPreset {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  aspectRatio: "1:1" | "16:9" | "9:16" | "4:3";
  promptSuffix: string;
  negativePrompt: string;
  lightingDescription: string;
  lensSpecs: string;
}

export const PHOTOSHOOT_PRESETS: PhotoshootPreset[] = [
  {
    id: "dslr_photographer",
    name: "1. DSLR Photographer Mode",
    tagline: "85mm f/1.4 lens, creamy circular bokeh, ultra-sharp subject focus",
    icon: "Camera",
    aspectRatio: "1:1",
    promptSuffix: "masterpiece, 85mm f/1.4 lens, creamy optical bokeh background, razor-sharp focus on subject, natural skin texture and pores, studio catchlights in eyes, professional color science, 8k resolution, raw photo",
    negativePrompt: "blurry, smooth plastic skin, oversaturated, deformed, bad eyes, extra limbs, artificial look, low quality",
    lightingDescription: "Directional softbox with subtle rim backlighting",
    lensSpecs: "85mm Prime f/1.4",
  },
  {
    id: "cinematic_photoshoot",
    name: "2. Cinematic Photoshoot",
    tagline: "2.39:1 anamorphic widescreen, Kodak 35mm film grain, Hollywood teal-orange",
    icon: "Clapperboard",
    aspectRatio: "16:9",
    promptSuffix: "cinematic still from an IMAX movie, 2.39:1 anamorphic lens, Kodak Vision3 500T 35mm film grain, Hollywood teal and orange color grading, dramatic volumetric haze, atmospheric lighting, moody shadows, photorealistic",
    negativePrompt: "video game graphics, cartoon, 3d render, oversaturated, flat lighting, digital noise, drawing",
    lightingDescription: "High-contrast chiaroscuro volumetric lighting",
    lensSpecs: "Panavision 50mm Anamorphic T2.0",
  },
  {
    id: "luxury_instagram",
    name: "3. Luxury Instagram Photoshoot",
    tagline: "High-fashion editorial, clean modern minimalism, softbox beauty-dish",
    icon: "Sparkles",
    aspectRatio: "1:1",
    promptSuffix: "luxury fashion editorial photoshoot, modern aesthetic, soft beauty-dish lighting, minimalist opulent backdrop, crisp elegant details, high-end Vogue magazine style, clean color harmony, premium visual quality",
    negativePrompt: "cheap, cluttered background, messy, blurry, low resolution, bad composition, watermark, text",
    lightingDescription: "Large octabox diffused soft beauty light",
    lensSpecs: "50mm f/1.8 Studio Prime",
  },
  {
    id: "travel_influencer",
    name: "4. Travel Influencer Look",
    tagline: "Wide-angle 24mm, vibrant exotic landscape, dynamic outdoor sunlight",
    icon: "Globe",
    aspectRatio: "9:16",
    promptSuffix: "stunning travel influencer photography, exotic vibrant destination in background, dynamic 24mm wide angle perspective, warm natural sunlight, aesthetic wanderlust mood, rich vivid colors, crystal clear details",
    negativePrompt: "indoor, dark, dull colors, plastic skin, tourist crowds, blurry background, overexposed",
    lightingDescription: "Natural outdoor ambient sun with golden fill",
    lensSpecs: "24mm Wide Angle f/2.8",
  },
  {
    id: "magazine_cover",
    name: "5. Magazine Cover Look",
    tagline: "Vogue / GQ editorial layout, high-contrast studio flash, hero posture",
    icon: "BookOpen",
    aspectRatio: "4:3",
    promptSuffix: "Vogue and GQ fashion magazine cover shoot, high-fashion styling, bold direct studio strobe flash, crisp outlines, commanding confident posture, clean editorial studio backdrop, flawless detail, 8k commercial print quality",
    negativePrompt: "amateur, grainy, blurry, bad anatomy, deformed hands, casual look, bad framing",
    lightingDescription: "Dual studio strobes with hard key light",
    lensSpecs: "70mm f/2.8 Editorial Zoom",
  },
  {
    id: "restore_old_photo",
    name: "6. Restore Old Photos",
    tagline: "Scratch removal, face reconstruction, historical colorization, 4K upscale",
    icon: "History",
    aspectRatio: "1:1",
    promptSuffix: "masterfully restored vintage photograph, perfect face reconstruction, sharp crisp details, natural realistic colorization, zero scratches, zero noise, high dynamic range, archival museum preservation quality",
    negativePrompt: "scratches, dust, torn paper, sepia blur, faded colors, pixelated, distorted faces, compression artifacts",
    lightingDescription: "Balanced archival studio restoration lighting",
    lensSpecs: "Flatbed High-DPI Optical Scanner",
  },
  {
    id: "change_location",
    name: "7. Change Your Location",
    tagline: "Transport subject to Paris, Swiss Alps, Tokyo, or futuristic skyline",
    icon: "MapPin",
    aspectRatio: "16:9",
    promptSuffix: "seamless location composite, photorealistic integration, perfect lighting and shadow matching between subject and world-class iconic destination background, atmospheric depth, ultra-realistic perspective",
    negativePrompt: "poor cutout, green screen edge halo, mismatched shadows, fake background, bad perspective",
    lightingDescription: "Matched environmental ambient lighting",
    lensSpecs: "35mm Environmental Prime f/2.0",
  },
  {
    id: "professional_headshot",
    name: "8. Professional Headshot",
    tagline: "LinkedIn / Corporate attire, modern office backdrop, confident portrait",
    icon: "Briefcase",
    aspectRatio: "1:1",
    promptSuffix: "executive professional headshot portrait, crisp tailored business blazer, subtle blurred modern glass office background, warm engaging smile, confident eye contact, clean commercial corporate lighting, 8k",
    negativePrompt: "casual clothes, t-shirt, messy hair, party background, selfie angle, bad lighting, sunglasses",
    lightingDescription: "Three-point corporate portrait lighting",
    lensSpecs: "85mm Portrait Prime f/2.0",
  },
  {
    id: "golden_hour",
    name: "9. Golden Hour Photoshoot",
    tagline: "Warm 5 PM sunset backlighting, dreamy lens flare, romantic golden glow",
    icon: "Sun",
    aspectRatio: "1:1",
    promptSuffix: "breathtaking golden hour portrait photography, 5 PM warm setting sun backlight, gentle anamorphic lens flare, glowing golden rim lighting on hair and shoulders, dreamy romantic atmosphere, rich warm tones",
    negativePrompt: "harsh midday sun, cold blue tones, dark shadows, overcast, neon lights, artificial flash",
    lightingDescription: "Low-angle warm setting sun backlight",
    lensSpecs: "50mm f/1.2 Dreamy Prime",
  },
  {
    id: "drone_shots",
    name: "10. Drone Shots",
    tagline: "Top-down 90-degree bird's-eye view, epic wide aerial perspective",
    icon: "Plane",
    aspectRatio: "16:9",
    promptSuffix: "spectacular high-altitude drone aerial photography, top-down 90-degree bird's eye view, sweeping panoramic landscape, ultra-wide perspective, crisp geometric patterns, cinematic scale, 8k crystal clear",
    negativePrompt: "ground level, eye level, selfie, close up, fisheye distortion, blurry, low altitude",
    lightingDescription: "Expansive overhead natural daylight",
    lensSpecs: "Hasselblad Aerial 20mm f/2.8",
  },
];
