/**
 * Emparejamiento local CASO ↔ INFORME (subconjunto de match-link sin Drive).
 */

export function normalizePathToken(value: string): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("es-AR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function isInformesFolderName(name: string): boolean {
  return /^informes?$/i.test(normalizePathToken(name));
}

/** Leaf de partido desde nombre de carpeta o stem de archivo. */
export function matchLeafFromName(
  folderName: string,
  fileName?: string,
): string {
  const n = normalizePathToken(folderName);
  if (n && !isInformesFolderName(folderName) && !/^casos?$/i.test(n)) {
    return n.replace(/(?:[,;\s\-–—])+\d{4,6}(?:[./]\d+)?\s*$/, "").trim() || n;
  }
  const stem = String(fileName || "")
    .replace(/\.pdf$/i, "")
    .trim();
  if (!stem) return n;
  const cleaned = stem
    .replace(/^(informes?|match[\s_\-]*report|infos?|casos?)\s*[-_]?\s*/i, "")
    .trim();
  return normalizePathToken(cleaned || stem);
}
