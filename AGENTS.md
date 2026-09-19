# AGENTS.md — Tribunal Desktop

Contexto para Cloud Agents / Cursor que trabajen en este repo.

## Objetivo

App Electron **100% local** para boletines disciplinarios AFA: seleccionar
carpeta, mapear PDFs COMET en paralelo, auditar con Gemini, exportar DOCX.
Sin Google Drive, sin D1, sin el monorepo PWA.

## Stack fijo

- Electron + React 19 + Vite (`electron-vite`)
- TypeScript ESM
- `worker_threads` para PDFs (`unpdf`)
- UI dark (tokens tipo dark-preview: `--paper #1e1e1e`, `--ink #ececec`)

## Seguridad

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- API solo vía preload `window.tribunal`
- `GEMINI_API_KEY` solo en proceso main

## Estadíos

| # | IPC / módulo | Estado |
|---|--------------|--------|
| 1 | `electron/ipc/stage1-select.ts` | Hecho — `dialog` + `fs` |
| 2 | `electron/ipc/stage2-map.ts` + `workers/pdf-map.worker.ts` | Hecho — mapeo clásico |
| 3 | `shared/ai/audit-prompt.ts` + stage3 IPC | Pendiente — no reescribir fallos |
| 4 | DOCX Montserrat Bold 500, 12pt, justificado, títulos subrayados | Pendiente |

### System prompt Estadío 3 (inmutable)

```
Eres un auditor estricto. NO reescribas el fallo. Tu única tarea es buscar errores del mapeo previo: corrige faltas de ortografía, tipeo y discordancias de género (ej. jugador vs. jugadora)
```

## Mapeo (Estadío 2)

- Walk recursivo de PDFs bajo la carpeta del boletín
- Pool = `os.cpus().length`
- Texto: `shared/pdf/extract-text.ts` (unpdf + fallbacks title/ASCII + `trimPdfTextForRemap`)
- Hechos: `shared/map/comet-extract.ts` → `map-from-text.ts`
  (Infractor, Club, Partido local/visitante, Tipo de infractor, fecha)
- Empareja CASO + INFORME por carpeta; INFORMEs bajo `Informes/` por leaf de partido
- Fixture: `npm run test:map` (Bianchini)

## Origen del dominio

La lógica de negocio se inspiró en el PWA `tribunal-app` (`lib/pdf-extract`,
`comet-extract`, `codigos-catalog`, `llm-client`, `boletin-docx`) pero este
repo es autocontenido: no importar desde ese monorepo.

## Cloud Agents (Cursor)

Entorno en `.cursor/environment.json`:

- `install` → `npm ci`
- terminal **UI Preview** → `npm run preview:ui` en `http://127.0.0.1:5173`
- Sin display gráfico: el preview del wizard usa un mock de `window.tribunal`
  (ver `src/bridge/browser-mock.ts`). IPC real solo con Electron local (`npm run dev`).

Al terminar un estadío: `npm run build` debe pasar.
