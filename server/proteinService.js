const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();
const MAX_PDB_BYTES = 5 * 1024 * 1024;

async function searchUniProt(name, uniprotBase) {
  const url = `${uniprotBase}/uniprotkb/search?query=${encodeURIComponent(name)}&fields=accession,protein_name,gene_names,organism_name,reviewed&format=json&size=10`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`UniProt search failed: ${res.status}`);
  const data = await res.json();
  const results = data.results || [];
  if (results.length === 0) return null;

  const isReviewed = (r) => r.entryType?.startsWith("UniProtKB reviewed");
  const isHuman = (r) => r.organism?.scientificName === "Homo sapiens";

  return (
    results.find((r) => isReviewed(r) && isHuman(r)) ||
    results.find((r) => isReviewed(r)) ||
    results[0]
  );
}

// Uses AlphaFold DB's documented prediction API to resolve the current
// structure file location, rather than assuming a fixed file-naming pattern.
async function fetchAlphaFoldStructure(accession, alphafoldBase) {
  const apiUrl = `${alphafoldBase}/api/prediction/${accession}`;
  const apiRes = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
  if (!apiRes.ok) {
    return { ok: false, reason: `AlphaFold has no entry for ${accession} (status ${apiRes.status})` };
  }

  const predictions = await apiRes.json();
  const pdbUrl = predictions?.[0]?.pdbUrl;
  if (!pdbUrl) {
    return { ok: false, reason: `AlphaFold API returned no model for ${accession}` };
  }

  const fileRes = await fetch(pdbUrl, { signal: AbortSignal.timeout(15000) });
  if (!fileRes.ok) {
    return { ok: false, reason: `Structure file fetch failed (status ${fileRes.status})` };
  }
  const text = await fileRes.text();
  if (text.length > MAX_PDB_BYTES) {
    return { ok: false, reason: "Structure file too large" };
  }
  return { ok: true, pdbData: text };
}

export async function resolveProteinStructure(name, opts = {}) {
  const uniprotBase = opts.uniprotBase || "https://rest.uniprot.org";
  const alphafoldBase = opts.alphafoldBase || "https://alphafold.ebi.ac.uk";

  const cacheKey = name.trim().toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  let result;
  try {
    const hit = await searchUniProt(name, uniprotBase);
    if (!hit) {
      result = { found: false, reason: `No UniProt entry matched "${name}"` };
    } else {
      const accession = hit.primaryAccession;
      const structure = await fetchAlphaFoldStructure(accession, alphafoldBase);
      result = structure.ok
        ? {
            found: true,
            accession,
            proteinName: hit.proteinDescription?.recommendedName?.fullName?.value || name,
            geneName: hit.genes?.[0]?.geneName?.value || null,
            organism: hit.organism?.scientificName || null,
            source: "AlphaFold",
            pdbData: structure.pdbData,
          }
        : {
            found: false,
            reason: structure.reason,
            accession,
            uniprotName: hit.proteinDescription?.recommendedName?.fullName?.value || null,
          };
    }
  } catch (err) {
    result = { found: false, reason: err.message };
  }

  cache.set(cacheKey, { result, cachedAt: Date.now() });
  return result;
}
