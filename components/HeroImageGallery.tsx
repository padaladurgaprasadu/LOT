"use client";

import React, { useEffect, useState } from "react";

interface HeroImage {
  url: string;
  title: string;
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

    async function fetchHeroImages(query: string) {
      try {
        const cleanQuery = query.trim();
        // 1. Get top Wikipedia articles + lead high-res images for the entity
        const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          cleanQuery
        )}&gsrlimit=4&prop=pageimages&piprop=original|thumbnail&pithumbsize=800&format=json&origin=*`;

        // 2. Also fetch high-res photography from Wikimedia Commons
        const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          cleanQuery
        )}%20filetype:bitmap&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`;

        const [wikiRes, commonsRes] = await Promise.all([
          fetch(wikiSearchUrl, {
            headers: { "Api-User-Agent": "LOT-AIOS/1.0 (contact: github.com/padaladurgaprasadu/LOT)" },
          })
            .then((r) => r.json())
            .catch(() => null),
          fetch(commonsUrl, {
            headers: { "Api-User-Agent": "LOT-AIOS/1.0 (contact: github.com/padaladurgaprasadu/LOT)" },
          })
            .then((r) => r.json())
            .catch(() => null),
        ]);

        const collected: HeroImage[] = [];
        const seenUrls = new Set<string>();

        // Extract Wikipedia lead images first (most accurate for people & places)
        const wikiPages = wikiRes?.query?.pages ? Object.values(wikiRes.query.pages) : [];
        for (const page of wikiPages as any[]) {
          const imgUrl = page?.thumbnail?.source || page?.original?.source;
          if (imgUrl && !imgUrl.endsWith(".svg") && !seenUrls.has(imgUrl)) {
            seenUrls.add(imgUrl);
            collected.push({ url: imgUrl, title: page.title });
          }
        }

        // Fill remaining slots up to 4 images from Wikimedia Commons
        const commonsPages = commonsRes?.query?.pages ? Object.values(commonsRes.query.pages) : [];
        for (const page of commonsPages as any[]) {
          const imgUrl = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url;
          if (
            imgUrl &&
            !imgUrl.endsWith(".svg") &&
            !imgUrl.endsWith(".gif") &&
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

        if (isMounted && collected.length > 0) {
          setImages(collected.slice(0, 4));
        }
      } catch (err) {
        console.error("Failed to load hero images:", err);
      }
    }

    fetchHeroImages(entity);
    return () => {
      isMounted = false;
    };
  }, [entity]);

  if (!images.length) return null;

  return (
    <>
      {/* ChatGPT-Style 4-Photo Bento Hero Grid */}
      <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-2 rounded-2xl overflow-hidden w-full max-w-3xl border border-neutral-800 bg-neutral-900/40 shadow-xl">
        {/* Main Large Left Hero Image */}
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

        {/* Right Stacked Images */}
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

      {/* Click-to-Expand Fullscreen Lightbox */}
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
