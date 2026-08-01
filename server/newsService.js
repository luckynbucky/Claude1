import Parser from "rss-parser";
import { NEWS_FEEDS } from "./newsFeeds.js";
import { filterRelevantItems } from "./relevanceFilter.js";
import { getRegulatoryNews } from "./regulatorySearch.js";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
  },
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

function dedupeSorted(items) {
  const seen = new Set();
  return items
    .slice()
    .sort((a, b) => (b._sortDate || 0) - (a._sortDate || 0))
    .filter((item) => {
      const key = item.link || item.headline;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function getNews({ force = false, feeds = NEWS_FEEDS, limit = 150 } = {}) {
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

  const dedupedRss = dedupeSorted(items).map(({ _sortDate, ...rest }) => rest);
  const relevantRss = await filterRelevantItems(dedupedRss);

  // Regulatory search has its own long-lived cache and refreshes on its own
  // schedule, independent of manual "Refresh Feed" clicks on the RSS pool,
  // since it's a much more expensive call.
  const regulatory = await getRegulatoryNews({});
  if (regulatory.error) {
    errors.push({ source: "Regulatory Search", message: regulatory.error });
  }

  const combined = dedupeSorted(
    [...relevantRss, ...regulatory.items].map((item) => ({
      ...item,
      _sortDate: item.date ? new Date(item.date).getTime() : 0,
    }))
  )
    .slice(0, limit)
    .map(({ _sortDate, ...rest }) => rest);

  cache = { items: combined, errors, fetchedAt: Date.now() };
  return cache;
}
