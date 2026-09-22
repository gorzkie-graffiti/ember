import * as cheerio from "cheerio";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function decodeBingUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl);
    const u = parsed.searchParams.get("u");
    if (u && u.startsWith("a1")) {
      const b64 = u.slice(2).replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
      return Buffer.from(b64 + pad, "base64").toString("utf-8");
    }
  } catch {
    // Ignore URL parsing errors
  }
  return rawUrl;
}

/**
 * Strategy 1: Bing Stealth HTML Search (Free, reliable, no API key required).
 */
async function searchBingStealth(query: string, limit: number): Promise<SearchResult[]> {
  const userAgent = getRandomUserAgent();
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Bing search returned HTTP status ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results: SearchResult[] = [];

  $("li.b_algo").each((_, element) => {
    if (results.length >= limit) return false;

    const titleAnchor = $(element).find("h2 a");
    const title = titleAnchor.text().trim();
    const rawHref = titleAnchor.attr("href") || "";
    const url = decodeBingUrl(rawHref);

    // Extract snippet text
    const snippetEl = $(element).find(".b_caption p, .b_algoSubExtra, p");
    let snippet = snippetEl.text().trim();
    if (!snippet) {
      snippet = $(element).text().trim();
    }
    // Clean snippet
    snippet = snippet.replace(/\s+/g, " ").slice(0, 350);

    if (title && url && url.startsWith("http")) {
      results.push({
        title,
        url,
        snippet,
        source: "Bing Web",
      });
    }
  });

  return results;
}

/**
 * Strategy 2: Wikipedia API Search (Free, structured, fast).
 */
async function searchWikipedia(query: string, limit: number): Promise<SearchResult[]> {
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
  const response = await fetch(apiUrl, {
    headers: {
      "User-Agent": getRandomUserAgent(),
    },
  });

  if (!response.ok) {
    throw new Error(`Wikipedia search returned HTTP status ${response.status}`);
  }

  const json = await response.json();
  const results: SearchResult[] = [];

  if (json.query?.search && Array.isArray(json.query.search)) {
    for (const item of json.query.search) {
      if (results.length >= limit) break;
      const title = item.title;
      const snippet = (item.snippet || "").replace(/<[^>]+>/g, "").trim();
      results.push({
        title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        snippet,
        source: "Wikipedia",
      });
    }
  }

  return results;
}

/**
 * Strategy 3: DuckDuckGo Instant Answer API.
 */
async function searchDuckDuckGoApi(query: string, limit: number): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": getRandomUserAgent(),
    },
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo API returned HTTP status ${response.status}`);
  }

  const json = await response.json();
  const results: SearchResult[] = [];

  if (json.AbstractText && json.AbstractURL) {
    results.push({
      title: json.Heading || query,
      url: json.AbstractURL,
      snippet: json.AbstractText,
      source: "DuckDuckGo API",
    });
  }

  if (json.RelatedTopics && Array.isArray(json.RelatedTopics)) {
    for (const topic of json.RelatedTopics) {
      if (results.length >= limit) break;
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(" - ")[0] || topic.Text.slice(0, 50),
          url: topic.FirstURL,
          snippet: topic.Text,
          source: "DuckDuckGo API",
        });
      }
    }
  }

  return results;
}

/**
 * Strategy 4: Optional Brave Search API (if key is present in env).
 */
async function searchBrave(query: string, limit: number): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY is not configured");

  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Brave Search API returned HTTP status ${response.status}`);
  }

  const json = await response.json();
  const results: SearchResult[] = [];

  if (json.web?.results && Array.isArray(json.web.results)) {
    for (const item of json.web.results) {
      if (results.length >= limit) break;
      results.push({
        title: item.title,
        url: item.url,
        snippet: item.description || "",
        source: "Brave Search",
      });
    }
  }

  return results;
}

/**
 * Strategy 5: Optional Jina AI Search API (if key is present in env).
 */
async function searchJina(query: string, limit: number): Promise<SearchResult[]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) throw new Error("JINA_API_KEY is not configured");

  const url = `https://s.jina.ai/${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Jina Search returned HTTP status ${response.status}`);
  }

  const json = await response.json();
  const results: SearchResult[] = [];

  if (Array.isArray(json.data)) {
    for (const item of json.data) {
      if (results.length >= limit) break;
      if (item.title && item.url) {
        results.push({
          title: item.title,
          url: item.url,
          snippet: item.description || item.content?.slice(0, 300) || "",
          source: "Jina Search",
        });
      }
    }
  }

  return results;
}

/**
 * Perform a web search using free stealth strategies with automatic fallback.
 */
export async function performWebSearch(query: string, limit = 6): Promise<SearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const errors: string[] = [];

  // 1. Try Brave Search API if configured
  if (process.env.BRAVE_SEARCH_API_KEY) {
    try {
      const results = await searchBrave(cleanQuery, limit);
      if (results.length > 0) return results;
    } catch (err) {
      errors.push(`Brave: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Try Jina AI Search if key is configured
  if (process.env.JINA_API_KEY) {
    try {
      const results = await searchJina(cleanQuery, limit);
      if (results.length > 0) return results;
    } catch (err) {
      errors.push(`Jina: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 3. Try Bing Stealth HTML Search (Primary Free Engine)
  try {
    const results = await searchBingStealth(cleanQuery, limit);
    if (results.length > 0) return results;
  } catch (err) {
    errors.push(`Bing Stealth: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. Try Wikipedia Search
  try {
    const results = await searchWikipedia(cleanQuery, limit);
    if (results.length > 0) return results;
  } catch (err) {
    errors.push(`Wikipedia: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 5. Try DuckDuckGo Instant Answer API
  try {
    const results = await searchDuckDuckGoApi(cleanQuery, limit);
    if (results.length > 0) return results;
  } catch (err) {
    errors.push(`DuckDuckGo API: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (errors.length > 0) {
    console.warn("[Web Search] Backends status log:", errors.join(" | "));
  }

  return [];
}
