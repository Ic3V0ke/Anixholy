'use strict';

const { ipcMain, app } = require('electron');
const state = require('../lib/app-state');
const config = require('../lib/config-store');

function register() {

ipcMain.on('window:minimize', () => state.mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (state.mainWindow?.isMaximized()) state.mainWindow.unmaximize();
  else state.mainWindow?.maximize();
});
ipcMain.on('window:close', () => {
  if (config.getMinimizeToTray()) {
    state.mainWindow?.hide();
  } else {
    state.isQuitting = true;
    app.quit();
  }
});

// Явная установка fullscreen главного окна (выход из плеера снимает fullscreen)
ipcMain.on('window:setFullScreen', (_, flag) => {
  const win = state.mainWindow;
  if (!win || win.isDestroyed()) return;
  const next = !!flag;
  if (win.isFullScreen() !== next) win.setFullScreen(next);
});
}

module.exports = { register };
