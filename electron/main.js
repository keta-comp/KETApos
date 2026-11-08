const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
let mainWindow = null;

function dbPath() {
  return path.join(app.getPath('userData'), 'pos.db');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'POS Kassa',
    backgroundColor: '#f1f5f9',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  Menu.setApplicationMenu(null);

  if (DEV_URL) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    ipcMain.handle('db:load', () => {
      try {
        const buf = fs.readFileSync(dbPath());
        return new Uint8Array(buf);
      } catch {
        return null;
      }
    });

    ipcMain.handle('db:save', (_e, bytes) => {
      const file = dbPath();
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, Buffer.from(bytes));
      fs.renameSync(tmp, file);
      return true;
    });

    ipcMain.handle('wasm:get', () => {
      const wasmFile = path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
      return new Uint8Array(fs.readFileSync(wasmFile));
    });

    ipcMain.handle('receipt:print', async (_e, html) => {
      const win = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: true },
      });
      try {
        await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        const print = (options) =>
          new Promise((resolve) => {
            win.webContents.print(options, (success) => resolve(success));
          });
        let ok = await print({
          silent: true,
          printBackground: true,
          margins: { marginType: 'none' },
        });
        if (!ok) {
          ok = await print({ silent: false, printBackground: true });
        }
        return ok;
      } finally {
        if (!win.isDestroyed()) win.destroy();
      }
    });

    ipcMain.handle('app:version', () => app.getVersion());

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}