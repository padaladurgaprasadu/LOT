/**
 * LOT AI Real-Time Web Search & Grounding Engine
 * Multi-source live search across DuckDuckGo and Wikipedia with zero latency overhead.
 */

export function requiresWebSearch(query: string): boolean {
  const lower = query.toLowerCase().trim();

  // Skip pure greetings
  if (/^(hello|hi|hey|good\s+morning|who\s+are\s+you|thanks|thank\s+you)[\s!?.]*$/i.test(lower)) return false;

  // Skip pure code-writing requests (model knows these from training)
  if (/^(write\s+a\s+(function|class|script|program)|implement\s+a\s+binary\s+tree|regex\s+for|sql\s+query\s+to|create\s+a\s+react\s+component)\b/i.test(lower)) return false;

  // Skip standard CS/AI/Science/Programming concept definitions — model already knows these perfectly.
  // Web search for these returns irrelevant dictionary results (ragtime music, fashion, etc.)
  const conceptSkipPatterns = [
    // "What is X" / "Explain X" / "Define X" for well-known tech concepts
    /^(what\s+is|what\s+are|explain|define|describe|tell\s+me\s+about|how\s+does)\s+(rag|retrieval.augmented.generation|docker|kubernetes|k8s|react|nextjs|next\.js|typescript|javascript|python|java|golang|rust|c\+\+|css|html|sql|nosql|mongodb|postgresql|redis|graphql|rest\s*api|microservices|monolith|serverless|lambda|devops|ci\s*\/?\s*cd|git|github|jwt|oauth|api|sdk|cli|orm|mvc|mvvm|crud|ssr|ssg|isr|seo|dns|tcp|udp|http|https|websocket|grpc|protobuf|webpack|vite|babel|eslint|prettier|npm|yarn|pnpm|pip|conda|virtual\s*env|machine\s*learning|deep\s*learning|neural\s*network|transformer|attention\s*mechanism|llm|large\s*language\s*model|gpt|bert|embedding|vector\s*database|langchain|langgraph|supabase|firebase|aws|azure|gcp|terraform|ansible|nginx|apache|linux|unix|bash|shell|powershell|algorithm|data\s*structure|array|linked\s*list|hash\s*map|hash\s*table|binary\s*tree|graph|stack|queue|heap|sorting|searching|dynamic\s*programming|recursion|iteration|loop|function|class|object|inheritance|polymorphism|encapsulation|abstraction|design\s*pattern|singleton|factory|observer|decorator|adapter|promise|async|await|callback|closure|hoisting|scope|prototype|interface|generic|type|enum|struct|pointer|memory|garbage\s*collection|thread|process|concurrency|parallelism|deadlock|mutex|semaphore|socket|port|container|image|volume|network|load\s*balancer|reverse\s*proxy|cache|cdn|ssl|tls|encryption|hashing|bcrypt|sha|aes|rsa|cors|csrf|xss|injection|authentication|authorization|middleware|router|controller|model|view|template|component|hook|state|prop|context|redux|zustand|tailwind|bootstrap|sass|less|flexbox|grid|responsive|mobile\s*first|pwa|spa|mpa|jamstack|headless\s*cms|webhook|cron|daemon|systemd|docker\s*compose|swarm|pod|node|cluster|deployment|service|ingress|configmap|secret|namespace|helm|istio|envoy|kafka|rabbitmq|celery|airflow|spark|hadoop|etl|data\s*pipeline|data\s*lake|data\s*warehouse|olap|oltp|index|join|query|transaction|acid|base|cap\s*theorem|sharding|replication|backup|migration|schema|normalization|denormalization|stored\s*procedure|trigger|view|materialized\s*view|cte|window\s*function|subquery|union|intersect|except|group\s*by|having|order\s*by|limit|offset|pagination|cursor|batch|streaming|event\s*driven|pub\s*sub|message\s*queue|rpc|soap|wsdl|xml|json|yaml|toml|csv|parquet|avro|protobuf|thrift|openapi|swagger|postman|curl|fetch|axios|request|response|header|body|status\s*code|method|endpoint|route|path|parameter|query\s*string|fragment|url|uri|urn|ip\s*address|subnet|cidr|nat|firewall|vpn|proxy|gateway|bridge|switch|router|osi\s*model|tcp\s*ip|arp|icmp|dhcp|ftp|sftp|ssh|telnet|smtp|imap|pop3|http2|http3|quic|webrtc|websocket|sse|long\s*polling|short\s*polling|comet|ajax|xmlhttprequest|fetch\s*api|service\s*worker|web\s*worker|shared\s*worker|indexeddb|localstorage|sessionstorage|cookie|token|session|jwt|jwe|jws|jwk|pkce|saml|ldap|sso|mfa|2fa|totp|hotp|biometric|fingerprint|face\s*recognition|ocr|nlp|ner|sentiment\s*analysis|text\s*classification|tokenization|stemming|lemmatization|word2vec|glove|fasttext|elmo|cnn|rnn|lstm|gru|gan|vae|autoencoder|diffusion|stable\s*diffusion|dall-e|midjourney|clip|sam|yolo|resnet|vgg|alexnet|inception|mobilenet|efficientnet|unet|segmentation|detection|classification|regression|clustering|recommendation|reinforcement\s*learning|q-learning|policy\s*gradient|actor\s*critic|mcts|minimax|alpha-beta|a-star|dijkstra|bellman-ford|floyd-warshall|kruskal|prim|topological\s*sort|bfs|dfs|backtracking|greedy|divide\s*and\s*conquer|branch\s*and\s*bound|memoization|tabulation|sliding\s*window|two\s*pointer|fast\s*slow\s*pointer|merge\s*sort|quick\s*sort|heap\s*sort|radix\s*sort|counting\s*sort|bucket\s*sort|insertion\s*sort|selection\s*sort|bubble\s*sort|binary\s*search|linear\s*search|interpolation\s*search|exponential\s*search|jump\s*search|trie|suffix\s*tree|suffix\s*array|segment\s*tree|fenwick\s*tree|avl\s*tree|red-black\s*tree|b-tree|b\+\s*tree|skip\s*list|bloom\s*filter|count-min\s*sketch|hyperloglog|consistent\s*hashing|virtual\s*dom|fiber|reconciliation|hydration|lazy\s*loading|code\s*splitting|tree\s*shaking|minification|uglification|obfuscation|source\s*map|hot\s*module\s*replacement|hmr|fast\s*refresh|live\s*reload|watch\s*mode|debug|breakpoint|stack\s*trace|profiling|benchmarking|load\s*testing|stress\s*testing|unit\s*test|integration\s*test|e2e\s*test|smoke\s*test|regression\s*test|snapshot\s*test|mock|stub|spy|fixture|factory|faker|jest|mocha|chai|jasmine|cypress|playwright|selenium|puppeteer|pytest|unittest|rspec|junit|testng|nunit|xunit)\b/i,
    // General programming explanation patterns
    /^(how\s+to|what\s+is\s+the\s+difference\s+between|compare|difference\s+between|pros\s+and\s+cons\s+of|advantages\s+of|disadvantages\s+of|benefits\s+of|when\s+to\s+use|why\s+use)\s+.*(programming|coding|software|framework|library|package|module|language|paradigm|pattern|architecture|stack|protocol|standard|specification|format|encoding|algorithm|data\s*structure)/i,
    // Direct concept names without question words
    /^(loops?\s+in|variables?\s+in|functions?\s+in|classes?\s+in|arrays?\s+in|strings?\s+in|objects?\s+in|types?\s+in|modules?\s+in|packages?\s+in|imports?\s+in|exports?\s+in|operators?\s+in|expressions?\s+in|statements?\s+in|conditionals?\s+in|exceptions?\s+in|errors?\s+in|debugging\s+in|testing\s+in)\s+(python|javascript|typescript|java|c\+\+|c#|go|rust|ruby|php|swift|kotlin|scala|perl|r|matlab|julia|dart|lua|haskell|elixir|clojure|f#|ocaml|zig|nim|crystal|v|odin)\b/i,
  ];

  for (const pattern of conceptSkipPatterns) {
    if (pattern.test(lower)) return false;
  }

  // ALWAYS search for everything else — knowledge, news, current leaders, places, people, dates, etc.
  return true;
}

async function searchDuckDuckGo(query: string, signal: AbortSignal): Promise<string[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal,
    });

    if (!res.ok) return [];
    const html = await res.text();

    const snippets: string[] = [];
    const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null && snippets.length < 10) {
      const text = match[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();

      if (text && text.length > 20 && !text.includes("JavaScript is not enabled")) {
        snippets.push(text);
      }
    }
    return snippets;
  } catch {
    return [];
  }
}

async function searchWikipedia(query: string, signal: AbortSignal): Promise<string[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1&srlimit=4`;
    const res = await fetch(url, {
      headers: { "User-Agent": "LOT-Sovereign-Agent/1.0" },
      signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.query?.search || [];
    return items.map((item: { title: string; snippet: string }) => {
      const cleanSnippet = item.snippet.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      return `${item.title}: ${cleanSnippet}`;
    });
  } catch {
    return [];
  }
}

export async function performLiveWebSearch(query: string): Promise<string | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const [ddgResults, wikiResults] = await Promise.all([
      searchDuckDuckGo(cleanQuery, controller.signal),
      searchWikipedia(cleanQuery, controller.signal),
    ]);

    clearTimeout(timeout);

    const combined = [...ddgResults, ...wikiResults];
    if (combined.length > 0) {
      return `[VERIFIED REAL-TIME LIVE WEB RESULTS FOR: "${cleanQuery}"]:\n${combined.slice(0, 10).map((s, i) => `[Source ${i + 1}]: ${s}`).join("\n")}`;
    }

    return null;
  } catch {
    return null;
  }
}
