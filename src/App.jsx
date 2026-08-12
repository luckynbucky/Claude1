import { useState, useEffect, useCallback, Suspense, lazy } from "react";

const ProteinViewer = lazy(() => import("./ProteinViewer.jsx"));

const PAGE_SIZE = 15;

function LoadingDots() {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "8px 0" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#e8927c",
          animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100% { opacity:.3; transform:scale(.8) } 50% { opacity:1; transform:scale(1.1) } }`}</style>
    </div>
  );
}

function UrgencyBadge({ level }) {
  const colors = {
    high: { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" },
    medium: { bg: "#fef3c7", text: "#d97706", border: "#fcd34d" },
    low: { bg: "#d1fae5", text: "#059669", border: "#6ee7b7" }
  };
  const c = colors[level] || colors.medium;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
      textTransform: "uppercase", padding: "3px 10px", borderRadius: 99,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      fontFamily: "'DM Mono', monospace"
    }}>{level}</span>
  );
}

function ScoreRing({ score }) {
  const r = 28, c = 2 * Math.PI * r;
  const pct = score / 10;
  const color = score >= 8 ? "#dc2626" : score >= 5 ? "#d97706" : "#059669";
  return (
    <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#1a1a2e" strokeWidth="5" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center"
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'Space Grotesk', sans-serif" }}>{score}</span>
        <span style={{ fontSize: 8, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>score</span>
      </div>
    </div>
  );
}

function NewsCard({ item, onAnalyze, analysis, loading }) {
  const [expanded, setExpanded] = useState(false);

  const sourceColors = {
    "FierceBiotech": "#7c3aed",
    "BioPharma Dive": "#0891b2",
    "Endpoints News": "#dc2626",
    "Reuters": "#ea580c",
    "STAT News": "#2563eb",
    "Contract Pharma": "#059669"
  };

  return (
    <div style={{
      background: "#0f0f1e",
      border: "1px solid #1e293b",
      borderRadius: 16,
      overflow: "hidden",
      transition: "all 0.3s ease",
      boxShadow: expanded ? "0 0 40px rgba(232,146,124,0.08)" : "none"
    }}>
      <div style={{ padding: "24px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                background: (sourceColors[item.source] || "#6366f1") + "22",
                color: sourceColors[item.source] || "#6366f1",
                fontFamily: "'DM Mono', monospace",
                letterSpacing: "0.03em"
              }}>{item.source}</span>
              <span style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono', monospace" }}>{item.date}</span>
            </div>
            <h3 style={{
              fontSize: 17, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.4,
              fontFamily: "'Space Grotesk', sans-serif", margin: 0
            }}>{item.headline}</h3>
          </div>
          {analysis && <ScoreRing score={analysis.opportunity_score} />}
        </div>
        <p style={{
          fontSize: 14, color: "#94a3b8", lineHeight: 1.6, margin: "12px 0 16px",
          fontFamily: "'IBM Plex Sans', sans-serif"
        }}>{item.snippet}</p>
        <div style={{ display: "flex", gap: 10 }}>
          {!analysis && !loading && (
            <button onClick={() => onAnalyze(item)} style={{
              background: "linear-gradient(135deg, #e8927c, #d4735d)",
              color: "#0a0a16", fontWeight: 700, fontSize: 13,
              padding: "10px 22px", borderRadius: 10, border: "none",
              cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: "0.02em",
              transition: "transform 0.15s ease, box-shadow 0.15s ease"
            }}
              onMouseEnter={e => { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = "0 6px 20px rgba(232,146,124,0.3)"; }}
              onMouseLeave={e => { e.target.style.transform = ""; e.target.style.boxShadow = ""; }}
            >
              Analyze Opportunity
            </button>
          )}
          {loading && <LoadingDots />}
          {analysis && (
            <button onClick={() => setExpanded(!expanded)} style={{
              background: "transparent", color: "#e8927c", fontWeight: 600,
              fontSize: 13, padding: "10px 22px", borderRadius: 10,
              border: "1px solid #e8927c33", cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
              transition: "all 0.15s ease"
            }}
              onMouseEnter={e => { e.target.style.background = "#e8927c11"; }}
              onMouseLeave={e => { e.target.style.background = "transparent"; }}
            >
              {expanded ? "Collapse" : "View Analysis"} →
            </button>
          )}
        </div>
      </div>

      {expanded && analysis && (
        <div style={{
          borderTop: "1px solid #1e293b",
          padding: "24px 28px",
          background: "#0a0a18",
          animation: "slideDown 0.3s ease"
        }}>
          <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }`}</style>

          <div style={{ marginBottom: 20 }}>
            <h4 style={{ color: "#e8927c", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px", fontFamily: "'DM Mono', monospace" }}>Science & Context</h4>
            <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.7, margin: 0, fontFamily: "'IBM Plex Sans', sans-serif" }}>{analysis.science}</p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h4 style={{ color: "#e8927c", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 12px", fontFamily: "'DM Mono', monospace" }}>Product Opportunities</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {analysis.opportunities.map((opp, i) => (
                <div key={i} style={{
                  background: "#12122a", borderRadius: 12, padding: "16px 20px",
                  border: "1px solid #1e293b"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }}>{opp.product}</span>
                    <UrgencyBadge level={opp.urgency} />
                  </div>
                  <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, margin: "0 0 6px", fontFamily: "'IBM Plex Sans', sans-serif" }}>{opp.reason}</p>
                  <p style={{ color: "#67e8f9", fontSize: 13, margin: 0, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    <strong style={{ color: "#22d3ee" }}>Action:</strong> {opp.action}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {analysis.protein_mention?.name && (
            <Suspense fallback={<div style={{ padding: "20px 0", color: "#64748b", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>Loading 3D viewer…</div>}>
              <ProteinViewer proteinMention={analysis.protein_mention} />
            </Suspense>
          )}

          <div style={{ marginBottom: 20 }}>
            <h4 style={{ color: "#e8927c", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px", fontFamily: "'DM Mono', monospace" }}>Talking Points</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {analysis.talking_points.map((pt, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "#e8927c", fontSize: 16, lineHeight: "22px", flexShrink: 0 }}>›</span>
                  <span style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6, fontFamily: "'IBM Plex Sans', sans-serif" }}>{pt}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            background: "#1a1a3a", borderRadius: 12, padding: "16px 20px",
            borderLeft: "3px solid #e8927c"
          }}>
            <h4 style={{ color: "#e8927c", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px", fontFamily: "'DM Mono', monospace" }}>Suggested Email Opener</h4>
            <p style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.7, margin: 0, fontStyle: "italic", fontFamily: "'IBM Plex Sans', sans-serif" }}>"{analysis.suggested_email_opener}"</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomNewsInput({ onAnalyze, loading }) {
  const [headline, setHeadline] = useState("");
  const [details, setDetails] = useState("");

  const handleSubmit = () => {
    if (!headline.trim()) return;
    onAnalyze({
      id: Date.now(),
      headline: headline.trim(),
      source: "Custom",
      date: new Date().toISOString().split("T")[0],
      snippet: details.trim() || headline.trim()
    });
    setHeadline("");
    setDetails("");
  };

  return (
    <div style={{
      background: "#0f0f1e", border: "1px solid #1e293b", borderRadius: 16, padding: "24px 28px"
    }}>
      <h3 style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 700, margin: "0 0 16px", fontFamily: "'Space Grotesk', sans-serif" }}>
        Paste Your Own News
      </h3>
      <input
        type="text"
        placeholder="News headline or company announcement..."
        value={headline}
        onChange={e => setHeadline(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", background: "#0a0a18",
          border: "1px solid #1e293b", borderRadius: 10, padding: "12px 16px",
          color: "#e2e8f0", fontSize: 14, marginBottom: 10, outline: "none",
          fontFamily: "'IBM Plex Sans', sans-serif",
          transition: "border-color 0.2s"
        }}
        onFocus={e => e.target.style.borderColor = "#e8927c44"}
        onBlur={e => e.target.style.borderColor = "#1e293b"}
      />
      <textarea
        placeholder="Additional details (optional): paste the article text, press release, or any context..."
        value={details}
        onChange={e => setDetails(e.target.value)}
        rows={3}
        style={{
          width: "100%", boxSizing: "border-box", background: "#0a0a18",
          border: "1px solid #1e293b", borderRadius: 10, padding: "12px 16px",
          color: "#e2e8f0", fontSize: 14, marginBottom: 14, outline: "none",
          resize: "vertical", fontFamily: "'IBM Plex Sans', sans-serif",
          transition: "border-color 0.2s"
        }}
        onFocus={e => e.target.style.borderColor = "#e8927c44"}
        onBlur={e => e.target.style.borderColor = "#1e293b"}
      />
      <button
        onClick={handleSubmit}
        disabled={!headline.trim() || loading}
        style={{
          background: headline.trim() && !loading ? "linear-gradient(135deg, #e8927c, #d4735d)" : "#1e293b",
          color: headline.trim() && !loading ? "#0a0a16" : "#475569",
          fontWeight: 700, fontSize: 13,
          padding: "10px 22px", borderRadius: 10, border: "none",
          cursor: headline.trim() && !loading ? "pointer" : "not-allowed",
          fontFamily: "'Space Grotesk', sans-serif"
        }}
      >
        {loading ? "Analyzing..." : "Analyze This News"}
      </button>
    </div>
  );
}

export default function App() {
  const [analyses, setAnalyses] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [customNews, setCustomNews] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("feed");
  const [analyzeAll, setAnalyzeAll] = useState(false);
  const [newsItems, setNewsItems] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(null);
  const [feedErrors, setFeedErrors] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [regulatoryItems, setRegulatoryItems] = useState([]);
  const [regLoading, setRegLoading] = useState(true);

  const fetchNews = useCallback(async (force = false) => {
    setNewsLoading(true);
    setNewsError(null);
    try {
      const response = await fetch(`/api/news${force ? "?refresh=true" : ""}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with status ${response.status}`);
      }
      const data = await response.json();
      setNewsItems(data.items || []);
      setFeedErrors(data.errors || []);
      setVisibleCount(PAGE_SIZE);
      if (data.errors?.length) {
        console.warn("News feed source errors:", data.errors);
      }
    } catch (err) {
      console.error(err);
      setNewsError(err.message || "Couldn't load live news.");
    } finally {
      setNewsLoading(false);
    }
  }, []);

  // Runs in parallel with the RSS fetch so the feed renders immediately;
  // FDA/regulatory results merge in whenever the (server-cached) scan returns.
  const fetchRegulatory = useCallback(async () => {
    setRegLoading(true);
    try {
      const response = await fetch("/api/regulatory");
      if (response.ok) {
        const data = await response.json();
        setRegulatoryItems(data.items || []);
      }
    } catch (err) {
      console.error("Regulatory fetch failed:", err);
    } finally {
      setRegLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    fetchRegulatory();
  }, [fetchNews, fetchRegulatory]);

  const analyzeNewsItem = async (item) => {
    setLoadingId(item.id);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: item.headline,
          source: item.source,
          date: item.date,
          snippet: item.snippet
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with status ${response.status}`);
      }

      const parsed = await response.json();
      setAnalyses(prev => ({ ...prev, [item.id]: parsed }));
    } catch (err) {
      console.error(err);
      setError(err.message || "Analysis failed. Please try again.");
    } finally {
      setLoadingId(null);
    }
  };

  // RSS and regulatory results arrive independently; merge, dedupe, and
  // re-sort them here so the feed is one chronological stream.
  // Dedupe by headline, not link: distinct regulatory stories often cite the
  // same aggregator landing page, while true dupes repeat the headline.
  const seenKeys = new Set();
  const feedItems = [...newsItems, ...regulatoryItems]
    .filter(item => {
      const key = item.headline || item.link || item.id;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const handleAnalyzeAll = async () => {
    setAnalyzeAll(true);
    for (const item of feedItems.slice(0, visibleCount)) {
      if (!analyses[item.id]) {
        await analyzeNewsItem(item);
        await new Promise(r => setTimeout(r, 500));
      }
    }
    setAnalyzeAll(false);
  };

  const handleCustomAnalyze = async (item) => {
    setCustomNews(prev => [item, ...prev]);
    await analyzeNewsItem(item);
  };

  const allNews = [...customNews, ...feedItems];
  const analyzedCount = Object.keys(analyses).length;
  const highOppCount = Object.values(analyses).filter(a => a.opportunity_score >= 7).length;
  const visibleNewsItems = feedItems.slice(0, visibleCount);
  const visibleAnalyzedCount = visibleNewsItems.filter(item => analyses[item.id]).length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a16",
      color: "#e2e8f0",
      fontFamily: "'IBM Plex Sans', sans-serif"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1e293b",
        padding: "28px 32px",
        background: "linear-gradient(180deg, #0f0f22 0%, #0a0a16 100%)"
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #e8927c, #d4735d)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 800, color: "#0a0a16",
              fontFamily: "'Space Grotesk', sans-serif"
            }}>P</div>
            <h1 style={{
              fontSize: 26, fontWeight: 800, margin: 0,
              fontFamily: "'Space Grotesk', sans-serif",
              background: "linear-gradient(135deg, #e8927c, #f0b4a4)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
            }}>BioPharma Scout</h1>
          </div>
          <p style={{ color: "#64748b", fontSize: 14, margin: "4px 0 0 50px", fontFamily: "'DM Mono', monospace" }}>
            AI-powered sales intelligence for Phenomenex
          </p>

          {/* Stats bar */}
          <div style={{ display: "flex", gap: 24, marginTop: 20, marginLeft: 50 }}>
            {[
              { label: "News Items", value: allNews.length, color: "#94a3b8" },
              { label: "Analyzed", value: analyzedCount, color: "#e8927c" },
              { label: "High Priority", value: highOppCount, color: "#dc2626" }
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</span>
                <span style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs + Content */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 32px" }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          {[
            { id: "feed", label: "News Feed" },
            { id: "custom", label: "Custom Analysis" }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: activeTab === tab.id ? "#1e293b" : "transparent",
              color: activeTab === tab.id ? "#e8927c" : "#64748b",
              fontWeight: 600, fontSize: 13, padding: "8px 20px",
              borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
              transition: "all 0.2s"
            }}>{tab.label}</button>
          ))}
          {activeTab === "feed" && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
              <button onClick={() => fetchNews(true)} disabled={newsLoading}
                style={{
                  background: "transparent",
                  color: newsLoading ? "#475569" : "#94a3b8",
                  fontWeight: 600, fontSize: 13, padding: "8px 20px",
                  borderRadius: 8, border: "1px solid #33415533",
                  cursor: newsLoading ? "not-allowed" : "pointer",
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                {newsLoading ? "Refreshing..." : "Refresh Feed"}
              </button>
              <button onClick={handleAnalyzeAll} disabled={analyzeAll || visibleNewsItems.length === 0 || visibleAnalyzedCount === visibleNewsItems.length}
                style={{
                  background: analyzeAll ? "#1e293b" : "transparent",
                  color: analyzeAll ? "#475569" : "#e8927c",
                  fontWeight: 600, fontSize: 13, padding: "8px 20px",
                  borderRadius: 8, border: "1px solid #e8927c33",
                  cursor: analyzeAll ? "not-allowed" : "pointer",
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                {analyzeAll ? "Analyzing..." : "Analyze All"}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div style={{
            background: "#dc262622", border: "1px solid #dc262644",
            borderRadius: 10, padding: "12px 16px", marginBottom: 16,
            color: "#fca5a5", fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif"
          }}>{error}</div>
        )}

        {activeTab === "feed" && newsError && (
          <div style={{
            background: "#dc262622", border: "1px solid #dc262644",
            borderRadius: 10, padding: "12px 16px", marginBottom: 16,
            color: "#fca5a5", fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12
          }}>
            <span>{newsError}</span>
            <button onClick={() => fetchNews(true)} style={{
              background: "transparent", color: "#fca5a5", border: "1px solid #fca5a566",
              borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12,
              fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0
            }}>Retry</button>
          </div>
        )}

        {activeTab === "feed" && !newsError && feedErrors.length > 0 && newsItems.length > 0 && (
          <div style={{
            background: "#78350f22", border: "1px solid #d9770644",
            borderRadius: 10, padding: "10px 16px", marginBottom: 16,
            color: "#fcd34d", fontSize: 12, fontFamily: "'DM Mono', monospace"
          }}>
            {feedErrors.length} source{feedErrors.length > 1 ? "s" : ""} unavailable right now — showing headlines from the rest.
            <div style={{ marginTop: 4, opacity: 0.8 }}>
              {feedErrors.map(e => `${e.source}: ${e.message}`).join(" · ")}
            </div>
          </div>
        )}

        {activeTab === "feed" && !newsError && feedErrors.length > 0 && newsItems.length === 0 && !newsLoading && (
          <div style={{
            background: "#dc262622", border: "1px solid #dc262644",
            borderRadius: 10, padding: "12px 16px", marginBottom: 16,
            color: "#fca5a5", fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12
          }}>
            <span>
              All news sources are unavailable right now.
              <div style={{ marginTop: 4, opacity: 0.8, fontSize: 12 }}>
                {feedErrors.map(e => `${e.source}: ${e.message}`).join(" · ")}
              </div>
            </span>
            <button onClick={() => fetchNews(true)} style={{
              background: "transparent", color: "#fca5a5", border: "1px solid #fca5a566",
              borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12,
              fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0
            }}>Retry</button>
          </div>
        )}

        {activeTab === "custom" && (
          <div style={{ marginBottom: 24 }}>
            <CustomNewsInput onAnalyze={handleCustomAnalyze} loading={loadingId !== null} />
          </div>
        )}

        {activeTab === "feed" && regLoading && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
            padding: "8px 14px", background: "#0f0f1e", border: "1px solid #1e293b",
            borderRadius: 10, color: "#64748b", fontSize: 12, fontFamily: "'DM Mono', monospace"
          }}>
            <LoadingDots />
            Scanning the web for FDA approvals &amp; filings — headlines below are live, results will merge in shortly
          </div>
        )}

        {activeTab === "feed" && newsLoading && feedItems.length === 0 && !newsError && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
            <LoadingDots />
            <p style={{ fontSize: 14, fontFamily: "'DM Mono', monospace", marginTop: 8 }}>Loading live biopharma news…</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(activeTab === "feed" ? visibleNewsItems : customNews).map(item => (
            <NewsCard
              key={item.id}
              item={item}
              onAnalyze={analyzeNewsItem}
              analysis={analyses[item.id]}
              loading={loadingId === item.id}
            />
          ))}
          {activeTab === "feed" && visibleCount < feedItems.length && (
            <button onClick={() => setVisibleCount(v => v + PAGE_SIZE)} style={{
              background: "transparent", color: "#e8927c", fontWeight: 600,
              fontSize: 13, padding: "12px 24px", borderRadius: 10,
              border: "1px solid #e8927c33", cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif", alignSelf: "center", marginTop: 4
            }}>
              Load More ({feedItems.length - visibleCount} more available)
            </button>
          )}
          {activeTab === "custom" && customNews.length === 0 && (
            <div style={{
              textAlign: "center", padding: "60px 20px", color: "#475569"
            }}>
              <p style={{ fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }}>Paste a headline or article above to get started</p>
              <p style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", marginTop: 8 }}>The AI will analyze the science and match Phenomenex products</p>
            </div>
          )}
          {activeTab === "feed" && !newsLoading && !newsError && feedItems.length === 0 && feedErrors.length === 0 && (
            <div style={{
              textAlign: "center", padding: "60px 20px", color: "#475569"
            }}>
              <p style={{ fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }}>No live headlines available right now</p>
              <p style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", marginTop: 8 }}>Try refreshing, or use Custom Analysis to paste a headline directly</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
