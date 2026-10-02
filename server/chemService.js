import initRDKitModule from "@rdkit/rdkit";

// Chemicalize-style property calculator.
//
// Identity (name / CAS -> structure) comes from PubChem. Everything we can
// compute from the structure itself is done locally with RDKit:
//   - logP: Crippen atom-contribution method (Wildman & Crippen 1999)
//   - aqueous solubility: ESOL (Delaney 2004)
//   - pKa: a SMARTS rule table of typical group pKa values
//   - logD / net charge / solubility vs pH: Henderson–Hasselbalch on those pKas
// PubChem's own computed XLogP3 and any experimental values it holds
// (pKa, logP, solubility, melting point...) are shown alongside so the
// estimates can be sanity-checked.

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();
const CACHE_MAX = 300;

const FETCH_HEADERS = { "User-Agent": "BioPharmaScout/0.1 (chemical property lookup)" };

let rdkitPromise = null;
export function getRDKit() {
  if (!rdkitPromise) rdkitPromise = initRDKitModule();
  return rdkitPromise;
}

const CAS_RE = /^\d{2,7}-\d{2}-\d$/;

export function isValidCas(cas) {
  if (!CAS_RE.test(cas)) return false;
  const digits = cas.replace(/-/g, "");
  const check = Number(digits.at(-1));
  const body = digits.slice(0, -1).split("").reverse();
  const sum = body.reduce((acc, d, i) => acc + Number(d) * (i + 1), 0);
  return sum % 10 === check;
}

// ---------------------------------------------------------------- pKa rules
//
// Each rule: SMARTS, which atom of the match is the ionizable site, and a
// typical pKa for that group. Rules are tried in order and each atom is
// claimed by the first rule that matches it, so specific patterns come
// before general ones. Charged forms ([O-], [NH+]) are included so salts and
// zwitterion SMILES still match. Values are textbook group averages; real
// pKas shift by +/-1-2 units with substituents, so treat these as estimates.
const NOT_ACYL_N = "!$(N-C=[O,S,N]);!$(N-S(=O)=O);!$(N-[#7,#8]);!$(N-a);!$(N-C=C)";

export const PKA_RULES = [
  // ---- acids
  { type: "acid", group: "Sulfonic acid", smarts: "S(=O)(=O)[OX2H1,OX1-]", site: 3, pka: -1.0 },
  { type: "acid", group: "Phosphate / phosphonic acid", smarts: "P(=O)[OX2H1,OX1-]", site: 2, pka: 2.0 },
  { type: "acid", group: "α-Amino acid carboxyl", smarts: "[NX3,NX4+][CX4]C(=O)[OX2H1,OX1-]", site: 4, pka: 2.3 },
  { type: "acid", group: "Quinolone 3-carboxylic acid", smarts: "O=c1c(C(=O)[OX2H1,OX1-])cn**1", site: 5, pka: 6.1 },
  { type: "acid", group: "Aromatic carboxylic acid", smarts: "aC(=O)[OX2H1,OX1-]", site: 3, pka: 4.0 },
  { type: "acid", group: "Carboxylic acid", smarts: "[#6]C(=O)[OX2H1,OX1-]", site: 3, pka: 4.6 },
  { type: "acid", group: "Tetrazole", smarts: "[nH1,n-]1nnnc1", site: 0, pka: 4.9 },
  { type: "acid", group: "Tetrazole", smarts: "[nH1,n-]1nncn1", site: 0, pka: 4.9 },
  { type: "acid", group: "Acyl sulfonamide", smarts: "C(=O)[NX3H1,NX2-]S(=O)=O", site: 2, pka: 4.5 },
  { type: "acid", group: "N-Heteroaryl sulfonamide", smarts: "[a;r5,$(a:n)][NX3H1,NX2-]S(=O)(=O)", site: 1, pka: 6.5 },
  { type: "acid", group: "Aryl sulfonamide N-H", smarts: "c[NX3H1,NX2-]S(=O)(=O)", site: 1, pka: 8.5 },
  { type: "acid", group: "Barbiturate / hydantoin imide", smarts: "C(=O)[NX3H1,NX2-]C(=O)[NX3]", site: 2, pka: 8.0 },
  { type: "acid", group: "Imide", smarts: "C(=O)[NX3H1,NX2-]C(=O)", site: 2, pka: 9.5 },
  { type: "acid", group: "Hydroxamic acid", smarts: "C(=O)[NX3][OX2H1,OX1-]", site: 3, pka: 9.0 },
  { type: "acid", group: "Primary sulfonamide", smarts: "S(=O)(=O)[NX3H2,NX2H1-]", site: 3, pka: 10.0 },
  { type: "acid", group: "Vinylogous acid (enol of 1,3-dicarbonyl)", smarts: "[OX2H1,OX1-]C=CC=O", site: 0, pka: 5.0 },
  { type: "acid", group: "Nitrophenol", smarts: "[OX2H1,OX1-]c1ccc([N+](=O)[O-])cc1", site: 0, pka: 7.2 },
  { type: "acid", group: "Phenol", smarts: "[OX2H1,OX1-]c", site: 0, pka: 10.0 },
  { type: "acid", group: "Thiophenol", smarts: "[SX2H1,SX1-]c", site: 0, pka: 6.6 },
  { type: "acid", group: "Thiol", smarts: "[SX2H1,SX1-][CX4]", site: 0, pka: 10.0 },

  // ---- bases (pKa of the conjugate acid)
  { type: "base", group: "Biguanide", smarts: "[NX3]C(=[NX2])[NX3]C(=[NX2])[NX3]", site: 2, pka: 12.4 },
  { type: "base", group: "Guanidine", smarts: "[NX3;!$(NC=O)]C(=[NX2;!$(NC=O);!$(N-[#7,#8]);!$(N-S)])[NX3;!$(NC=O)]", site: 2, pka: 13.0 },
  { type: "base", group: "Amidine", smarts: "[#6,#1]C(=[NX2;!$(NC=O);!$(N-[#7,#8])])[NX3;!$(NC=O)]", site: 2, pka: 11.5 },
  { type: "base", group: "α-Amino acid amine", smarts: `[NX3,NX4+;${NOT_ACYL_N}][CX4]C(=O)[OX2H1,OX1-]`, site: 0, pka: 9.5 },
  { type: "base", group: "Amine α to carbonyl (e.g. lidocaine)", smarts: `[NX3,NX4+;${NOT_ACYL_N}][CH2]C(=O)`, site: 0, pka: 7.8 },
  { type: "base", group: "Morpholine N", smarts: `[NX3,NX4+;R;${NOT_ACYL_N}]1CCOCC1`, site: 0, pka: 7.4 },
  { type: "base", group: "Benzylic amine", smarts: `[NX3,NX4+;!H0;${NOT_ACYL_N}][CH2]c`, site: 0, pka: 9.3 },
  { type: "base", group: "Primary aliphatic amine", smarts: `[NX3H2,NX4H3+;${NOT_ACYL_N}][CX4]`, site: 0, pka: 10.6 },
  { type: "base", group: "Secondary aliphatic amine", smarts: `[NX3H1,NX4H2+;${NOT_ACYL_N}]([CX4])[CX4]`, site: 0, pka: 10.5 },
  { type: "base", group: "Tertiary aliphatic amine", smarts: `[NX3H0,NX4H1+;${NOT_ACYL_N}]([CX4])([CX4])[CX4]`, site: 0, pka: 9.5 },
  { type: "base", group: "4-Aminopyridine", smarts: "[nX2,nH1+]1ccc([NX3;!$(NC=O)])cc1", site: 0, pka: 9.2 },
  { type: "base", group: "2-Aminopyridine", smarts: "[nX2,nH1+;r6]:c-[NX3;!$(NC=O);!$(NS=O)]", site: 0, pka: 6.7 },
  { type: "base", group: "Imidazole", smarts: "[nX2,nH1+;r5;$(n:c:[nX3]),$(n:c:c:[nX3]);!$(n:c:n:c=O)]", site: 0, pka: 6.8 },
  { type: "base", group: "Pyridine-type N", smarts: "[nX2,nH1+;r6;!$(n:a:n);!$(n:n);!$(n:c=O)]", site: 0, pka: 5.0 },
  { type: "base", group: "Aniline", smarts: "[NX3,NX4+;!$(N-C=[O,S,N]);!$(N-S(=O)=O);!$(N(a)a);!$(N-[#7,#8])]c", site: 0, pka: 4.6 },
];

const ATOMIC_SYMBOLS = {
  1: "H", 5: "B", 6: "C", 7: "N", 8: "O", 9: "F", 11: "Na", 12: "Mg", 14: "Si", 15: "P",
  16: "S", 17: "Cl", 19: "K", 20: "Ca", 26: "Fe", 29: "Cu", 30: "Zn", 34: "Se", 35: "Br",
  53: "I", 78: "Pt",
};

// PubChem records for salts/hydrates contain several fragments; properties
// are computed on the largest one (the parent drug).
export function largestFragment(smiles) {
  const frags = smiles.split(".");
  if (frags.length === 1) return smiles;
  const heavy = (s) => (s.replace(/\[[^\]]*\]/g, "X").match(/[A-Z]/g) || []).length;
  return frags.reduce((best, f) => (heavy(f) > heavy(best) ? f : best));
}

function hillFormula(mol) {
  const json = JSON.parse(mol.get_json());
  const m = json.molecules[0];
  const defaults = json.defaults.atom;
  const counts = {};
  let charge = 0;
  for (const a of m.atoms) {
    const z = a.z ?? defaults.z;
    const sym = ATOMIC_SYMBOLS[z] || `Z${z}`;
    counts[sym] = (counts[sym] || 0) + 1;
    counts.H = (counts.H || 0) + (a.impHs ?? defaults.impHs);
    charge += a.chg ?? defaults.chg;
  }
  if (!counts.H) delete counts.H;
  const order = counts.C
    ? ["C", "H", ...Object.keys(counts).filter((s) => s !== "C" && s !== "H").sort()]
    : Object.keys(counts).sort();
  let f = order.map((s) => `${s}${counts[s] > 1 ? counts[s] : ""}`).join("");
  if (charge) f += charge > 0 ? `${charge > 1 ? charge : ""}+` : `${charge < -1 ? -charge : ""}-`;
  return f;
}

export function predictPkaSites(RDKit, mol) {
  const claimed = new Set();
  const sites = [];
  for (const rule of PKA_RULES) {
    const q = RDKit.get_qmol(rule.smarts);
    if (!q || !q.is_valid()) {
      q?.delete();
      continue;
    }
    const raw = mol.get_substruct_matches(q);
    q.delete();
    const matches = raw && raw !== "{}" ? JSON.parse(raw) : [];
    for (const match of matches) {
      const atom = match.atoms[rule.site];
      if (atom === undefined || claimed.has(atom)) continue;
      claimed.add(atom);
      sites.push({ atom, type: rule.type, group: rule.group, pka: rule.pka });
    }
  }
  // Quaternary ammonium: permanently cationic, no pKa.
  const quat = RDKit.get_qmol("[NX4+;H0;!$(N~[O,N])]");
  const quatMatches = JSON.parse(mol.get_substruct_matches(quat) || "[]");
  quat.delete();
  const permanentCharge = Array.isArray(quatMatches) ? quatMatches.length : 0;

  // Repeats of the same group (e.g. the two carboxyls of a diacid) don't
  // ionize at the same pH: once one is charged, the next is harder to
  // ionize. Approximate with a 1-unit electrostatic step per repeat.
  const seen = {};
  for (const s of sites.sort((a, b) => (a.type === "acid" ? a.pka - b.pka : b.pka - a.pka))) {
    const key = `${s.type}:${s.group}`;
    const n = seen[key] || 0;
    if (n > 0) s.pka += s.type === "acid" ? n : -n;
    seen[key] = n + 1;
  }
  sites.forEach((s) => (s.pka = Math.round(s.pka * 10) / 10));
  return { sites: sites.sort((a, b) => a.pka - b.pka), permanentCharge };
}

// Fractions under the independent-site approximation.
export function speciesAt(pH, sites, permanentCharge = 0) {
  let fNeutral = 1;
  let charge = permanentCharge;
  for (const s of sites) {
    if (s.type === "acid") {
      const fIon = 1 / (1 + 10 ** (s.pka - pH));
      fNeutral *= 1 - fIon;
      charge -= fIon;
    } else {
      const fIon = 1 / (1 + 10 ** (pH - s.pka));
      fNeutral *= 1 - fIon;
      charge += fIon;
    }
  }
  if (permanentCharge) fNeutral = 0;
  return { fNeutral, charge };
}

export function isoelectricPoint(sites, permanentCharge) {
  if (permanentCharge || !sites.some((s) => s.type === "acid") || !sites.some((s) => s.type === "base")) {
    return null;
  }
  let lo = 0, hi = 14;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (speciesAt(mid, sites).charge > 0) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 100) / 100;
}

// ESOL: logS = 0.16 - 0.63 clogP - 0.0062 MW + 0.066 RB - 0.74 AP
export function esolLogS({ clogp, mw, rotatableBonds, aromaticProportion }) {
  return 0.16 - 0.63 * clogp - 0.0062 * mw + 0.066 * rotatableBonds - 0.74 * aromaticProportion;
}

function solubilityClass(logS) {
  if (logS >= 0) return "Highly soluble";
  if (logS >= -2) return "Soluble";
  if (logS >= -4) return "Moderately soluble";
  if (logS >= -6) return "Poorly soluble";
  return "Insoluble";
}

// ------------------------------------------------------- microspecies
//
// Each ionizable site is either in its neutral or its ionized state, so n
// sites give 2^n microspecies. Under the independent-site approximation a
// microspecies' fraction at a given pH is the product of each site's state
// fraction. Species that never reach 1% anywhere on 0–14 are dropped; past
// MAX_SPECIES the smallest are pooled into "Other".
const MAX_SPECIES = 8;
const MAX_ENUMERATED_SITES = 12;

function siteIonizedFraction(site, pH) {
  return site.type === "acid" ? 1 / (1 + 10 ** (site.pka - pH)) : 1 / (1 + 10 ** (pH - site.pka));
}

function speciesLabel(charge, ionized) {
  const hasPlus = ionized.some((s) => s.type === "base");
  const hasMinus = ionized.some((s) => s.type === "acid");
  if (!ionized.length) return charge ? `Cation (+${charge})` : "Neutral";
  const signed = charge > 0 ? `+${charge}` : charge < 0 ? `−${-charge}` : "0";
  if (hasPlus && hasMinus) return `Zwitterion (net ${signed})`;
  const names = { 1: "", 2: "Di", 3: "Tri", 4: "Tetra" };
  const n = Math.abs(charge);
  const prefix = names[n] ?? `${n}× `;
  return charge > 0 ? `${prefix}${prefix ? "cation" : "Cation"} (${signed})` : `${prefix}${prefix ? "anion" : "Anion"} (${signed})`;
}

// Draws one microspecies by editing charges/H-counts in RDKit's JSON.
// Charges are set absolutely, so input already drawn as a salt
// (e.g. a carboxylate) still renders each state correctly.
function speciesSvg(RDKit, baseJson, sites, ionizedMask) {
  const json = JSON.parse(baseJson);
  const atoms = json.molecules[0].atoms;
  const dflt = json.defaults.atom;
  sites.forEach((site, i) => {
    const a = (atoms[site.atom] = { ...atoms[site.atom] });
    const chg = a.chg ?? dflt.chg;
    const h = a.impHs ?? dflt.impHs;
    const neutralH = site.type === "acid" ? h + (chg < 0 ? 1 : 0) : h - (chg > 0 ? 1 : 0);
    const ionized = (ionizedMask >> i) & 1;
    if (site.type === "acid") {
      a.chg = ionized ? -1 : 0;
      a.impHs = Math.max(0, ionized ? neutralH - 1 : neutralH);
    } else {
      a.chg = ionized ? 1 : 0;
      a.impHs = ionized ? neutralH + 1 : neutralH;
    }
  });
  const mol = RDKit.get_mol(JSON.stringify(json));
  if (!mol || !mol.is_valid()) {
    mol?.delete();
    return null;
  }
  try {
    return { svg: mol.get_svg(220, 150), smiles: mol.get_smiles() };
  } finally {
    mol.delete();
  }
}

export function microspeciesDistribution(RDKit, mol, sites, permanentCharge, pHs) {
  const enumerated = sites.slice(0, MAX_ENUMERATED_SITES);
  const n = enumerated.length;
  const siteFractions = pHs.map((pH) => enumerated.map((s) => siteIonizedFraction(s, pH)));

  let species = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    const fractions = siteFractions.map((fs) =>
      fs.reduce((acc, f, i) => acc * ((mask >> i) & 1 ? f : 1 - f), 1)
    );
    const peak = Math.max(...fractions);
    if (peak < 0.01) continue;
    const ionized = enumerated.filter((_, i) => (mask >> i) & 1);
    const charge = permanentCharge + ionized.reduce((c, s) => c + (s.type === "acid" ? -1 : 1), 0);
    species.push({
      mask,
      charge,
      ionizedSites: ionized.map((s) => s.id),
      label: speciesLabel(charge, ionized),
      peak,
      peakPH: pHs[fractions.indexOf(peak)],
      fractions,
    });
  }

  species.sort((a, b) => b.peak - a.peak);
  let other = null;
  if (species.length > MAX_SPECIES) {
    const rest = species.slice(MAX_SPECIES - 1);
    species = species.slice(0, MAX_SPECIES - 1);
    other = {
      key: "other",
      label: `Other (${rest.length} minor species)`,
      charge: null,
      ionizedSites: [],
      svg: null,
      fractions: pHs.map((_, i) => rest.reduce((sum, sp) => sum + sp.fractions[i], 0)),
    };
  }
  // Left-to-right in the order they dominate as pH rises, like a titration.
  species.sort((a, b) => a.peakPH - b.peakPH || b.charge - a.charge);

  const baseJson = mol.get_json();
  const out = species.map((sp) => {
    const drawn = speciesSvg(RDKit, baseJson, enumerated, sp.mask);
    return {
      key: `ms${sp.mask}`,
      label: sp.label,
      charge: sp.charge,
      ionizedSites: sp.ionizedSites,
      svg: drawn?.svg || null,
      smiles: drawn?.smiles || null,
      fractions: sp.fractions,
    };
  });
  if (other) out.push(other);
  return out.map((sp) => ({ ...sp, fractions: sp.fractions.map((f) => Math.round(f * 1000) / 10) }));
}

const round = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

// Mobile-phase pH guidance for reversed-phase LC: the analyte should be
// >99% in one form, i.e. at least 2 pH units from every pKa.
function lcPhGuidance(sites) {
  const relevant = sites.filter((s) => s.pka > 0 && s.pka < 14).map((s) => s.pka);
  const windows = [];
  let start = 1.5;
  for (const p of [...relevant].sort((a, b) => a - b)) {
    if (p - 2 > start) windows.push([start, Math.min(p - 2, 12)]);
    start = Math.max(start, p + 2);
  }
  if (start < 12) windows.push([start, 12]);
  return windows.filter(([a, b]) => b - a >= 0.3).map(([a, b]) => [round(a, 1), round(b, 1)]);
}

export async function computeProperties(smilesInput) {
  const RDKit = await getRDKit();
  const smiles = largestFragment(smilesInput.trim());
  const mol = RDKit.get_mol(smiles);
  if (!mol || !mol.is_valid()) {
    mol?.delete();
    throw new Error("Couldn't parse that structure.");
  }
  try {
    const d = JSON.parse(mol.get_descriptors());
    const aromQ = RDKit.get_qmol("[a]");
    const aromMatches = JSON.parse(mol.get_substruct_matches(aromQ) || "[]");
    aromQ.delete();
    const aromaticAtoms = Array.isArray(aromMatches) ? aromMatches.length : 0;
    const aromaticProportion = d.NumHeavyAtoms ? aromaticAtoms / d.NumHeavyAtoms : 0;

    const clogp = d.CrippenClogP;
    const mw = d.amw;
    const logS0 = esolLogS({ clogp, mw, rotatableBonds: d.NumRotatableBonds, aromaticProportion });

    const { sites, permanentCharge } = predictPkaSites(RDKit, mol);

    const points = [];
    for (let i = 0; i <= 70; i++) {
      const pH = i * 0.2;
      points.push({ pH, ...speciesAt(pH, sites, permanentCharge) });
    }
    // ESOL predicts the solubility of the least-ionized form. For most
    // molecules that's the neutral species; for zwitterions (where the
    // uncharged microspecies is never dominant) it's the form at the pI.
    const fNeutralMax = Math.max(...points.map((p) => p.fNeutral), 1e-12);
    const curve = points.map(({ pH, fNeutral, charge }) => {
      // Only the neutral form partitions (simple pH-partition hypothesis);
      // floor the neutral fraction so fully-ionized species stay plottable.
      const logD = clogp + Math.log10(Math.max(fNeutral, 1e-6));
      // Ionized forms raise total solubility: S = S0 / fNeutral, capped at
      // 10^4 x intrinsic since salts precipitate long before that.
      const logS = logS0 + Math.min(4, Math.log10(fNeutralMax / Math.max(fNeutral, 1e-12)));
      return { pH: round(pH, 1), logD: round(logD), charge: round(charge, 3), logS: round(logS) };
    });

    const lipinski = {
      mw: mw <= 500,
      logp: clogp <= 5,
      hbd: d.lipinskiHBD <= 5,
      hba: d.lipinskiHBA <= 10,
    };
    const violations = Object.values(lipinski).filter((ok) => !ok).length;

    const acidAtoms = sites.filter((s) => s.type === "acid").map((s) => s.atom);
    const baseAtoms = sites.filter((s) => s.type === "base").map((s) => s.atom);
    const highlightAtomColors = {};
    acidAtoms.forEach((a) => (highlightAtomColors[a] = [0.95, 0.55, 0.5]));
    baseAtoms.forEach((a) => (highlightAtomColors[a] = [0.5, 0.65, 0.98]));
    const svg = mol.get_svg_with_highlights(
      JSON.stringify({
        width: 420,
        height: 300,
        atoms: [...acidAtoms, ...baseAtoms],
        highlightAtomColors,
        highlightRadius: 0.45,
        clearBackground: false,
      })
    );

    const at74 = speciesAt(7.4, sites, permanentCharge);
    const numberedSites = sites.map((s, i) => ({ id: i + 1, ...s }));
    const species = microspeciesDistribution(
      RDKit, mol, numberedSites, permanentCharge, points.map((p) => p.pH)
    );

    return {
      smiles: mol.get_smiles(),
      inchi: mol.get_inchi() || null,
      formula: hillFormula(mol),
      svg,
      descriptors: {
        molecularWeight: round(mw, 2),
        exactMass: round(d.exactmw, 4),
        heavyAtoms: d.NumHeavyAtoms,
        hbd: d.NumHBD,
        hba: d.NumHBA,
        rotatableBonds: d.NumRotatableBonds,
        tpsa: round(d.tpsa, 1),
        rings: d.NumRings,
        aromaticRings: d.NumAromaticRings,
        fractionCsp3: round(d.FractionCSP3, 2),
        stereocenters: d.NumAtomStereoCenters,
        molarRefractivity: round(d.CrippenMR, 1),
      },
      logP: { crippen: round(clogp) },
      logD74: round(clogp + Math.log10(Math.max(at74.fNeutral, 1e-6))),
      chargeAt74: round(at74.charge, 2),
      solubility: {
        method: "ESOL (Delaney 2004)",
        intrinsicLogS: round(logS0),
        intrinsicMgPerMl: round(10 ** logS0 * mw, 4),
        class: solubilityClass(logS0),
        aromaticProportion: round(aromaticProportion, 2),
      },
      pka: {
        method: "Group-contribution rule table (approximate)",
        sites: numberedSites,
        permanentCharge,
        isoelectricPoint: isoelectricPoint(sites, permanentCharge),
      },
      lipinski: { ...lipinski, violations, passes: violations <= 1 },
      lcPhWindows: lcPhGuidance(sites),
      curve,
      species,
    };
  } finally {
    mol.delete();
  }
}

// ------------------------------------------------------------- PubChem

async function getJson(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`PubChem request failed (status ${res.status})`);
  return res.json();
}

async function pubchemCid(query, base) {
  const data = await getJson(`${base}/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`);
  return data?.IdentifierList?.CID?.[0] ?? null;
}

async function pubchemCidFromSmiles(smiles, base) {
  const data = await getJson(`${base}/rest/pug/compound/smiles/cids/JSON?smiles=${encodeURIComponent(smiles)}`);
  const cid = data?.IdentifierList?.CID?.[0];
  return cid ? cid : null; // PubChem returns CID 0 for unknown structures
}

const PROPS = "Title,IUPACName,MolecularFormula,MolecularWeight,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount";

async function pubchemProperties(cid, base) {
  // PubChem renamed IsomericSMILES -> SMILES in 2025; ask for both so either
  // generation of the API works.
  let data;
  try {
    data = await getJson(`${base}/rest/pug/compound/cid/${cid}/property/${PROPS},SMILES,ConnectivitySMILES/JSON`);
  } catch {
    data = await getJson(`${base}/rest/pug/compound/cid/${cid}/property/${PROPS},IsomericSMILES,CanonicalSMILES/JSON`);
  }
  const p = data?.PropertyTable?.Properties?.[0];
  if (!p) return null;
  return {
    ...p,
    smiles: p.SMILES || p.IsomericSMILES || p.CanonicalSMILES || p.ConnectivitySMILES,
  };
}

async function pubchemCas(cid, base) {
  try {
    const data = await getJson(`${base}/rest/pug/compound/cid/${cid}/synonyms/JSON`);
    const syns = data?.InformationList?.Information?.[0]?.Synonym || [];
    return syns.find((s) => isValidCas(s)) || null;
  } catch {
    return null;
  }
}

function flattenPugViewValues(node, out) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((n) => flattenPugViewValues(n, out));
  if (node.Value) {
    const v = node.Value;
    const text =
      v.StringWithMarkup?.map((s) => s.String).join(" ") ||
      (v.Number ? `${v.Number.join(", ")}${v.Unit ? ` ${v.Unit}` : ""}` : null);
    if (text) out.push(text.trim());
  }
  for (const key of ["Section", "Information"]) {
    if (node[key]) flattenPugViewValues(node[key], out);
  }
}

const EXPERIMENTAL_HEADINGS = [
  ["pKa", "Dissociation Constants"],
  ["logP", "LogP"],
  ["Solubility", "Solubility"],
  ["Melting point", "Melting Point"],
  ["Boiling point", "Boiling Point"],
];

async function pubchemExperimental(cid, base) {
  const results = await Promise.all(
    EXPERIMENTAL_HEADINGS.map(async ([label, heading]) => {
      try {
        const data = await getJson(
          `${base}/rest/pug_view/data/compound/${cid}/JSON?heading=${encodeURIComponent(heading)}`
        );
        const values = [];
        flattenPugViewValues(data?.Record?.Section, values);
        const unique = [...new Set(values)].slice(0, 4);
        return unique.length ? { label, values: unique } : null;
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

async function pubchem3dSdf(cid, base) {
  try {
    const res = await fetch(`${base}/rest/pug/compound/cid/${cid}/record/SDF?record_type=3d`, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function looksLikeSmiles(query) {
  if (/\s/.test(query) || CAS_RE.test(query)) return false;
  // Plain words like "caffeine" or "Aspirin" also parse as (nonsense) SMILES
  // only rarely, but require some SMILES punctuation or ring digits anyway.
  if (!/[=#()\[\]@\d]/.test(query) && !/^[BCNOPSFIclnosbr]+$/.test(query)) return false;
  const RDKit = await getRDKit();
  const mol = RDKit.get_mol(query);
  const ok = !!mol && mol.is_valid();
  mol?.delete();
  return ok;
}

export async function lookupCompound(rawQuery, opts = {}) {
  const base = opts.pubchemBase || "https://pubchem.ncbi.nlm.nih.gov";
  const query = rawQuery.trim();
  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.result;

  const inputType = CAS_RE.test(query) ? "cas" : (await looksLikeSmiles(query)) ? "smiles" : "name";
  if (inputType === "cas" && !isValidCas(query)) {
    return { found: false, reason: `"${query}" isn't a valid CAS number (checksum digit doesn't match)` };
  }

  let cid = null;
  let pubchemError = null;
  try {
    cid = inputType === "smiles" ? await pubchemCidFromSmiles(query, base) : await pubchemCid(query, base);
  } catch (err) {
    pubchemError = err.message;
  }

  if (!cid && inputType !== "smiles") {
    return {
      found: false,
      reason: pubchemError
        ? `Couldn't reach PubChem to resolve "${query}" (${pubchemError}). You can paste a SMILES string instead.`
        : `PubChem has no compound matching "${query}"`,
    };
  }

  let identity = { query, inputType, cid, name: inputType === "smiles" ? null : query };
  let structureSmiles = inputType === "smiles" ? query : null;
  let pubchemComputed = null;
  let experimental = [];
  let sdf3d = null;

  if (cid) {
    try {
      const [props, cas, exp, sdf] = await Promise.all([
        pubchemProperties(cid, base),
        pubchemCas(cid, base),
        pubchemExperimental(cid, base),
        pubchem3dSdf(cid, base),
      ]);
      if (props) {
        identity = { ...identity, name: props.Title || identity.name, iupacName: props.IUPACName || null, cas };
        structureSmiles = structureSmiles || props.smiles;
        pubchemComputed = {
          xlogp3: props.XLogP ?? null,
          tpsa: props.TPSA ?? null,
          formula: props.MolecularFormula,
          molecularWeight: props.MolecularWeight ? Number(props.MolecularWeight) : null,
        };
      } else {
        identity.cas = cas;
      }
      experimental = exp;
      sdf3d = sdf;
    } catch (err) {
      if (!structureSmiles) return { found: false, reason: `PubChem lookup failed: ${err.message}` };
    }
  }

  if (!structureSmiles) {
    return { found: false, reason: `PubChem returned no structure for "${query}"` };
  }

  let computed;
  try {
    computed = await computeProperties(structureSmiles);
  } catch (err) {
    return { found: false, reason: err.message };
  }

  const result = {
    found: true,
    identity: { ...identity, pubchemUrl: cid ? `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}` : null },
    ...computed,
    logP: { ...computed.logP, xlogp3: pubchemComputed?.xlogp3 ?? null },
    experimental,
    sdf3d,
  };

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(cacheKey, { result, cachedAt: Date.now() });
  return result;
}
