/**
 * Carga `.env` en process.env (solo main). No pisa variables ya definidas.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadEnvFiles(candidates: string[]): void {
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      const parsed = parseEnvFile(readFileSync(filePath, "utf8"));
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    } catch {
      /* ignore unreadable .env */
    }
  }
}

/** Busca .env junto al cwd y al path de la app. */
export function loadGeminiEnv(appPath?: string): void {
  const roots = [process.cwd()];
  if (appPath) roots.push(appPath);
  const files = roots.flatMap((root) => [
    path.join(root, ".env"),
    path.join(root, ".env.local"),
  ]);
  loadEnvFiles(files);
}
