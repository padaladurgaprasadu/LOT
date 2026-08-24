const https = require('https');

async function searchWeb(query) {
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = await res.text();
    const snippets = [];
    const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = regex.exec(html)) !== null && snippets.length < 6) {
      const text = match[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
      if (text && text.length > 20) {
        snippets.push(text);
      }
    }
    return snippets;
  } catch (err) {
    console.error('Search error:', err);
    return [];
  }
}

(async () => {
  const results = await searchWeb('Irumudi movie 2026 Shiva Nirvana Ravi Teja');
  console.log('Results count:', results.length);
  console.log(results.join('\n\n'));
})();
