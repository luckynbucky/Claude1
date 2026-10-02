import { PKA_GROUPS } from "./rules.js";

// Turns one ionizable atom into a fixed-length vector of numbers — the input
// to the pKa model.
//
// This file is the ONLY featurizer: ml/featurize.mjs runs it in Node to build
// the training table, and the app runs the same code in the browser at
// prediction time. Having one implementation rules out "train/serve skew"
// (features computed slightly differently in training vs. production), which
// silently wrecks a model's accuracy.
//
// The idea mirrors how chemists reason about pKa: start from the group type,
// then look at what surrounds it. Electron-withdrawing atoms (O, N, halogens,
// carbonyls) near an acid stabilise its anion and lower the pKa; the effect
// fades with distance. So we count what sits 1, 2, 3 and 4 bonds away.

const SHELLS = [1, 2, 3, 4];

const SHELL_FEATURES = [
  ["C", (a) => a.z === 6],
  ["N", (a) => a.z === 7],
  ["O", (a) => a.z === 8],
  ["S", (a) => a.z === 16],
  ["P", (a) => a.z === 15],
  ["F", (a) => a.z === 9],
  ["Cl", (a) => a.z === 17],
  ["Br_I", (a) => a.z === 35 || a.z === 53],
  ["aromatic", (a) => a.aromatic],
  ["carbonyl_like", (a) => a.doubleToO], // C=O, S=O, N=O, P=O centres
  ["triple", (a) => a.triple], // nitriles, alkynes
  ["sp3_C", (a) => a.z === 6 && !a.aromatic && !a.unsat],
  ["pos", (a) => a.chg > 0],
  ["neg", (a) => a.chg < 0],
  ["H", (a) => a.h], // value, not a flag: hydrogens on atoms in the shell
];

export const FEATURE_NAMES = [
  "is_acid",
  "base_pka",
  ...PKA_GROUPS.map((g) => `group=${g}`),
  "site_Z",
  "site_H",
  "site_charge",
  "site_degree",
  "site_aromatic",
  "site_in_ring",
  "site_ring_size",
  ...SHELLS.flatMap((d) => SHELL_FEATURES.map(([name]) => `d${d}_${name}`)),
  "heavy_atoms",
  "aromatic_fraction",
  "n_acid_sites",
  "n_base_sites",
];

// Parse RDKit's JSON into a plain graph: atoms with the properties above and
// an adjacency list. Explicit hydrogens are folded into their heavy atom.
export function molGraph(mol) {
  const json = JSON.parse(mol.get_json());
  const m = json.molecules[0];
  const da = json.defaults.atom;
  const db = json.defaults.bond;
  const ext = (m.extensions || []).find((e) => e.name === "rdkitRepresentation") || {};
  const aromatic = new Set(ext.aromaticAtoms || []);

  const atoms = m.atoms.map((a, i) => ({
    z: a.z ?? da.z,
    h: a.impHs ?? da.impHs,
    chg: a.chg ?? da.chg,
    aromatic: aromatic.has(i),
    doubleToO: false,
    triple: false,
    unsat: aromatic.has(i),
  }));
  const adj = atoms.map(() => []);
  for (const b of m.bonds || []) {
    const [i, j] = b.atoms;
    const bo = b.bo ?? db.bo;
    if (atoms[i].z === 1 || atoms[j].z === 1) {
      if (atoms[i].z !== 1) atoms[i].h += 1;
      if (atoms[j].z !== 1) atoms[j].h += 1;
      continue;
    }
    adj[i].push(j);
    adj[j].push(i);
    if (bo >= 2) {
      atoms[i].unsat = atoms[j].unsat = true;
      if (bo === 2 && atoms[j].z === 8) atoms[i].doubleToO = true;
      if (bo === 2 && atoms[i].z === 8) atoms[j].doubleToO = true;
    }
    if (bo === 3) atoms[i].triple = atoms[j].triple = true;
  }
  // Nitro/N-oxide drawn charge-separated ([N+](=O)[O-]) count as N=O too.
  atoms.forEach((a, i) => {
    if (a.z === 7 && a.chg > 0 && adj[i].some((j) => atoms[j].z === 8 && atoms[j].chg < 0)) a.doubleToO = true;
  });

  return { atoms, adj, rings: ext.atomRings || [] };
}

function bfsDistances(adj, start, maxDepth) {
  const dist = new Map([[start, 0]]);
  let frontier = [start];
  for (let d = 1; d <= maxDepth && frontier.length; d++) {
    const next = [];
    for (const i of frontier) {
      for (const j of adj[i]) {
        if (!dist.has(j)) {
          dist.set(j, d);
          next.push(j);
        }
      }
    }
    frontier = next;
  }
  return dist;
}

// site: { atom, type, groupIndex, basePka }   context: { nAcid, nBase }
export function featurizeSite(graph, site, context) {
  const { atoms, adj, rings } = graph;
  const a = atoms[site.atom];
  const heavy = atoms.filter((x) => x.z !== 1);
  const ringSizes = rings.filter((r) => r.includes(site.atom)).map((r) => r.length);

  const groupOneHot = PKA_GROUPS.map((_, i) => (i === site.groupIndex ? 1 : 0));

  const dist = bfsDistances(adj, site.atom, SHELLS.at(-1));
  const shellCounts = SHELLS.map(() => SHELL_FEATURES.map(() => 0));
  for (const [j, d] of dist) {
    if (d === 0) continue;
    SHELL_FEATURES.forEach(([name, test], k) => {
      shellCounts[d - 1][k] += name === "H" ? atoms[j].h : test(atoms[j]) ? 1 : 0;
    });
  }

  return [
    site.type === "acid" ? 1 : 0,
    site.basePka,
    ...groupOneHot,
    a.z,
    a.h,
    a.chg,
    adj[site.atom].length,
    a.aromatic ? 1 : 0,
    ringSizes.length ? 1 : 0,
    ringSizes.length ? Math.min(...ringSizes) : 0,
    ...shellCounts.flat(),
    heavy.length,
    heavy.length ? heavy.filter((x) => x.aromatic).length / heavy.length : 0,
    context.nAcid,
    context.nBase,
  ];
}
