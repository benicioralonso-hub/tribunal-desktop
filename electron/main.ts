import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerStage1Ipc } from "./ipc/stage1-select";
import { registerStage2Ipc } from "./ipc/stage2-map";
import { SECURE_WEB_PREFS } from "./security";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "Tribunal Disciplinario — Local",
    backgroundColor: "#1e1e1e",
    show: false,
    webPreferences: {
      ...SECURE_WEB_PREFS,
      preload: path.join(__dirname, "../preload/index.js"),
    },
  });

  win.once("ready-to-show", () => win.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  registerStage1Ipc();
  registerStage2Ipc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
