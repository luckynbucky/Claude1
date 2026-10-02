// Step 1 of the pKa pipeline: turn the raw datasets into a feature table.
//
//   node ml/featurize.mjs        ->  ml/data/features_{train,novartis,literature}.csv
//
// Data: Baltruschat & Czodrowski, "Machine learning meets pKa" (2020),
// CC BY 4.0, https://doi.org/10.5281/zenodo.7884512. Each molecule has one
// experimental pKa and the atom it belongs to (assigned with ChemAxon
// Marvin, the engine behind Chemicalize — whose own prediction is included
// as `marvin_pKa`, a handy commercial benchmark).
//
// Featurization is done here in JavaScript, with the exact code the app runs
// (src/chem/features.js), so the model sees identical inputs in training and
// in production. Python (train_pka.py) takes it from there.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initRDKitModule from "@rdkit/rdkit";
import { detectSites } from "../src/chem/rules.js";
import { FEATURE_NAMES, featurizeSite, molGraph } from "../src/chem/features.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "data");

// Pinned to a commit so the training data can't change under us.
const COMMIT = "45e5300db2890d3de08a281e4253be2f2db69590";
const BASE = `https://raw.githubusercontent.com/czodrowskilab/Machine-learning-meets-pKa/${COMMIT}/datasets`;
const DATASETS = {
  train: "combined_training_datasets_unique_no_oe.sdf",
  novartis: "novartis_cleaned_mono_unique_notraindata.sdf",
  literature: "AvLiLuMoVe_cleaned_mono_unique_notraindata.sdf",
};

async function download(file) {
  const dest = path.join(dataDir, file);
  if (fs.existsSync(dest)) return dest;
  process.stdout.write(`Downloading ${file}... `);
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log("done");
  return dest;
}

function* readSdf(text) {
  for (const block of text.split(/^\$\$\$\$\r?$/m)) {
    const end = block.indexOf("M  END");
    if (end < 0) continue;
    const molblock = block.slice(0, end + 6).replace(/^\s*\n/, "");
    const props = {};
    for (const m of block.slice(end).matchAll(/^>\s*<([^>]+)>[^\n]*\n([^\n]*)/gm)) props[m[1]] = m[2].trim();
    yield { molblock, props };
  }
}

const csvCell = (v) => (typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const RDKit = await initRDKitModule();
fs.mkdirSync(dataDir, { recursive: true });

for (const [name, file] of Object.entries(DATASETS)) {
  const text = fs.readFileSync(await download(file), "utf8");
  const header = ["smiles", "pka", "marvin_pka", "type", "group", ...FEATURE_NAMES];
  const rows = [header.join(",")];
  const misses = [];
  let total = 0;

  for (const { molblock, props } of readSdf(text)) {
    total++;
    const mol = RDKit.get_mol(molblock);
    if (!mol || !mol.is_valid()) {
      mol?.delete();
      continue;
    }
    const atom = Number(props.marvin_atom);
    const type = props.marvin_pKa_type === "acidic" ? "acid" : "base";
    const { sites } = detectSites(RDKit, mol);
    const site = sites.find((s) => s.atom === atom && s.type === type);
    const smiles = mol.get_smiles();

    if (!site) {
      // Our rule table didn't flag this atom (or flagged it as the other
      // type). The app can't predict a site it doesn't detect, so these are
      // left out of training — but counted, because detection recall is
      // part of how good the whole system is.
      misses.push([smiles, type, atom, props.pKa].map(csvCell).join(","));
    } else {
      const context = {
        nAcid: sites.filter((s) => s.type === "acid").length,
        nBase: sites.filter((s) => s.type === "base").length,
      };
      const x = featurizeSite(molGraph(mol), site, context);
      rows.push([smiles, props.pKa, props.marvin_pKa, type, site.group, ...x].map(csvCell).join(","));
    }
    mol.delete();
  }

  fs.writeFileSync(path.join(dataDir, `features_${name}.csv`), rows.join("\n") + "\n");
  fs.writeFileSync(path.join(dataDir, `missed_${name}.csv`), ["smiles,type,atom,pka", ...misses].join("\n") + "\n");
  const kept = rows.length - 1;
  console.log(`${name}: ${kept}/${total} sites detected by the rule table (${((100 * kept) / total).toFixed(1)}%)`);
}
