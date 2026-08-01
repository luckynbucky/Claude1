import Anthropic from "@anthropic-ai/sdk";

const REGULATORY_SYSTEM = `You are a research assistant for a biopharma sales intelligence tool used by a sales manager at Phenomenex, a chromatography and analytical instruments company serving biopharma R&D and manufacturing.

Search the web for genuinely recent (last 7-10 days) news of: FDA drug/biologic approvals, NDA/BLA submissions or acceptances, major clinical trial readouts, and significant regulatory milestones. Prioritize stories relevant to modalities Phenomenex serves: monoclonal antibodies, biosimilars, ADCs, oligonucleotides (siRNA/ASO/mRNA), gene therapy, cell therapy, peptide therapeutics, and small molecule drugs.

Only include real events you found via search, with a real source URL. Do not invent or guess at events.

Respond ONLY with a JSON array (no markdown, no backticks) of up to 10 items using this exact schema:
[
  {
    "headline": "Concise headline of the event",
    "company": "Company name",
    "date": "YYYY-MM-DD",
    "snippet": "1-2 sentence summary of what happened",
    "link": "source URL",
    "source": "Publication or site name"
  }
]
If you find nothing genuinely recent and relevant, respond with [].`;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cache = { items: [], error: null, fetchedAt: 0 };

export async function getRegulatoryNews({ force = false, client, model = "claude-sonnet-5" } = {}) {
  const isFresh = Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (!force && isFresh) {
    return cache;
  }

  const anthropic = client || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: REGULATORY_SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      messages: [{ role: "user", content: "Find recent FDA approvals, filings, and major trial milestones as described. Respond with the JSON array only, as your final message." }],
    });

    if (message.stop_reason === "max_tokens") {
      throw new Error("Response was truncated before completing (ran out of token budget)");
    }

    const textBlocks = message.content.filter((b) => b.type === "text").map((b) => b.text);
    const text = textBlocks.join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const jsonMatch = clean.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("No JSON array found in response");
    }
    const parsed = JSON.parse(jsonMatch[0]);

    const items = parsed.map((item, i) => ({
      id: item.link || `regulatory-${Date.now()}-${i}`,
      headline: item.headline || "(untitled)",
      source: item.source || "Regulatory Search",
      date: item.date || null,
      snippet: item.snippet || "",
      link: item.link || null,
    }));

    cache = { items, error: null, fetchedAt: Date.now() };
    return cache;
  } catch (err) {
    console.error("Regulatory search failed:", err.message);
    // Don't advance cache.fetchedAt on failure, so the next call retries
    // instead of being stuck showing a stale error for a full TTL window.
    return { items: cache.items, error: err.message, fetchedAt: cache.fetchedAt };
  }
}
