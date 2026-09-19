# Tribunal Desktop (Electron)

App de escritorio **local** para automatizar, mapear y auditar resoluciones
disciplinarias deportivas. Stack: Electron + React + Vite + TypeScript + Node
`worker_threads`.

## No es el PWA

Este repo es **independiente** de `tribunal-app` (PWA Next/vinext). No uses
Google Drive: todo es disco local (`dialog.showOpenDialog` + `fs`).

## Requisitos

- Node.js ≥ 22
- Windows / macOS / Linux

## Setup (PC o laptop)

```bash
git clone https://github.com/benicioralonso-hub/tribunal-desktop.git
cd tribunal-desktop
npm install
npm run dev
```

Si clonás desde ZIP o OneDrive, **borrá** `node_modules` y corré `npm install` de nuevo
(no copies `node_modules` entre máquinas).

### Error: `Electron uninstall`

El paquete npm está, pero falta el binario nativo. En PowerShell:

```powershell
cd C:\ruta\al\tribunal-desktop
Remove-Item -Recurse -Force node_modules
npm install
npm run electron:install
npm run dev
```

Alternativa rápida (sin borrar todo):

```powershell
node node_modules\electron\install.js
npm run dev
```

## Actualizar en otra máquina (sin ZIP)

```bash
git pull
npm install   # solo si cambió package.json
npm run electron:install   # si falla Electron uninstall
npm run dev
```

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Electron + Vite en desarrollo |
| `npm run build` | Compila main / preload / renderer / workers |
| `npm run preview:ui` | Vite en :5173 — wizard en browser (mock API; Cloud Agents) |
| `npm run preview` | Preview del build Electron |

## Flujo de la app (4 estadíos)

1. **Selección** — carpeta del boletín en disco (default `G:\` en Windows)
2. **Mapeo** — pool `worker_threads` + `unpdf`: local, visitante, infractor, rol, club, fecha
3. **Auditoría IA** — Gemini (placeholder; prompt en `shared/ai/audit-prompt.ts`)
4. **Export DOCX** — placeholder (Montserrat 500 / 12 / justificado)

## Secretos

Copiá `.env.example` → `.env` (nunca commitear `.env`):

```
GEMINI_API_KEY=
```

## Estructura

```
electron/     main, preload, IPC, workers
shared/       pdf extract, mapeo clásico, prompts
src/          React wizard (renderer)
```
