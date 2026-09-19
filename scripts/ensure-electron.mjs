#!/usr/bin/env node
/**
 * Asegura el binario nativo de Electron.
 * - Detecta dist incompleto (p. ej. solo locales/)
 * - Re-descarga con force_no_cache
 * - Normaliza path.txt sin \r\n (rompe spawn en Windows)
 */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);

function electronPackageDir() {
  return path.dirname(require.resolve("electron/package.json"));
}

function platformPath() {
  const platform = process.env.npm_config_platform || os.platform();
  switch (platform) {
    case "mas":
    case "darwin":
      return "Electron.app/Contents/MacOS/Electron";
    case "win32":
      return "electron.exe";
    default:
      return "electron";
  }
}

function normalizePathTxt(electronDir) {
  const pathTxt = path.join(electronDir, "path.txt");
  if (!fs.existsSync(pathTxt)) return null;
  const raw = fs.readFileSync(pathTxt, "utf8").replace(/\r?\n/g, "").trim();
  if (!raw) {
    fs.unlinkSync(pathTxt);
    return null;
  }
  // Escritura sin newline final — crítico en Windows
  fs.writeFileSync(pathTxt, raw, { encoding: "utf8" });
  return raw;
}

function binaryExists(electronDir) {
  const rel = normalizePathTxt(electronDir) || platformPath();
  const abs = path.join(electronDir, "dist", rel);
  return fs.existsSync(abs);
}

function wipeDist(electronDir) {
  const dist = path.join(electronDir, "dist");
  const pathTxt = path.join(electronDir, "path.txt");
  fs.rmSync(dist, { recursive: true, force: true });
  fs.rmSync(pathTxt, { force: true });
}

function runInstall(electronDir) {
  const installJs = path.join(electronDir, "install.js");
  const env = {
    ...process.env,
    force_no_cache: "true",
  };
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;
  console.log("[ensure-electron] Descargando binario de Electron…");
  const result = spawnSync(process.execPath, [installJs], {
    env,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(
      `electron/install.js falló (exit ${result.status ?? "null"}). ` +
        "Revisá red/firewall hacia github.com/electron/electron/releases",
    );
  }
}

function main() {
  let electronDir;
  try {
    electronDir = electronPackageDir();
  } catch {
    console.error(
      "[ensure-electron] Paquete electron no instalado. Corré: npm install",
    );
    process.exit(1);
  }

  if (binaryExists(electronDir)) {
    normalizePathTxt(electronDir);
    console.log("[ensure-electron] OK — binario presente");
    process.exit(0);
  }

  console.warn(
    "[ensure-electron] Binario ausente o dist incompleto — reinstalando",
  );
  wipeDist(electronDir);
  runInstall(electronDir);
  normalizePathTxt(electronDir);

  if (!binaryExists(electronDir)) {
    console.error(`
[ensure-electron] FALLÓ la descarga automática.

Plan manual (Windows):
1. Bajá:
   https://github.com/electron/electron/releases/download/v37.10.3/electron-v37.10.3-win32-x64.zip
2. Corré: npm run electron:unpack-zip -- %USERPROFILE%\\Downloads\\electron-v37.10.3-win32-x64.zip
`);
    process.exit(1);
  }

  console.log("[ensure-electron] OK — binario instalado");
}

main();
