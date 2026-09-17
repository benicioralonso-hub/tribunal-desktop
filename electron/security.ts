import type { BrowserWindowConstructorOptions } from "electron";

/** Preferencias de seguridad inmutables para todas las ventanas. */
export const SECURE_WEB_PREFS: NonNullable<
  BrowserWindowConstructorOptions["webPreferences"]
> = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
};
