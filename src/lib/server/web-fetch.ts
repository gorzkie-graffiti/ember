import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";

export interface FetchedPage {
  url: string;
  title: string;
  content: string;
  byline?: string;
  textContentLength: number;
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

function truncateContent(content: string, maxChars = 16_000): string {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars)}\n\n[…Content truncated at ${maxChars} characters…]`;
}

/**
 * Strategy 1: Jina AI Reader (https://r.jina.ai/<url>)
 * Returns clean markdown directly and handles WAFs/Cloudflare reliably.
 */
async function fetchWithJinaReader(targetUrl: string): Promise<FetchedPage> {
  const userAgent = getRandomUserAgent();
  const jinaUrl = `https://r.jina.ai/${targetUrl}`;

  const response = await fetch(jinaUrl, {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/plain, text/markdown, */*",
      "X-No-Cache": "true",
      "X-With-Generated-Alt": "true",
      ...(process.env.JINA_API_KEY ? { Authorization: `Bearer ${process.env.JINA_API_KEY}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Jina Reader returned status ${response.status}`);
  }

  const rawText = await response.text();
  if (!rawText || rawText.trim().length === 0) {
    throw new Error("Jina Reader returned empty content");
  }

  let title = targetUrl;
  const titleMatch = rawText.match(/^Title:\s*(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  const cleanContent = truncateContent(rawText);

  return {
    url: targetUrl,
    title,
    content: cleanContent,
    textContentLength: cleanContent.length,
    source: "Jina Reader",
  };
}

/**
 * Strategy 2: Direct HTTP Stealth Fetch with Mozilla Readability parsing.
 */
async function fetchWithHttpReadability(targetUrl: string): Promise<FetchedPage> {
  const userAgent = getRandomUserAgent();

  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "max-age=0",
      "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Direct HTTP fetch returned status ${response.status}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url: targetUrl });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (article && article.textContent && article.textContent.trim().length > 100) {
    const cleanContent = truncateContent(article.textContent.trim());
    return {
      url: targetUrl,
      title: article.title || dom.window.document.title || targetUrl,
      byline: article.byline || undefined,
      content: cleanContent,
      textContentLength: cleanContent.length,
      source: "Mozilla Readability",
    };
  }

  const $ = cheerio.load(html);
  $("script, style, noscript, nav, header, footer, svg, iframe").remove();

  const title = $("title").text().trim() || targetUrl;
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  if (!bodyText || bodyText.length < 50) {
    throw new Error("Direct HTTP extraction yielded insufficient content");
  }

  const cleanContent = truncateContent(bodyText);

  return {
    url: targetUrl,
    title,
    content: cleanContent,
    textContentLength: cleanContent.length,
    source: "HTML Parser",
  };
}

/**
 * Strategy 3: Playwright Stealth Browser Automation (optional fallback if playwright is installed)
 */
async function fetchWithPlaywrightStealth(targetUrl: string): Promise<FetchedPage> {
  try {
    const dynamicReq = eval("require");
    const playwright = dynamicReq("playwright");
    const browser = await playwright.chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const context = await browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForTimeout(1_000);

    const html = await page.content();
    const title = await page.title();
    await browser.close();

    const dom = new JSDOM(html, { url: targetUrl });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    let content = article?.textContent?.trim() || "";
    if (!content) {
      const $ = cheerio.load(html);
      $("script, style, noscript, nav, header, footer, svg, iframe").remove();
      content = $("body").text().replace(/\s+/g, " ").trim();
    }

    if (!content || content.length < 50) {
      throw new Error("Playwright fetch yielded empty content");
    }

    const cleanContent = truncateContent(content);

    return {
      url: targetUrl,
      title: article?.title || title || targetUrl,
      content: cleanContent,
      textContentLength: cleanContent.length,
      source: "Playwright Stealth",
    };
  } catch (err) {
    throw new Error(`Playwright stealth fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Perform a web page fetch using free stealth strategies with automatic fallback.
 */
export async function performWebFetch(targetUrl: string): Promise<FetchedPage> {
  let url = targetUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  const errors: string[] = [];

  // 1. Try Jina Reader (Most reliable stealth & markdown extraction)
  try {
    const page = await fetchWithJinaReader(url);
    if (page.content.trim().length > 50) return page;
  } catch (err) {
    errors.push(`Jina Reader: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Try Direct HTTP + Readability
  try {
    const page = await fetchWithHttpReadability(url);
    if (page.content.trim().length > 50) return page;
  } catch (err) {
    errors.push(`Direct HTTP: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Try Playwright Stealth if available
  try {
    const page = await fetchWithPlaywrightStealth(url);
    if (page.content.trim().length > 50) return page;
  } catch (err) {
    errors.push(`Playwright: ${err instanceof Error ? err.message : String(err)}`);
  }

  throw new Error(`Failed to fetch content from ${url}. Errors: ${errors.join(" | ")}`);
}
