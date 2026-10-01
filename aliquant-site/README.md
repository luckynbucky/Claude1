# Aliquant Bio — website

A single-page marketing site for Aliquant Bio. It's intentionally **plain
static HTML/CSS/JS** — no build step, no framework, no dependencies. That keeps
it free to host anywhere and trivial to edit.

```
aliquant-site/
├── index.html    # structure / copy
├── styles.css    # all styling + design tokens (top of file)
├── main.js       # config, pipeline data, posts, animations, demo form
├── favicon.svg
└── README.md
```

## Editing content

Almost everything you'll want to change lives at the top of `main.js` in the
`CONFIG`, `PIPELINE`, and `POSTS` objects:

- **`CONFIG.substackUrl`** — your Substack. Wired into every "Subscribe" link.
- **`CONFIG.modelRepoUrl` / `modelCardUrl`** — links in the Model section.
- **`CONFIG.predictEndpoint`** — leave `""` for now. When you deploy a model
  endpoint (below), paste its URL here and the "Try it" box calls it live.
- **`PIPELINE`** — your drug programs and how far each has progressed.
- **`POSTS`** — featured essays. (Can later be replaced with a live Substack
  RSS pull — see note at the bottom.)

Colours and fonts are design tokens at the top of `styles.css` (`:root`).
Change `--accent` / `--accent-2` to re-theme the whole site.

## Running locally

No build needed. Any static server works:

```bash
cd aliquant-site
python3 -m http.server 8000   # then open http://localhost:8000
```

## Hosting — recommendation

You said: cost-conscious, already on Render, have AWS, want flexibility and
room to add lightweight programs (maybe LLM endpoints) later. Here's how I'd
split it:

### 1. The website itself → **Cloudflare Pages** (or Render Static Site)

This site is pure static files, so hosting it should be **free**.

- **Cloudflare Pages** — my top pick. Unlimited bandwidth on the free plan,
  global CDN, free SSL, connects to your GitHub repo and auto-deploys on push.
  Point the build output at this folder (no build command needed).
- **Render Static Site** — since you're already there, this is the zero-new-
  accounts option. Also free, with a global CDN and auto-SSL. Note Render
  trimmed included bandwidth in 2026 (5 GB/mo on the free Hobby workspace), so
  for a public marketing site Cloudflare's unlimited free bandwidth is the
  safer long-term choice.

> On Render, create a **Static Site** (not a Web Service). Set the publish
> directory to `aliquant-site` and leave the build command empty.

### 2. Lightweight programs + LLM endpoints → start serverless, scale to a box

You want somewhere to run small backends later without paying for an idle
server. Best path for "cheap now, flexible later":

- **Cloudflare Workers** — free tier is 100,000 requests/day; the paid plan is
  **$5/mo** including 10M requests. Workers are perfect for small JSON APIs and
  proxying LLM calls (keeps your API key server-side). If the site is already
  on Cloudflare Pages, Workers slot in with almost no extra setup.
- **Render Web Service** — when a program needs a long-running process, a real
  filesystem, or a Python/Node server (e.g. an RDKit-based property model), a
  Render Web Service at **$7/mo** (512 MB RAM, no cold starts) is the simplest
  always-on option. The free Web Service tier works too but sleeps after 15 min
  idle and takes ~30–50s to wake — fine for a demo, not for anything latency-
  sensitive.
- **AWS** — keep it in your back pocket for when you outgrow the above:
  **Lambda + API Gateway** for serverless (generous free tier, pay-per-request),
  or a small **EC2 / Lightsail** box if you need a GPU or persistent compute for
  the ML model. More control, more knobs — worth it once usage justifies it,
  not before.

**Suggested starting stack (cheapest that stays flexible):**

| Piece                       | Host                         | Cost        |
|-----------------------------|------------------------------|-------------|
| Website (this folder)       | Cloudflare Pages             | Free        |
| Small APIs / LLM proxy      | Cloudflare Workers           | Free → $5/mo|
| Heavier Python/ML service   | Render Web Service           | $7/mo       |
| Future GPU / heavy compute  | AWS Lightsail or EC2         | Pay-as-grow |

This keeps you at **$0 until you actually ship a backend**, then a few dollars
a month, with AWS waiting for when the model needs real horsepower.

> One good rule for LLM endpoints: never put your API key in `main.js` (it ships
> to every visitor's browser). Call a Worker / small server you control, and
> keep the key in that server's environment variables.

## Connecting the custom domain (`aliquant.bio`)

Wherever you host the static site, you'll add `aliquant.bio` as a custom domain
in that host's dashboard and update DNS. If you move DNS to Cloudflare you also
get their CDN, analytics, and DDoS protection for free — a nice bonus even if
you host the static files on Render.

## Later: live Substack posts

The `POSTS` array is hardcoded for now. Substack publishes an RSS feed at
`https://YOUR-HANDLE.substack.com/feed`. A tiny Worker can fetch and cache that
feed and return JSON, which `main.js` can render instead of the static list —
browsers can't fetch the feed directly because of CORS, which is exactly the
kind of job a small Worker is good for.
