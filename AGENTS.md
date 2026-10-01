# AGENTS.md — Tribunal Desktop

Guía para agentes de IA / Cloud Agents que trabajen en este repositorio.
Repo autocontenido: **no** importar desde el monorepo PWA `tribunal-app`.

---

## 1. Qué es este producto / app

**Tribunal Desktop** (`tribunal-desktop`) es una app Electron **100% local** para
boletines disciplinarios AFA (COMET):

1. Seleccionar carpeta del boletín en disco
2. Mapear PDFs en paralelo (casos + informes)
3. Auditar campos con Gemini (o heurística local sin API key)
4. Exportar un DOCX resumen

No usa Google Drive, D1 ni servicios cloud propios. Todo es `dialog` + `fs` +
workers locales. La lógica de dominio se inspiró en `tribunal-app` (PWA) pero
este repo es independiente.

---

## 2. Stack principal

| Capa | Tecnología |
|------|------------|
| Desktop | Electron 37 (`contextIsolation`, `sandbox`, sin `nodeIntegration`) |
| UI | React 19 + Vite (`electron-vite`) |
| Lenguaje | TypeScript ESM (`"type": "module"`) |
| PDF | `unpdf` en `worker_threads` (`electron/workers/`) |
| IA | Gemini vía `shared/ai/gemini-client.ts` (solo proceso main) |
| DOCX | paquete `docx` + fuentes Montserrat en `assets/fonts/` |
| Tests | scripts `tsx` / `node:test` (sin Jest/Vitest como runner principal) |

Alias TS: `@shared/*` → `shared/*`, `@renderer/*` → `src/*`.

---

## 3. Estructura de carpetas importantes

```
electron/           proceso main, preload, IPC, workers PDF
  ipc/              stage1…4 + channels + lectura PDF
  workers/          pool + pdf-map.worker
  security.ts       webPreferences seguros (inmutables)
  preload.ts        expone window.tribunal
shared/             lógica de dominio (sin UI)
  pdf/              extracción de texto
  map/              COMET extract, empareje CASO/INFORME, tipos MappedCase
  fallo/            borrador de fallo, tipificación, render
  ai/               prompts, Gemini, heurística de género, apply audit
  docx/             build del boletín DOCX
src/                renderer React (wizard por estadíos)
  stages/           StageSelect, StageMap, StageAudit, StageExport
  bridge/           getTribunalApi + browser-mock (preview sin Electron)
  components/       WizardShell, mapa, evidencia PDF, etc.
  styles/           tokens.css + app.css
assets/fonts/       Montserrat Regular/Medium/Bold
scripts/            ensure-electron, unpack ZIP, setup Windows
.cursor/            environment.json (Cloud Agents)
```

IPC nombrado por estadío en `electron/ipc/channels.ts`
(`stage1:…`, `stage2:…`, `stage3:…`, `stage4:…`, `pdf:read-local`).

---

## 4. Cómo correr el proyecto en local

**Requisitos:** Node.js ≥ 22. Copiar `.env.example` → `.env` si se quiere IA.

```bash
npm install          # o npm ci en CI / Cloud Agents
npm run dev          # Electron + Vite (IPC real)
```

Otros comandos útiles:

| Comando | Uso |
|---------|-----|
| `npm run build` | Compilar main / preload / renderer / workers — **debe pasar** al cerrar un estadío |
| `npm run preview:ui` | Solo UI en `http://127.0.0.1:5173` con mock de `window.tribunal` |
| `npm run preview` | Preview del build Electron |
| `npm run electron:install` | Reinstalar binario Electron si falla el postinstall |

En Cloud Agents **no hay display gráfico**: usar `preview:ui` + mock
(`src/bridge/browser-mock.ts`). IPC real solo con `npm run dev` en máquina local.

Sin `GEMINI_API_KEY`, la auditoría cae a heurística local y permite continuar
sin IA. La key **nunca** debe llegar al renderer.

---

## 5. Cómo correr tests

```bash
npm test              # map + audit + docx
npm run test:map      # mapeo, empareje carpetas, filtro, borrador, tipify
npm run test:audit    # apply-audit + heurística
npm run test:docx     # generación DOCX
```

Los tests viven junto al código en `shared/**/__tests__/` y se ejecutan con
`npx tsx` (asserts de `node:assert` / `node:test`). Fixture de referencia de
mapeo: texto CASO **Bianchini** en `shared/map/__tests__/bianchini.test.ts`.

Suite E2E Electron / UI automatizada: **desconocido** (no hay Playwright/Cypress
en el repo).

---

## 6. Convenciones importantes del código

- **API renderer → main solo vía** `window.tribunal` (preload). No acceder a
  Node/`fs` desde React.
- **Dominio en `shared/`**, orquestación IPC en `electron/ipc/`, UI en `src/`.
- TypeScript **strict**; módulos ESM; preferir tipos compartidos en
  `shared/*/types.ts` y reexportar desde `channels.ts` cuando haga falta al IPC.
- Estadíos numerados (1 selección → 2 mapeo → 3 auditoría → 4 export); nuevos
  canales IPC deben seguir el prefijo `stageN:` o `pdf:`.
- Mapeo clásico (sin LLM) primero; la IA **corrige campos**, no reescribe el
  fallo.
- DOCX: Montserrat, 12pt, justificado, títulos en negrita subrayados.
- UI: tema dark con tokens en `src/styles/tokens.css` (glass / accent sky-teal).
- Comentarios y mensajes de producto suelen estar en **español**.
- Resultados IPC típicos: `{ ok: true, … } | { ok: false, error | canceled }`.

---

## 7. Qué NO se debe tocar sin cuidado

| Área | Por qué |
|------|---------|
| `shared/ai/audit-prompt.ts` (`AUDIT_SYSTEM_PROMPT`) | Prompt de Estadío 3 **inmutable**; no cambiar en runtime ni “mejorarlo” sin decisión explícita |
| `electron/security.ts` / prefs de ventana | `contextIsolation`, `sandbox`, `nodeIntegration: false` son requisitos de seguridad |
| `electron/preload.ts` surface | Ampliar la API expuesta aumenta superficie de ataque |
| `GEMINI_API_KEY` / `electron/load-env.ts` | Solo proceso main; no pasar al renderer ni al mock innecesariamente |
| `shared/map/comet-extract.ts` | Núcleo frágil del parseo COMET (~1k líneas); cambios rompen fixtures Bianchini |
| Empareje CASO + INFORME / walk de carpetas | `build-mapped-cases.ts`, `match-link-local.ts`, walk en `stage2-map.ts` definen el contrato de carpetas |
| Tipografía / layout DOCX | Convenciones fijas del producto (Montserrat 12pt, etc.) |
| Importar desde `tribunal-app` u otro monorepo | Prohibido; mantener el repo autocontenido |
| Commitear `.env` | Secretos locales; solo `.env.example` |

---

## 8. Dónde suele vivir la lógica de negocio más importante

Orden aproximado de criticidad:

1. **`shared/map/comet-extract.ts`** — extracción de hechos COMET (infractor,
   club, partido, rol, fecha, tipo de evento, …)
2. **`shared/map/map-from-text.ts`** + **`sanitize.ts`** — normalización de
   nombres/roles/clubes
3. **`shared/map/build-mapped-cases.ts`** — empareje CASO/INFORME, adjuntos,
   `MappedCase`, flags `included`
4. **`shared/fallo/`** — tipificación (`tipify-tipo-evento.ts`), borrador
   automático (`build-draft.ts`, `manual-fallo.ts`), texto del fallo
   (`render-fallo.ts`)
5. **`shared/pdf/extract-text.ts`** (+ lite) — texto usable desde PDF
6. **`shared/ai/`** — auditoría Gemini, apply de correcciones, heurística de
   género
7. **`shared/docx/build-boletin-docx.ts`** — documento final exportado
8. **`electron/ipc/stage2-map.ts`** + workers — walk del disco y paralelismo;
   la semántica de negocio del mapeo sigue en `shared/map/`

La UI (`src/stages/*`) orquesta el wizard; no es la fuente de verdad del
dominio.

---

## Cloud Agents (Cursor)

Definido en `.cursor/environment.json`:

- `install` → `npm ci`
- terminal **UI Preview** → `npm run preview:ui` → `http://127.0.0.1:5173`

Al terminar trabajo de producto: `npm run build` debe pasar.
