/**
 * Carpeta raíz / categoría encima del partido
 * (p.ej. "0001 PRIMERA LPF", "0002", "4TA").
 */
import path from "node:path";

export function categoryRootFromFolderPath(
  folderPath: string | null | undefined,
): string | null {
  if (!folderPath) return null;
  const parent = path.dirname(folderPath);
  const base = path.basename(parent);
  if (!base || base === "." || base === "/" || base === path.sep) return null;
  // Evitar devolver el root del boletín como categoría si parece drive/root
  if (/^[A-Za-z]:\\?$/.test(base)) return null;
  return base;
}
