// SMARTS rule table for locating ionizable groups.
//
// The table does two jobs:
//   1. Site detection — which atoms can gain or lose a proton. Everything
//      downstream (the ML model, the pH curves) works per detected site.
//   2. A baseline pKa per group. The ML model (see pkaModel.js and ml/)
//      predicts a correction to this baseline; with no model loaded the
//      baseline is used as-is.

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

// Unique group names, in table order. The featurizer one-hot encodes the
// group by its index here, so append new groups at the end (or retrain).
export const PKA_GROUPS = [...new Set(PKA_RULES.map((r) => r.group))];

function substructMatches(RDKit, mol, smarts) {
  const q = RDKit.get_qmol(smarts);
  if (!q || !q.is_valid()) {
    q?.delete();
    return [];
  }
  const raw = mol.get_substruct_matches(q);
  q.delete();
  const parsed = raw && raw !== "{}" ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? parsed : [];
}

// Each atom is claimed by the first rule that matches it, so specific
// patterns (earlier in the table) win over general ones.
export function detectSites(RDKit, mol) {
  const claimed = new Set();
  const sites = [];
  for (const rule of PKA_RULES) {
    for (const match of substructMatches(RDKit, mol, rule.smarts)) {
      const atom = match.atoms[rule.site];
      if (atom === undefined || claimed.has(atom)) continue;
      claimed.add(atom);
      sites.push({
        atom,
        type: rule.type,
        group: rule.group,
        groupIndex: PKA_GROUPS.indexOf(rule.group),
        basePka: rule.pka,
      });
    }
  }
  // Quaternary ammonium: permanently cationic, no pKa.
  const permanentCharge = substructMatches(RDKit, mol, "[NX4+;H0;!$(N~[O,N])]").length;
  return { sites, permanentCharge };
}

// Repeats of the same group (e.g. the two carboxyls of a diacid) don't
// ionize at the same pH: once one is charged, the next is harder to ionize.
// Approximate with a 1-unit electrostatic step per repeat. Neither the rule
// table nor the ML model (trained on one site per molecule) sees this.
export function applyRepeatShift(sites) {
  const seen = {};
  const sorted = [...sites].sort((a, b) => (a.type === "acid" ? a.pka - b.pka : b.pka - a.pka));
  for (const s of sorted) {
    const key = `${s.type}:${s.group}`;
    const n = seen[key] || 0;
    if (n > 0) s.pka += s.type === "acid" ? n : -n;
    seen[key] = n + 1;
  }
  return sites;
}

export { substructMatches };
