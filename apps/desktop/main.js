/**
 * Fuse Radio Enterprise — shell Electron.
 *
 * Executa o Player da Loja em modo kiosk (tela cheia, sem chrome),
 * ideal para Smart TVs, Mini PCs e tablets dedicados.
 *
 * Uso:
 *   FUSE_PLAYER_URL=https://player.suaempresa.com/player pnpm --filter @fuse/desktop start
 */

const { app, BrowserWindow, session } = require("electron");

const PLAYER_URL = process.env.FUSE_PLAYER_URL ?? "http://localhost:3000/player";
const KIOSK = process.env.FUSE_KIOSK !== "0";

function createWindow() {
  const win = new BrowserWindow({
    kiosk: KIOSK,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: "#07070b",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Autoplay liberado: o player inicia sem gesto do usuário no kiosk.
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  win.loadURL(PLAYER_URL);

  // Recarrega automaticamente se o renderer travar (resiliência 24/7).
  win.webContents.on("render-process-gone", () => {
    win.reload();
  });
  win.webContents.on("did-fail-load", () => {
    setTimeout(() => win.loadURL(PLAYER_URL), 5000);
  });
}

app.whenReady().then(() => {
  // Permissões de mídia concedidas silenciosamente no kiosk.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === "media" || permission === "fullscreen");
  });
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
