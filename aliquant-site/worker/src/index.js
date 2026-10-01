// Aliquant Bio — Substack feed Worker
// -----------------------------------
// Fetches your Substack RSS feed, converts it to clean JSON, caches it at the
// edge, and serves it with permissive CORS so the static site can fetch it
// directly from the browser (which can't read the RSS feed itself, due to CORS).
//
// Config (wrangler.toml [vars]):
//   SUBSTACK_URL   e.g. "https://yourhandle.substack.com"
//   ALLOWED_ORIGIN e.g. "https://aliquant.bio"  ("*" to allow any origin)
//   MAX_POSTS      number of posts to return (default 6)

const EDGE_TTL_SECONDS = 1800; // 30 min — how long the edge caches a response

export default {
  async fetch(request, env, ctx) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/api/posts") {
      return json({ error: "Not found" }, 404, cors);
    }
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    const base = (env.SUBSTACK_URL || "").replace(/\/+$/, "");
    if (!base) {
      return json({ error: "SUBSTACK_URL is not configured" }, 500, cors);
    }

    // Serve from the edge cache when we can.
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const max = clampInt(env.MAX_POSTS, 6, 1, 30);

    let posts;
    try {
      const res = await fetch(`${base}/feed`, {
        headers: { "User-Agent": "AliquantBioWorker/1.0 (+https://aliquant.bio)" },
        cf: { cacheTtl: EDGE_TTL_SECONDS, cacheEverything: true },
      });
      if (!res.ok) throw new Error(`Substack responded ${res.status}`);
      posts = parseFeed(await res.text()).slice(0, max);
    } catch (err) {
      // Don't cache failures — let the next request retry.
      return json({ error: "Could not load feed", detail: String(err.message || err) }, 502, cors);
    }

    const response = json({ posts, fetchedAt: new Date().toISOString() }, 200, {
      ...cors,
      "Cache-Control": `public, max-age=${EDGE_TTL_SECONDS}`,
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};

// --- helpers ---------------------------------------------------------------

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function clampInt(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Minimal, dependency-free RSS parse. Substack's feed is predictable XML, so we
// pull <item> blocks and read the fields we need from each.
function parseFeed(xml) {
  const items = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = field(block, "title");
    const link = field(block, "link");
    if (!title) continue;
    const pubDate = field(block, "pubDate");
    const raw = field(block, "content:encoded") || field(block, "description");
    items.push({
      title,
      link,
      date: formatDate(pubDate),
      blurb: truncate(stripHtml(raw), 160),
    });
  }
  return items;
}

// Read one tag's text, handling <![CDATA[...]]> and plain text.
function field(block, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(block);
  if (!m) return "";
  let v = m[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(v);
  if (cdata) v = cdata[1];
  return decodeEntities(v.trim());
}

function stripHtml(s) {
  return (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1") // no space before punctuation after tag removal
    .trim();
}

function truncate(s, max) {
  if (!s || s.length <= max) return s || "";
  return s.slice(0, max - 1).replace(/\s+\S*$/, "").trim() + "…";
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d));
}

// -> "YYYY-MM" to match the site's post cards.
function formatDate(pubDate) {
  if (!pubDate) return "";
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
