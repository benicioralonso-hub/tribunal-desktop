import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Browser-only preview of the React wizard (no Electron shell).
 * Used by Cloud Agents and local `npm run preview:ui`.
 */
export default defineConfig({
  root: resolve("src"),
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": resolve("shared"),
      "@electron": resolve("electron"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
});
