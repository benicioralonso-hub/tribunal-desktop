#!/usr/bin/env node
/**
 * Descomprime un ZIP oficial de Electron en node_modules/electron/dist
 * y escribe path.txt sin \r\n.
 *
 * Uso:
 *   node scripts/unpack-electron-zip.mjs path\to\electron-v37.10.3-win32-x64.zip
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);

async function main() {
  const zipPath = process.argv[2];
  if (!zipPath) {
    console.error(
      "Uso: node scripts/unpack-electron-zip.mjs <ruta-al-zip-de-electron>",
    );
    process.exit(1);
  }

  const absZip = path.resolve(zipPath);
  if (!fs.existsSync(absZip)) {
    console.error("No existe el ZIP:", absZip);
    process.exit(1);
  }

  const st = fs.statSync(absZip);
  if (!st.isFile() || st.size < 1_000_000) {
    console.error(
      "El archivo no parece un ZIP válido de Electron (tamaño:",
      st.size,
      "bytes). Re-descargá el .zip completo.",
    );
    process.exit(1);
  }

  const electronDir = path.dirname(require.resolve("electron/package.json"));
  const distDir = path.join(electronDir, "dist");
  const pathTxt = path.join(electronDir, "path.txt");

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  console.log("[unpack-electron] Extrayendo", absZip, "→", distDir);
  const extract = require("extract-zip");
  await extract(absZip, { dir: distDir });

  const platform =
    process.env.npm_config_platform ||
    (os.platform() === "win32" ? "win32" : os.platform());
  const exeName =
    platform === "win32"
      ? "electron.exe"
      : platform === "darwin"
        ? "Electron.app/Contents/MacOS/Electron"
        : "electron";

  const exePath = path.join(distDir, exeName);
  if (!fs.existsSync(exePath)) {
    console.error("El ZIP no contiene", exeName, "en", distDir);
    console.error("Contenido:", fs.readdirSync(distDir).slice(0, 20));
    process.exit(1);
  }

  // Sin newline — evita spawn ...electron.exe\r\n en Windows
  fs.writeFileSync(pathTxt, exeName, { encoding: "utf8" });

  const { version } = require(path.join(electronDir, "package.json"));
  fs.writeFileSync(path.join(distDir, "version"), version, {
    encoding: "utf8",
  });

  console.log("[unpack-electron] OK →", exePath);
  console.log("[unpack-electron] path.txt =", JSON.stringify(exeName));

  const check = spawnSync(exePath, ["--version"], { encoding: "utf8" });
  if (check.status === 0) {
    console.log("[unpack-electron] version:", (check.stdout || "").trim());
  }
}

main().catch((err) => {
  console.error("[unpack-electron] FAIL:", err);
  process.exit(1);
});
