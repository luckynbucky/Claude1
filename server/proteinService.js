const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

async function searchUniProt(name, uniprotBase) {
  const url = `${uniprotBase}/uniprotkb/search?query=${encodeURIComponent(name)}&fields=accession,protein_name,gene_names,organism_name,reviewed&format=json&size=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`UniProt search failed: ${res.status}`);
  const data = await res.json();
  const results = data.results || [];
  if (results.length === 0) return null;
  return results.find((r) => r.entryType?.startsWith("UniProtKB reviewed")) || results[0];
}

const MAX_PDB_BYTES = 5 * 1024 * 1024;

async function fetchStructureText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const text = await res.text();
  if (text.length > MAX_PDB_BYTES) return null;
  return text;
}

export async function resolveProteinStructure(name, opts = {}) {
  const uniprotBase = opts.uniprotBase || "https://rest.uniprot.org";
  const alphafoldBase = opts.alphafoldBase || "https://alphafold.ebi.ac.uk";

  const cacheKey = name.trim().toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  const hit = await searchUniProt(name, uniprotBase);
  let result;

  if (!hit) {
    result = { found: false };
  } else {
    const accession = hit.primaryAccession;
    const structureUrl = `${alphafoldBase}/files/AF-${accession}-F1-model_v4.pdb`;
    const pdbData = await fetchStructureText(structureUrl);
    result = pdbData
      ? {
          found: true,
          accession,
          proteinName: hit.proteinDescription?.recommendedName?.fullName?.value || name,
          geneName: hit.genes?.[0]?.geneName?.value || null,
          organism: hit.organism?.scientificName || null,
          source: "AlphaFold",
          pdbData,
        }
      : { found: false };
  }

  cache.set(cacheKey, { result, cachedAt: Date.now() });
  return result;
}
