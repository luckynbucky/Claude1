import Parser from "rss-parser";
import { NEWS_FEEDS } from "./newsFeeds.js";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; BioPharmaScout/1.0)" },
});

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache = { items: [], errors: [], fetchedAt: 0 };

function truncate(text, max) {
  if (!text) return "";
  const clean = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1).trim() + "…" : clean;
}

async function fetchFeed(feed) {
  const parsed = await parser.parseURL(feed.url);
  return (parsed.items || []).map((item) => {
    const date = item.isoDate || item.pubDate || null;
    return {
      id: item.link || `${feed.source}-${item.title}`,
      headline: item.title || "(untitled)",
      source: feed.source,
      date: date ? new Date(date).toISOString().split("T")[0] : null,
      snippet: truncate(item.contentSnippet || item.content || item.summary, 400),
      link: item.link || null,
      _sortDate: date ? new Date(date).getTime() : 0,
    };
  });
}

export async function getNews({ force = false, feeds = NEWS_FEEDS, limit = 30 } = {}) {
  const isFresh = Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (!force && isFresh && cache.items.length > 0) {
    return cache;
  }

  const results = await Promise.allSettled(feeds.map(fetchFeed));

  const items = [];
  const errors = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      errors.push({ source: feeds[i].source, message: result.reason?.message || "fetch failed" });
    }
  });

  const seen = new Set();
  const deduped = items
    .sort((a, b) => b._sortDate - a._sortDate)
    .filter((item) => {
      const key = item.link || item.headline;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map(({ _sortDate, ...rest }) => rest);

  cache = { items: deduped, errors, fetchedAt: Date.now() };
  return cache;
}
