import { useEffect, useRef, useState } from "react";
import * as $3Dmol from "3dmol";

export default function ProteinViewer({ proteinMention }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (!proteinMention?.name) return;
    let cancelled = false;
    setStatus("loading");
    setErrorMsg("");

    fetch(`/api/protein-structure?name=${encodeURIComponent(proteinMention.name)}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setStatus("notfound");
          return null;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed with status ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        setMeta(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setErrorMsg(err.message || "Couldn't load protein structure.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [proteinMention?.name]);

  useEffect(() => {
    if (status !== "ready" || !meta?.pdbData || !containerRef.current) return;
    containerRef.current.innerHTML = "";
    const viewer = $3Dmol.createViewer(containerRef.current, { backgroundColor: "#0a0a18" });
    viewer.addModel(meta.pdbData, "pdb");
    viewer.setStyle({}, { cartoon: { color: "spectrum" }, stick: {}, sphere: { scale: 0.3 } });
    viewer.zoomTo();
    viewer.render();
  }, [status, meta]);

  if (!proteinMention?.name) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <h4 style={{ color: "#e8927c", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 12px", fontFamily: "'DM Mono', monospace" }}>
        Protein Structure — {proteinMention.name} ({proteinMention.role})
      </h4>

      {status === "loading" && (
        <div style={{ padding: "20px 0", color: "#64748b", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
          Loading structure…
        </div>
      )}

      {status === "notfound" && (
        <div style={{
          padding: "16px 20px", background: "#12122a", borderRadius: 12, border: "1px solid #1e293b",
          color: "#64748b", fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif"
        }}>
          No predicted structure found for "{proteinMention.name}" in AlphaFold's database.
        </div>
      )}

      {status === "error" && (
        <div style={{
          padding: "16px 20px", background: "#dc262622", border: "1px solid #dc262644",
          borderRadius: 12, color: "#fca5a5", fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif"
        }}>
          {errorMsg}
        </div>
      )}

      {status === "ready" && meta && (
        <div>
          <div
            ref={containerRef}
            style={{
              width: "100%", height: 320, borderRadius: 12, overflow: "hidden",
              border: "1px solid #1e293b", position: "relative", background: "#0a0a18"
            }}
          />
          <p style={{ color: "#475569", fontSize: 11, margin: "8px 0 0", fontFamily: "'DM Mono', monospace" }}>
            AlphaFold predicted structure · UniProt {meta.accession}{meta.organism ? ` · ${meta.organism}` : ""} — computationally predicted, not an experimentally solved structure
          </p>
        </div>
      )}
    </div>
  );
}
