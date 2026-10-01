# Aliquant posts Worker

A tiny Cloudflare Worker that fetches your Substack RSS feed, converts it to
clean JSON, caches it at the edge for 30 minutes, and serves it with CORS so
the website can load your latest posts live. (Browsers can't fetch the Substack
feed directly because of CORS — this Worker is the piece that makes it possible.)

**Endpoint:** `GET /api/posts` →
```json
{ "posts": [ { "title": "...", "link": "...", "date": "2026-09", "blurb": "..." } ],
  "fetchedAt": "2026-10-01T12:00:00.000Z" }
```

## One-time setup

1. Install the Cloudflare CLI and sign in (free Cloudflare account):
   ```bash
   npm install          # installs wrangler locally
   npx wrangler login   # opens a browser to authorise
   ```
2. Open `wrangler.toml` and set **`SUBSTACK_URL`** to your Substack
   (e.g. `https://aliquant.substack.com`, no trailing slash).

## Run locally

```bash
npm run dev            # serves http://localhost:8787/api/posts
```
Open <http://localhost:8787/api/posts> — you should see your posts as JSON.

## Deploy (free)

```bash
npm run deploy
```
Wrangler prints a URL like
`https://aliquant-posts.YOUR-SUBDOMAIN.workers.dev`.

Then, in the site's **`main.js`**, set:
```js
postsEndpoint: "https://aliquant-posts.YOUR-SUBDOMAIN.workers.dev/api/posts",
```
Redeploy the site and the Writing section loads live posts, falling back to the
hardcoded list if the Worker is ever unreachable.

## Hardening for production

- In `wrangler.toml`, change **`ALLOWED_ORIGIN`** from `"*"` to your real domain
  (`https://aliquant.bio`) so only your site can call the Worker.
- Once `aliquant.bio`'s DNS is on Cloudflare, you can serve the Worker from a
  tidy custom route like `api.aliquant.bio` — uncomment the `[[routes]]` block
  in `wrangler.toml` and set `postsEndpoint` to
  `https://api.aliquant.bio/api/posts`.

## Cost

Comfortably inside the Workers free tier (100,000 requests/day). Because
responses are edge-cached for 30 minutes, most visitors never trigger a fresh
Substack fetch at all.

## Notes

The RSS parser here is deliberately small and dependency-free. Substack's feed
format is stable, but if a field ever looks off, the parsing lives in
`src/index.js` (`parseFeed` / `field`) and is easy to adjust.
