import { test } from "node:test";
import assert from "node:assert/strict";
import { computeProperties, isValidCas, largestFragment, speciesAt, lookupCompound } from "./chemService.js";

// Reference values: experimental pKa / logP from standard compilations
// (DrugBank, Avdeef "Absorption and Drug Development"). The predictors are
// approximate, so tolerances are deliberately loose — these tests guard
// against regressions in the rule table, not chase accuracy.
const DRUGS = [
  { name: "aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O", pkas: [["acid", 3.5]], logp: 1.2 },
  { name: "ibuprofen", smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O", pkas: [["acid", 4.9]], logp: 3.97 },
  { name: "diphenhydramine", smiles: "CN(C)CCOC(c1ccccc1)c1ccccc1", pkas: [["base", 9.0]], logp: 3.27 },
  { name: "lidocaine", smiles: "CCN(CC)CC(=O)Nc1c(C)cccc1C", pkas: [["base", 7.9]], logp: 2.44 },
  { name: "paracetamol", smiles: "CC(=O)Nc1ccc(O)cc1", pkas: [["acid", 9.5]], logp: 0.46 },
  { name: "pyridine", smiles: "c1ccncc1", pkas: [["base", 5.2]], logp: 0.65 },
  { name: "caffeine", smiles: "Cn1cnc2c1c(=O)n(C)c(=O)n2C", pkas: [], logp: -0.07 },
  { name: "morphine", smiles: "CN1CC[C@]23c4c5ccc(O)c4O[C@H]2[C@@H](O)C=C[C@H]3[C@H]1C5", pkas: [["base", 8.2], ["acid", 9.9]], logp: 0.89 },
  { name: "metformin", smiles: "CN(C)C(=N)N=C(N)N", pkas: [["base", 12.4]], logp: -1.4 },
  { name: "glycine", smiles: "NCC(=O)O", pkas: [["acid", 2.3], ["base", 9.6]], logp: null }, // measured logP is of the zwitterion
];

for (const drug of DRUGS) {
  test(`pKa and logP for ${drug.name}`, async () => {
    const r = await computeProperties(drug.smiles);
    const sites = r.pka.sites.filter((s) => s.pka > 1 && s.pka < 14);
    assert.equal(sites.length, drug.pkas.length, `sites: ${JSON.stringify(sites)}`);
    for (const [type, expected] of drug.pkas) {
      const hit = sites.find((s) => s.type === type && Math.abs(s.pka - expected) <= 1.5);
      assert.ok(hit, `expected ${type} pKa near ${expected}, got ${JSON.stringify(sites)}`);
    }
    if (drug.logp !== null) assert.ok(Math.abs(r.logP.crippen - drug.logp) <= 1.5, `logP ${r.logP.crippen} vs ${drug.logp}`);
  });
}

test("ESOL solubility is in the right ballpark", async () => {
  // Experimental logS (mol/L): aspirin -1.7, ibuprofen -3.6, naphthalene -3.6
  for (const [smi, logS] of [["CC(=O)Oc1ccccc1C(=O)O", -1.7], ["CC(C)Cc1ccc(cc1)C(C)C(=O)O", -3.6], ["c1ccc2ccccc2c1", -3.6]]) {
    const r = await computeProperties(smi);
    assert.ok(Math.abs(r.solubility.intrinsicLogS - logS) <= 1.2, `${smi}: ${r.solubility.intrinsicLogS} vs ${logS}`);
  }
});

test("salts are reduced to the parent fragment", async () => {
  assert.equal(largestFragment("CN(C)C(=N)N=C(N)N.Cl"), "CN(C)C(=N)N=C(N)N");
  const r = await computeProperties("CC(=O)Oc1ccccc1C(=O)[O-].[Na+]");
  assert.equal(r.pka.sites[0].type, "acid");
  assert.equal(r.formula, "C9H7O4-");
});

test("logD of an acid falls above its pKa", async () => {
  const r = await computeProperties("CC(C)Cc1ccc(cc1)C(C)C(=O)O");
  const at = (pH) => r.curve.find((p) => Math.abs(p.pH - pH) < 0.01);
  assert.ok(at(2).logD > at(7.4).logD + 2);
  assert.ok(at(7.4).charge < -0.99);
});

test("zwitterion has an isoelectric point between its pKas", async () => {
  const r = await computeProperties("NCC(=O)O");
  assert.ok(r.pka.isoelectricPoint > 4 && r.pka.isoelectricPoint < 8);
  assert.ok(Math.abs(speciesAt(r.pka.isoelectricPoint, r.pka.sites).charge) < 1e-6);
});

test("CAS checksum validation", () => {
  assert.ok(isValidCas("50-78-2")); // aspirin
  assert.ok(isValidCas("58-08-2")); // caffeine
  assert.ok(!isValidCas("50-78-3"));
});

test("bad CAS is rejected without a network call", async () => {
  const r = await lookupCompound("50-78-3", { pubchemBase: "http://127.0.0.1:9" });
  assert.equal(r.found, false);
  assert.match(r.reason, /checksum/);
});

test("SMILES input still works when PubChem is unreachable", async () => {
  const r = await lookupCompound("CC(=O)Nc1ccc(O)cc1", { pubchemBase: "http://127.0.0.1:9" });
  assert.equal(r.found, true);
  assert.equal(r.formula, "C8H9NO2");
});
