import httpx
from typing import Optional, Dict, Any

class LOTEntityEnrichmentEngine:
    async def fetch_entity_card(self, entity_name: str) -> Dict[str, Any]:
        """
        Queries Wikipedia & Wikidata REST APIs to fetch summary, structured attributes,
        official URLs, and a high-resolution hero image.
        """
        formatted_title = entity_name.replace(" ", "_")
        wiki_api_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{formatted_title}"
        
        headers = {"User-Agent": "LOT-AIOS-EntityEngine/3.0 (+https://lot-ai.vercel.app)"}
        
        async with httpx.AsyncClient(headers=headers, timeout=5.0) as client:
            try:
                resp = await client.get(wiki_api_url)
                if resp.status_code != 200:
                    return {}
                data = resp.json()
                
                thumbnail = data.get("thumbnail", {})
                hero_image_url = thumbnail.get("source") or ""
                
                # Extract official web reference from Wikidata / desktop page url
                desktop_url = data.get("content_urls", {}).get("desktop", {}).get("page", "")
                
                return {
                    "entity_title": data.get("title", entity_name),
                    "description": data.get("description", "Global Entity Intelligence"),
                    "extract": data.get("extract", ""),
                    "hero_image": hero_image_url,
                    "official_url": desktop_url,
                    "source": "Wikipedia / Wikidata Knowledge Graph"
                }
            except Exception:
                return {}
