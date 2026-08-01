import Anthropic from "@anthropic-ai/sdk";

const RELEVANCE_SYSTEM = `You are a filter for a biopharma sales intelligence tool used by a sales manager at Phenomenex, a chromatography and analytical instruments company serving biopharma R&D and manufacturing.

Given a numbered list of news headlines with short snippets, identify which ones are relevant to biopharma company or drug business news: funding rounds, clinical trial results, FDA approvals or filings, M&A deals, manufacturing expansions, drug or biologic development, or scientific/therapeutic milestones tied to a specific company or drug program.

NOT relevant: general health policy or political commentary (e.g. statements by government officials), opinion pieces, unrelated health/wellness/consumer topics, or stories not tied to a specific company's drug/biologic program or business event.

Respond ONLY with a JSON array of the numbers of the RELEVANT items, e.g. [1,3,4,7]. If none are relevant, respond with [].`;

export async function filterRelevantItems(items, opts = {}) {
  if (items.length === 0) return items;

  const anthropic = opts.client || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = opts.model || "claude-haiku-4-5-20251001";

  const list = items.map((item, i) => `${i + 1}. ${item.headline} — ${item.snippet}`).join("\n");

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      system: RELEVANCE_SYSTEM,
      messages: [{ role: "user", content: `Headlines:\n${list}\n\nRespond ONLY with the JSON array of relevant item numbers.` }],
    });

    const text = message.content?.map((b) => b.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const relevantNumbers = new Set(JSON.parse(clean));

    return items.filter((_, i) => relevantNumbers.has(i + 1));
  } catch (err) {
    console.error("Relevance filter failed, showing items unfiltered:", err.message);
    return items;
  }
}
