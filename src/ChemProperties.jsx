import { useEffect, useRef, useState } from "react";
import * as $3Dmol from "3dmol";

const EXAMPLES = ["ibuprofen", "50-78-2", "metformin", "ciprofloxacin", "CN1C=NC2=C1C(=O)N(C(=O)N2C)C"];

const ACID_COLOR = "#f28c80";
const BASE_COLOR = "#80a6fa";
const ACCENT = "#e8927c";

const sectionTitle = {
  color: ACCENT, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em",
  margin: "0 0 12px", fontFamily: "'DM Mono', monospace"
};
const panel = { background: "#0f0f1e", border: "1px solid #1e293b", borderRadius: 16, padding: "20px 24px" };
const mono = { fontFamily: "'DM Mono', monospace" };

function fmt(x, digits = 2) {
  if (x === null || x === undefined) return "—";
  return Number(x).toFixed(digits);
}

function formatMgPerMl(mg) {
  if (mg >= 1) return `${mg.toPrecision(3)} mg/mL`;
  if (mg >= 1e-3) return `${(mg * 1000).toPrecision(3)} µg/mL`;
  return `${(mg * 1e6).toPrecision(3)} ng/mL`;
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{ background: "#12122a", border: "1px solid #1e293b", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", ...mono }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Space Grotesk', sans-serif", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, ...mono }}>{sub}</div>}
    </div>
  );
}

// One measure per chart (no dual axis). pKa positions drawn as dashed
// guides; hovering shows a crosshair with the exact value.
function PhChart({ title, data, field, unit = "", pkas, zeroLine = false }) {
  const [hover, setHover] = useState(null);
  const W = 320, H = 190, padL = 38, padR = 10, padT = 14, padB = 34;
  const values = data.map((d) => d[field]);
  let lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const x = (pH) => padL + (pH / 14) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(d.pH).toFixed(1)},${y(d[field]).toFixed(1)}`).join("");
  const step = (hi - lo) / 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + step * i);
  const tickDigits = hi - lo < 4 ? 1 : 0;

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const pH = Math.max(0, Math.min(14, ((px - padL) / (W - padL - padR)) * 14));
    const nearest = data.reduce((best, d) => (Math.abs(d.pH - pH) < Math.abs(best.pH - pH) ? d : best));
    setHover(nearest);
  };

  return (
    <div style={{ ...panel, padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{title}</span>
        <span style={{ color: "#94a3b8", fontSize: 12, ...mono }}>
          {hover ? `pH ${fmt(hover.pH, 1)} → ${fmt(hover[field])}${unit}` : "hover for values"}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={`${title} versus pH`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#1e293b" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 3} fill="#64748b" fontSize="11" textAnchor="end" style={mono}>{t.toFixed(tickDigits)}</text>
          </g>
        ))}
        {zeroLine && lo < 0 && hi > 0 && (
          <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="#475569" strokeWidth="1" />
        )}
        {[0, 2, 4, 6, 8, 10, 12, 14].map((p) => (
          <text key={p} x={x(p)} y={H - 18} fill="#64748b" fontSize="11" textAnchor="middle" style={mono}>{p}</text>
        ))}
        <text x={(padL + W - padR) / 2} y={H - 3} fill="#475569" fontSize="11" textAnchor="middle" style={mono}>pH</text>
        {pkas.filter((s) => s.pka >= 0 && s.pka <= 14).map((s) => (
          <g key={s.id}>
            <line x1={x(s.pka)} x2={x(s.pka)} y1={padT} y2={H - padB} stroke={s.type === "acid" ? ACID_COLOR : BASE_COLOR}
              strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
            <text x={x(s.pka) + 3} y={padT - 3} fill="#94a3b8" fontSize="11" style={mono}>{s.id}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" />
        {hover && (
          <g>
            <line x1={x(hover.pH)} x2={x(hover.pH)} y1={padT} y2={H - padB} stroke="#94a3b8" strokeWidth="1" />
            <circle cx={x(hover.pH)} cy={y(hover[field])} r="4" fill={ACCENT} stroke="#0f0f1e" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
}

// Categorical palette (dark steps), validated against the #0f0f1e panel
// surface: all adjacent pairs clear the CVD and normal-vision floors.
// Slots are assigned in fixed order; the server caps species at 8.
const SPECIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

// Microspecies distribution: % of each protonation state vs pH. Hovering a
// legend entry (or a line) highlights that species; the crosshair readout
// lists every species at the hovered pH.
// Which sites differ from the neutral molecule: protonated bases, deprotonated acids.
function describeSpecies(sp, pkas) {
  if (sp.key === "other") return "pooled";
  const types = Object.fromEntries(pkas.map((s) => [s.id, s.type]));
  const prot = sp.ionizedSites.filter((id) => types[id] === "base");
  const deprot = sp.ionizedSites.filter((id) => types[id] === "acid");
  const parts = [];
  if (prot.length) parts.push(`+H⁺ at ${prot.join(", ")}`);
  if (deprot.length) parts.push(`−H⁺ at ${deprot.join(", ")}`);
  return parts.length ? `site ${parts.join("; ")}` : "uncharged form";
}

function SpeciesChart({ species, pHs, pkas }) {
  const [hoverPH, setHoverPH] = useState(null);
  const [focus, setFocus] = useState(null);
  const W = 760, H = 300, padL = 44, padR = 14, padT = 18, padB = 38;
  const x = (pH) => padL + (pH / 14) * (W - padL - padR);
  const y = (v) => padT + (1 - v / 100) * (H - padT - padB);
  const colored = species.map((sp, i) => ({ ...sp, color: SPECIES_COLORS[i % SPECIES_COLORS.length] }));
  const hoverIdx = hoverPH === null ? null : pHs.indexOf(hoverPH);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const pH = Math.max(0, Math.min(14, ((px - padL) / (W - padL - padR)) * 14));
    setHoverPH(pHs.reduce((best, p) => (Math.abs(p - pH) < Math.abs(best - pH) ? p : best)));
  };

  const readout = hoverIdx === null ? null : [...colored].sort((a, b) => b.fractions[hoverIdx] - a.fractions[hoverIdx]);

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <h4 style={{ ...sectionTitle, margin: 0 }}>Microspecies distribution</h4>
        <span style={{ color: "#94a3b8", fontSize: 12, ...mono }}>
          {hoverPH === null ? "hover the chart or legend" : `pH ${fmt(hoverPH, 1)}`}
        </span>
      </div>
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
          onMouseMove={onMove} onMouseLeave={() => setHoverPH(null)} role="img"
          aria-label="Percentage of each ionization microspecies versus pH">
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#334155" : "#1e293b"} strokeWidth="1" />
              <text x={padL - 8} y={y(t) + 4} fill="#64748b" fontSize="11" textAnchor="end" style={mono}>{t}%</text>
            </g>
          ))}
          {[0, 2, 4, 6, 8, 10, 12, 14].map((p) => (
            <text key={p} x={x(p)} y={H - 20} fill="#64748b" fontSize="11" textAnchor="middle" style={mono}>{p}</text>
          ))}
          <text x={(padL + W - padR) / 2} y={H - 4} fill="#475569" fontSize="11" textAnchor="middle" style={mono}>pH</text>
          {pkas.filter((s) => s.pka >= 0 && s.pka <= 14).map((s) => (
            <g key={s.id}>
              <line x1={x(s.pka)} x2={x(s.pka)} y1={padT} y2={H - padB} stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
              <text x={x(s.pka) + 3} y={padT - 5} fill="#94a3b8" fontSize="11" style={mono}>pKa {s.id}</text>
            </g>
          ))}
          {colored.map((sp) => {
            const d = sp.fractions.map((f, i) => `${i ? "L" : "M"}${x(pHs[i]).toFixed(1)},${y(f).toFixed(1)}`).join("");
            const dim = focus && focus !== sp.key;
            return (
              <g key={sp.key} onMouseEnter={() => setFocus(sp.key)} onMouseLeave={() => setFocus(null)}>
                {/* wide transparent stroke = a hit target bigger than the 2px line */}
                <path d={d} fill="none" stroke="transparent" strokeWidth="14" />
                <path d={d} fill="none" stroke={sp.color} strokeWidth={focus === sp.key ? 3.5 : 2}
                  strokeLinejoin="round" opacity={dim ? 0.15 : 1} style={{ transition: "opacity 0.15s, stroke-width 0.15s" }}
                  strokeDasharray={sp.key === "other" ? "5 4" : undefined} />
              </g>
            );
          })}
          {hoverIdx !== null && (
            <g pointerEvents="none">
              <line x1={x(hoverPH)} x2={x(hoverPH)} y1={padT} y2={H - padB} stroke="#94a3b8" strokeWidth="1" />
              {colored.map((sp) => (
                <circle key={sp.key} cx={x(hoverPH)} cy={y(sp.fractions[hoverIdx])} r="4" fill={sp.color}
                  stroke="#0f0f1e" strokeWidth="2" opacity={focus && focus !== sp.key ? 0.15 : 1} />
              ))}
            </g>
          )}
        </svg>
        {readout && (
          <div style={{
            position: "absolute", top: 30, pointerEvents: "none",
            ...(hoverPH < 8 ? { right: 16 } : { left: 56 }),
            background: "#0a0a18ee", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", minWidth: 180
          }}>
            {readout.filter((sp) => sp.fractions[hoverIdx] >= 0.1).map((sp) => (
              <div key={sp.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, lineHeight: 1.7, opacity: focus && focus !== sp.key ? 0.4 : 1 }}>
                <span style={{ width: 14, height: 2, background: sp.color, flexShrink: 0 }} />
                <strong style={{ color: "#f1f5f9", minWidth: 46, textAlign: "right", fontVariantNumeric: "tabular-nums", ...mono }}>
                  {fmt(sp.fractions[hoverIdx], 1)}%
                </strong>
                <span style={{ color: "#94a3b8" }}>{sp.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend: line key + structure + name; hover highlights the line */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10, marginTop: 14 }}>
        {colored.map((sp) => (
          <div key={sp.key} tabIndex={0}
            onMouseEnter={() => setFocus(sp.key)} onMouseLeave={() => setFocus(null)}
            onFocus={() => setFocus(sp.key)} onBlur={() => setFocus(null)}
            style={{
              border: `1px solid ${focus === sp.key ? sp.color : "#1e293b"}`, borderRadius: 10, padding: 8,
              background: focus === sp.key ? "#12122a" : "transparent", cursor: "default", outline: "none",
              opacity: focus && focus !== sp.key ? 0.45 : 1, transition: "opacity 0.15s, border-color 0.15s"
            }}>
            {sp.svg ? (
              <div style={{ background: "#f8fafc", borderRadius: 6, marginBottom: 6 }}>
                <img src={`data:image/svg+xml;utf8,${encodeURIComponent(sp.svg)}`} alt={sp.smiles || sp.label}
                  style={{ width: "100%", display: "block" }} />
              </div>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 18, height: 3, borderRadius: 2, background: sp.color, flexShrink: 0,
                ...(sp.key === "other" ? { background: `repeating-linear-gradient(90deg, ${sp.color} 0 5px, transparent 5px 9px)` } : {}) }} />
              <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{sp.label}</span>
            </div>
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 2, ...mono }}>
              {describeSpecies(sp, pkas)}
              {" · max "}{fmt(Math.max(...sp.fractions), 0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Viewer3D({ sdf }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!sdf || !ref.current) return;
    ref.current.innerHTML = "";
    const viewer = $3Dmol.createViewer(ref.current, { backgroundColor: "#0a0a18", antialias: true });
    viewer.addModel(sdf, "sdf");
    viewer.setStyle({}, { stick: { radius: 0.15 }, sphere: { scale: 0.25 } });
    viewer.zoomTo();
    viewer.render();
  }, [sdf]);
  return <div ref={ref} style={{ width: "100%", height: 300, position: "relative", borderRadius: 12, overflow: "hidden" }} />;
}

function Results({ data }) {
  const [view, setView] = useState("2d");
  const { identity, descriptors: d, logP, solubility, pka, lipinski } = data;
  const svgSrc = `data:image/svg+xml;utf8,${encodeURIComponent(data.svg)}`;
  const visibleSites = pka.sites;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Identity + structure */}
      <div style={{ ...panel, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 24 }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 24, color: "#f1f5f9", fontFamily: "'Space Grotesk', sans-serif", textTransform: "capitalize" }}>
            {identity.name || "Custom structure"}
          </h2>
          {identity.iupacName && (
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 12px", lineHeight: 1.5 }}>{identity.iupacName}</p>
          )}
          <table style={{ borderCollapse: "collapse", fontSize: 13, ...mono }}>
            <tbody>
              {[
                ["Formula", data.formula],
                ["CAS", identity.cas || "—"],
                ["PubChem CID", identity.cid ? <a href={identity.pubchemUrl} target="_blank" rel="noreferrer" style={{ color: ACCENT }}>{identity.cid}</a> : "—"],
                ["SMILES", <span style={{ wordBreak: "break-all" }}>{data.smiles}</span>],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ color: "#64748b", padding: "4px 14px 4px 0", verticalAlign: "top" }}>{k}</td>
                  <td style={{ color: "#e2e8f0", padding: "4px 0" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleSites.length > 0 && (
            <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 11, color: "#94a3b8", ...mono }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: ACID_COLOR, marginRight: 6 }} />acidic site</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: BASE_COLOR, marginRight: 6 }} />basic site</span>
            </div>
          )}
        </div>
        <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8, justifyContent: "flex-end" }}>
            {["2d", "3d"].map((v) => (
              <button key={v} onClick={() => setView(v)} disabled={v === "3d" && !data.sdf3d} style={{
                background: view === v ? "#1e293b" : "transparent", color: view === v ? ACCENT : "#64748b",
                border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: v === "3d" && !data.sdf3d ? "not-allowed" : "pointer",
                opacity: v === "3d" && !data.sdf3d ? 0.4 : 1, ...mono
              }}>{v.toUpperCase()}</button>
            ))}
          </div>
          {view === "2d" ? (
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 8 }}>
              <img src={svgSrc} alt={`Structure of ${identity.name || "compound"}`} style={{ width: "100%", display: "block" }} />
            </div>
          ) : (
            <Viewer3D sdf={data.sdf3d} />
          )}
        </div>
      </div>

      {/* Headline numbers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
        <StatCard label="Mol. weight" value={fmt(d.molecularWeight)} sub={`exact ${fmt(d.exactMass, 4)}`} />
        <StatCard label="logP" value={fmt(logP.crippen)} sub={logP.xlogp3 !== null ? `XLogP3 ${fmt(logP.xlogp3, 1)} (PubChem)` : "Crippen"} />
        <StatCard label="logD @ pH 7.4" value={fmt(data.logD74)} sub={`net charge ${fmt(data.chargeAt74)}`} />
        <StatCard label="Solubility (logS)" value={fmt(solubility.intrinsicLogS)} sub={`${formatMgPerMl(solubility.intrinsicMgPerMl)} · ${solubility.class}`} />
        <StatCard label="TPSA" value={`${fmt(d.tpsa, 1)} Å²`} />
        <StatCard label="H-bond donors / acceptors" value={`${d.hbd} / ${d.hba}`} />
        <StatCard label="Rotatable bonds" value={d.rotatableBonds} />
        <StatCard label="Lipinski Ro5" value={lipinski.passes ? "Pass" : "Fail"} sub={`${lipinski.violations} violation${lipinski.violations === 1 ? "" : "s"}`} />
        {pka.isoelectricPoint !== null && <StatCard label="Isoelectric point" value={fmt(pka.isoelectricPoint)} />}
      </div>

      {/* pKa */}
      <div style={panel}>
        <h4 style={sectionTitle}>Predicted pKa</h4>
        {visibleSites.length === 0 && !pka.permanentCharge && (
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>No ionizable groups in the pH 0–14 range — neutral at all pH, so logD = logP.</p>
        )}
        {pka.permanentCharge > 0 && (
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 10px" }}>Contains a quaternary ammonium — permanently charged (+{pka.permanentCharge}).</p>
        )}
        {visibleSites.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#64748b", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", ...mono }}>
                <th style={{ padding: "6px 8px" }}>#</th>
                <th style={{ padding: "6px 8px" }}>Type</th>
                <th style={{ padding: "6px 8px" }}>Group</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>pKa</th>
              </tr>
            </thead>
            <tbody>
              {visibleSites.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid #1e293b" }}>
                  <td style={{ padding: "8px", color: "#94a3b8", ...mono }}>{s.id}</td>
                  <td style={{ padding: "8px", color: "#e2e8f0" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: s.type === "acid" ? ACID_COLOR : BASE_COLOR, marginRight: 8 }} />
                    {s.type === "acid" ? "Acidic" : "Basic"}
                  </td>
                  <td style={{ padding: "8px", color: "#cbd5e1" }}>{s.group}</td>
                  <td style={{ padding: "8px", color: "#f1f5f9", textAlign: "right", fontWeight: 600, ...mono }}>{fmt(s.pka, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ color: "#475569", fontSize: 11, margin: "12px 0 0", ...mono }}>
          Estimated from typical values for each functional group (±1–2 units). Basic pKa = pKa of the conjugate acid.
          Check against the experimental values below where available.
        </p>
      </div>

      {data.species?.length > 0 && (
        <SpeciesChart species={data.species} pHs={data.curve.map((p) => p.pH)} pkas={visibleSites} />
      )}

      {/* pH profiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <PhChart title="logD vs pH" data={data.curve} field="logD" pkas={visibleSites} />
        <PhChart title="Net charge vs pH" data={data.curve} field="charge" pkas={visibleSites} zeroLine />
        <PhChart title="Solubility (logS) vs pH" data={data.curve} field="logS" pkas={visibleSites} />
      </div>

      {data.lcPhWindows.length > 0 && visibleSites.length > 0 && (
        <div style={{ background: "#1a1a3a", borderRadius: 12, padding: "16px 20px", borderLeft: `3px solid ${ACCENT}` }}>
          <h4 style={{ ...sectionTitle, margin: "0 0 6px" }}>HPLC mobile-phase pH</h4>
          <p style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            For robust retention, keep the mobile phase ≥2 pH units from every pKa so the analyte is &gt;99% in one form:
            {" "}<strong>{data.lcPhWindows.map(([a, b]) => `pH ${a}–${b}`).join(" or ")}</strong>
            {" "}(check your column's pH range).
          </p>
        </div>
      )}

      {/* Experimental */}
      <div style={panel}>
        <h4 style={sectionTitle}>Experimental data (PubChem)</h4>
        {data.experimental.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>No experimental pKa / logP / solubility values on record for this compound.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.experimental.map((e) => (
              <div key={e.label}>
                <div style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, ...mono }}>{e.label}</div>
                {e.values.map((v, i) => (
                  <div key={i} style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.5 }}>› {v}</div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full descriptor table */}
      <div style={panel}>
        <h4 style={sectionTitle}>All descriptors</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "6px 24px", fontSize: 13, ...mono }}>
          {[
            ["Heavy atoms", d.heavyAtoms],
            ["Rings / aromatic", `${d.rings} / ${d.aromaticRings}`],
            ["Fraction sp³ C", fmt(d.fractionCsp3)],
            ["Stereocenters", d.stereocenters],
            ["Molar refractivity", fmt(d.molarRefractivity, 1)],
            ["Aromatic proportion", fmt(solubility.aromaticProportion)],
            ["Solubility method", solubility.method],
            ["InChI", <span style={{ wordBreak: "break-all" }}>{data.inchi || "—"}</span>],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #1e293b", padding: "4px 0" }}>
              <span style={{ color: "#64748b", flexShrink: 0 }}>{k}</span>
              <span style={{ color: "#e2e8f0", textAlign: "right", minWidth: 0 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChemProperties() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const search = async (q) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setQuery(term);
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`/api/chem-properties?q=${encodeURIComponent(term)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Request failed with status ${res.status}`);
      setData(body);
      setStatus("ready");
    } catch (err) {
      setError(err.message || "Lookup failed.");
      setStatus("error");
    }
  };

  return (
    <div>
      <div style={{ ...panel, marginBottom: 16 }}>
        <h3 style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 700, margin: "0 0 4px", fontFamily: "'Space Grotesk', sans-serif" }}>
          Chemical Properties
        </h3>
        <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 14px" }}>
          Look up any molecule by name, CAS number, or SMILES to get pKa, logP/logD, solubility, and more.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="e.g. ibuprofen, 50-78-2, or CC(=O)Oc1ccccc1C(=O)O"
            style={{
              flex: 1, minWidth: 0, background: "#0a0a18", border: "1px solid #1e293b", borderRadius: 10,
              padding: "12px 16px", color: "#e2e8f0", fontSize: 14, outline: "none", fontFamily: "'IBM Plex Sans', sans-serif"
            }}
          />
          <button onClick={() => search()} disabled={!query.trim() || status === "loading"} style={{
            background: query.trim() && status !== "loading" ? "linear-gradient(135deg, #e8927c, #d4735d)" : "#1e293b",
            color: query.trim() && status !== "loading" ? "#0a0a16" : "#475569",
            fontWeight: 700, fontSize: 13, padding: "10px 22px", borderRadius: 10, border: "none",
            cursor: query.trim() && status !== "loading" ? "pointer" : "not-allowed", fontFamily: "'Space Grotesk', sans-serif"
          }}>
            {status === "loading" ? "Calculating..." : "Calculate"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => search(ex)} style={{
              background: "transparent", color: "#94a3b8", border: "1px solid #1e293b", borderRadius: 99,
              padding: "4px 12px", fontSize: 11, cursor: "pointer", maxWidth: 260, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap", ...mono
            }}>{ex}</button>
          ))}
        </div>
      </div>

      {status === "error" && (
        <div style={{
          background: "#dc262622", border: "1px solid #dc262644", borderRadius: 10, padding: "12px 16px",
          color: "#fca5a5", fontSize: 13
        }}>{error}</div>
      )}

      {status === "loading" && (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b", fontSize: 13, ...mono }}>
          Resolving structure and calculating properties…
        </div>
      )}

      {status === "ready" && data && <Results data={data} />}
    </div>
  );
}
