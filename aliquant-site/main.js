// ---------------------------------------------------------------------------
// Site config — edit these to point at your real accounts and endpoints.
// ---------------------------------------------------------------------------
const CONFIG = {
  substackUrl: "https://YOUR-HANDLE.substack.com",
  modelRepoUrl: "https://github.com/luckynbucky",
  modelCardUrl: "#",
  // Leave empty until you deploy an inference endpoint (see README.md).
  // The form then shows a demo response instead of calling the network.
  predictEndpoint: "",
};

// Pipeline programs. `stage` runs 0–4: 1 = Target ID, 2 = Hit discovery,
// 3 = Lead optimisation, 4 = Preclinical. Fractions show partway progress.
const PIPELINE = [
  { name: "ALQ-101", indication: "HFMD (EV-A71)", target: "Viral protease", stage: 2.4 },
  { name: "ALQ-102", indication: "Pan-enterovirus", target: "Viral helicase", stage: 1.6 },
  { name: "ALQ-201", indication: "HFMD (CVA16)", target: "Capsid pocket", stage: 1.1 },
];

// Replace with your real posts (or wire up the Substack RSS feed — see README).
const POSTS = [
  { title: "Why I'm building a biotech with no lab", date: "2026-09", blurb: "What it means for a company to be fully agentic, and where humans still sit in the loop." },
  { title: "Hand, foot & mouth disease: the neglected outbreak", date: "2026-08", blurb: "Why a common childhood illness still has no approved antiviral." },
  { title: "Training my first molecular property model", date: "2026-07", blurb: "Data, featurisation, and the mistakes that cost me a week." },
];

// ---------------------------------------------------------------------------

document.getElementById("year").textContent = new Date().getFullYear();

for (const el of document.querySelectorAll(".substack-link")) el.href = CONFIG.substackUrl;
document.getElementById("model-repo-link").href = CONFIG.modelRepoUrl;
document.getElementById("model-paper-link").href = CONFIG.modelCardUrl;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Pipeline rows, with bars that animate in when scrolled into view.
const rows = document.getElementById("pipeline-rows");
rows.innerHTML = PIPELINE.map((p) => `
  <div class="pipe-row" role="row">
    <span role="cell"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.indication)}</small></span>
    <span role="cell">${escapeHtml(p.target)}</span>
    <span role="cell"><div class="track"><div class="track-fill" data-w="${(p.stage / 4) * 100}"></div></div></span>
  </div>`).join("");

new IntersectionObserver((entries, obs) => {
  if (!entries[0].isIntersecting) return;
  for (const bar of rows.querySelectorAll(".track-fill")) bar.style.width = bar.dataset.w + "%";
  obs.disconnect();
}, { threshold: 0.3 }).observe(rows);

// Substack post cards.
document.getElementById("posts").innerHTML = POSTS.map((p) => `
  <a class="card post" href="${CONFIG.substackUrl}" target="_blank" rel="noopener">
    <time>${escapeHtml(p.date)}</time>
    <h3>${escapeHtml(p.title)}</h3>
    <p>${escapeHtml(p.blurb)}</p>
  </a>`).join("");

// Typed agent log in the hero. Illustrative only.
const LOG = [
  ["literature", "scanning recent papers on enterovirus targets"],
  ["literature", "412 results → 37 with structural data", true],
  ["reasoning", "ranking candidate binding pockets by druggability"],
  ["design", "generating 2,000 candidate molecules"],
  ["design", "filtering on predicted ADMET + synthesisability"],
  ["validate", "docking top 50 → scoring + critique pass", true],
  ["reasoning", "queuing 8 candidates for human review"],
];

const logEl = document.getElementById("agent-log");
if (logEl && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let i = 0;
  const render = () => {
    logEl.innerHTML = LOG.slice(0, i + 1).map(([agent, msg, ok]) =>
      `<span class="agent">[${agent}]</span> ${escapeHtml(msg)}${ok ? ' <span class="ok">✓</span>' : ""}`
    ).join("\n");
    i = (i + 1) % (LOG.length + 2); // pause a beat before looping
    setTimeout(render, i >= LOG.length ? 2200 : 900);
  };
  render();
}

// Model demo form. Calls CONFIG.predictEndpoint if set, else shows a stub.
const form = document.getElementById("predict-form");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const out = document.getElementById("predict-out");
  const smiles = document.getElementById("smiles").value.trim();
  if (!smiles) { out.textContent = "Enter a SMILES string first."; return; }

  if (!CONFIG.predictEndpoint) {
    out.textContent =
      "Demo mode (no endpoint configured yet).\n\n" +
      "input:  " + smiles + "\n" +
      "score:  0.00  — wire up CONFIG.predictEndpoint to run the real model.";
    return;
  }

  out.textContent = "Predicting…";
  try {
    const res = await fetch(CONFIG.predictEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smiles }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    out.textContent = JSON.stringify(await res.json(), null, 2);
  } catch (err) {
    out.textContent = "Request failed: " + err.message;
  }
});

// Hero network animation — drifting nodes joined by fading edges.
const canvas = document.getElementById("network");
if (canvas && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const ctx = canvas.getContext("2d");
  let w, h, nodes, raf;
  const COUNT = 46;

  const resize = () => {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  };
  const init = () => {
    nodes = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
    }));
  };

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
    }
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 130) {
          ctx.strokeStyle = `rgba(124, 140, 255, ${0.14 * (1 - dist / 130)})`;
          ctx.beginPath();
          ctx.moveTo(nodes[a].x, nodes[a].y);
          ctx.lineTo(nodes[b].x, nodes[b].y);
          ctx.stroke();
        }
      }
    }
    for (const n of nodes) {
      ctx.fillStyle = "rgba(62, 230, 181, 0.7)";
      ctx.beginPath();
      ctx.arc(n.x, n.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(draw);
  };

  const start = () => { resize(); init(); cancelAnimationFrame(raf); draw(); };
  window.addEventListener("resize", start);
  start();
}
