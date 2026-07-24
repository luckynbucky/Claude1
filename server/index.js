import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { PHENOMENEX_CONTEXT } from "./phenomenexContext.js";
import { getNews } from "./newsService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 8787;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY in environment. Set it in .env.");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json({ limit: "1mb" }));

app.post("/api/analyze", async (req, res) => {
  const { headline, source, date, snippet } = req.body || {};

  if (!headline || typeof headline !== "string") {
    return res.status(400).json({ error: "headline is required" });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1800,
      system: PHENOMENEX_CONTEXT,
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
