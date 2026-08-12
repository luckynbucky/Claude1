import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { PHENOMENEX_CONTEXT } from "./phenomenexContext.js";
import { getNews } from "./newsService.js";
import { getRegulatoryNews } from "./regulatorySearch.js";
import { resolveProteinStructure } from "./proteinService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 8787;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY in environment. Set it in .env.");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json({ limit: "1mb" }));

// Completed analyses are memoized by headline+snippet so re-opening a card,
// duplicate items, or repeat "Analyze All" passes never re-pay for the call.
const analysisCache = new Map();
const ANALYSIS_CACHE_MAX = 500;

app.post("/api/analyze", async (req, res) => {
  const { headline, source, date, snippet } = req.body || {};

  if (!headline || typeof headline !== "string") {
    return res.status(400).json({ error: "headline is required" });
  }

  const cacheKey = `${headline}::${snippet || ""}`;
  if (analysisCache.has(cacheKey)) {
    return res.json(analysisCache.get(cacheKey));
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1800,
      // cache_control: the large product-context prompt is billed at ~10% of
      // input price on cache hits, which "Analyze All" bursts benefit from.
      system: [{ type: "text", text: PHENOMENEX_CONTEXT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Analyze this biopharma news for Phenomenex sales opportunities:\n\nHeadline: ${headline}\nSource: ${source || "Unknown"}\nDate: ${date || "Unknown"}\nDetails: ${snippet || headline}\n\nRespond ONLY with the JSON object, no other text.`,
        },
      ],
    });

    const text = message.content?.map((b) => b.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    if (analysisCache.size >= ANALYSIS_CACHE_MAX) {
      analysisCache.delete(analysisCache.keys().next().value);
    }
    analysisCache.set(cacheKey, parsed);

    res.json(parsed);
  } catch (err) {
    console.error("Analysis failed:", err.message);
    res.status(502).json({ error: "Analysis failed. Please try again." });
  }
});

app.get("/api/news", async (req, res) => {
  try {
    const force = req.query.refresh === "true";
    const result = await getNews({ force });
    res.json(result);
  } catch (err) {
    console.error("News fetch failed:", err.message);
    res.status(502).json({ error: "Couldn't load live news. Please try again.", items: [], errors: [] });
  }
});

app.get("/api/regulatory", async (req, res) => {
  try {
    const result = await getRegulatoryNews({});
    res.json(result);
  } catch (err) {
    console.error("Regulatory news failed:", err.message);
    res.status(502).json({ error: "Regulatory scan failed.", items: [] });
  }
});

app.get("/api/protein-structure", async (req, res) => {
  const name = req.query.name;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const result = await resolveProteinStructure(name);
    if (!result.found) {
      console.warn(`Protein structure not found for "${name}": ${result.reason}`);
      return res.status(404).json({ error: result.reason || `No structure found for "${name}"` });
    }
    res.json(result);
  } catch (err) {
    console.error("Protein structure lookup failed:", err.message);
    res.status(502).json({ error: "Structure lookup failed. Please try again." });
  }
});

// Serve built frontend in production
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(port, () => {
  console.log(`BioPharma Scout server listening on http://localhost:${port}`);
});
