import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve("electron/main.ts"),
          "pdf-map.worker": resolve("electron/workers/pdf-map.worker.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // CJS .js: compatible con sandbox + contextBridge
      rollupOptions: {
        input: {
          index: resolve("electron/preload.ts"),
        },
        output: {
          format: "cjs",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  renderer: {
    root: resolve("src"),
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/index.html"),
        },
      },
    },
    plugins: [react()],
  },
});
