"use client";

import React, { useEffect, useState } from "react";

interface HeroImage {
  url: string;
  title: string;
}

// Reject Wikipedia pages whose description matches software, coding, or abstract concepts
const BLOCKED_WIKI_DESCRIPTIONS =
  /\b(programming|software|language|computer|algorithm|statement|data structure|library|framework|operating system|protocol|mathematics|concept|disambiguation|wikimedia|syntax|theorem|function)\b/i;

// Allow Wikipedia pages that have coordinates (places/landmarks) OR match visual entity descriptions
const ALLOWED_WIKI_DESCRIPTIONS =
  /\b(city|town|village|state|country|district|island|mountain|hill|river|lake|beach|temple|church|mosque|monument|palace|fort|building|park|politician|actor|actress|singer|musician|player|cricketer|footballer|scientist|author|entrepreneur|businessperson|billionaire|leader|emperor|king|queen|animal|bird|mammal|reptile|species|breed|dish|food|cuisine|dessert|beverage|planet|galaxy)\b/i;

function isValidRealPhotoUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  // Block SVGs, SVG thumbnails (.svg.png), GIFs, icons, logos, flags, and maps
  if (/\.svg(\.png|\.jpg)?$/i.test(lower)) return false;
  if (lower.endsWith(".gif") || lower.endsWith(".tif") || lower.endsWith(".webm")) return false;
  if (
    /\b(logo|icon|symbol|flag_of|coat_of_arms|map_of|locator_map|diagram|flowchart|screenshot|signature|stub)\b/i.test(
      lower
    )
  ) {
    return false;
  }
  return true;
}

export function HeroImageGallery({ entity }: { entity: string | null }) {
  const [images, setImages] = useState<HeroImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!entity || !entity.trim()) {
      setImages([]);
      return;
    }

    let isMounted = true;

    async function fetchVerifiedHeroImages(query: string) {
      try {
        // STEP 1: Resolve exact Wikipedia page and verify it is a real-world visual entity
        const searchRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
            query
          )}&srlimit=1&format=json&origin=*`,
          {
            headers: { "Api-User-Agent": "LOT-AIOS/1.0 (contact: github.com/padaladurgaprasadu/LOT)" },
          }
        ).then((r) => r.json());

        const bestTitle = searchRes?.query?.search?.[0]?.title;
        if (!bestTitle) {
          if (isMounted) setImages([]);
          return;
        }

        const summaryRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
            bestTitle
          )}`,
          {
            headers: { "Api-User-Agent": "LOT-AIOS/1.0 (contact: github.com/padaladurgaprasadu/LOT)" },
          }
        ).then((r) => r.json());

        const description = `${summaryRes?.description || ""} ${
          summaryRes?.extract || ""
        }`;
        const hasCoordinates = Boolean(summaryRes?.coordinates);

        // Reject immediately if it's a coding/software/abstract topic
        if (BLOCKED_WIKI_DESCRIPTIONS.test(description)) {
          if (isMounted) setImages([]);
          return;
        }

        // Only allow if it has geographic coordinates (Place/Temple/Monument) OR matches Person/Place/Animal/Dish
        if (!hasCoordinates && !ALLOWED_WIKI_DESCRIPTIONS.test(description)) {
          if (isMounted) setImages([]);
          return;
        }

        const collected: HeroImage[] = [];
        const seenUrls = new Set<string>();

        // Add primary Wikipedia image if it's a real photo
        const leadImg =
          summaryRes?.originalimage?.source || summaryRes?.thumbnail?.source;
        if (leadImg && isValidRealPhotoUrl(leadImg)) {
          seenUrls.add(leadImg);
          collected.push({ url: leadImg, title: bestTitle });
        }

        // STEP 2: Fetch additional real photos strictly for this verified entity from Commons
        const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          `"${bestTitle}"`
        )}%20filetype:bitmap%20-logo%20-map%20-icon&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`;

        const commonsRes = await fetch(commonsUrl, {
          headers: { "Api-User-Agent": "LOT-AIOS/1.0 (contact: github.com/padaladurgaprasadu/LOT)" },
        }).then((r) => r.json());
        const commonsPages = commonsRes?.query?.pages
          ? Object.values(commonsRes.query.pages)
          : [];

        for (const page of commonsPages as any[]) {
          const imgUrl =
            page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url;
          if (
            imgUrl &&
            isValidRealPhotoUrl(imgUrl) &&
            !seenUrls.has(imgUrl)
          ) {
            seenUrls.add(imgUrl);
            collected.push({
              url: imgUrl,
              title: page.title.replace(/^File:/i, "").replace(/\.[^.]+$/, ""),
            });
          }
          if (collected.length >= 4) break;
        }

        // Only show the gallery if we found at least 2 real photos
        if (isMounted) {
          setImages(collected.length >= 2 ? collected.slice(0, 4) : []);
        }
      } catch {
        if (isMounted) setImages([]);
      }
    }

    fetchVerifiedHeroImages(entity);
    return () => {
      isMounted = false;
    };
  }, [entity]);

  if (!images.length) return null;

  return (
    <>
      <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-2 rounded-2xl overflow-hidden w-full max-w-3xl border border-neutral-800 bg-neutral-900/40 shadow-xl">
        <div
          onClick={() => setSelectedImage(images[0].url)}
          className="md:col-span-2 h-56 md:h-64 relative cursor-pointer overflow-hidden group bg-neutral-950"
        >
          <img
            src={images[0].url}
            alt={images[0].title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <span className="text-xs text-white/90 font-medium truncate">{images[0].title}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-1 gap-2 h-24 md:h-64">
          {images.slice(1, 4).map((img, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedImage(img.url)}
              className="relative cursor-pointer overflow-hidden group h-full bg-neutral-950"
            >
              <img
                src={img.url}
                alt={img.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                <span className="text-[10px] text-white/90 truncate">{img.title}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-zoom-out animate-in fade-in duration-200"
        >
          <img
            src={selectedImage}
            alt="Full view"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl border border-white/10"
          />
        </div>
      )}
    </>
  );
}

export default HeroImageGallery;
