import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { registerAuthHandlers } from './ipc/auth'
import { registerGameHandlers } from './ipc/game'
import { registerDownloadHandlers } from './ipc/download'
import { registerJavaHandlers } from './ipc/java'
import { registerSettingsHandlers } from './ipc/settings'
import { registerModsHandlers } from './ipc/mods'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 854,
    height: 480,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  const videoPath = path.join(__dirname, '../../assets/intro.mp4')
  splashWindow.loadFile(path.join(__dirname, '../../dist/renderer/splash.html'), {
    query: { video: videoPath }
  })
  splashWindow.setMenuBarVisibility(false)
}

function showMainWindow() {
  if (splashWindow) {
    splashWindow.close()
    splashWindow = null
  }
  if (mainWindow) {
    mainWindow.show()
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    show: false,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '../../assets/icon.ico')
  })

  // Load renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Window control IPC
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window-close', () => mainWindow?.close())
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false)

// File dialogs
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

// Open external links
ipcMain.on('open-external', (_event, url: string) => {
  shell.openExternal(url)
})

// Get app data path
ipcMain.handle('get-app-data-path', () => {
  return path.join(app.getPath('appData'), 'SorestiLauncher')
})

ipcMain.handle('get-app-version', () => app.getVersion())

// Splash video ended or skipped
ipcMain.on('splash:done', () => {
  showMainWindow()
})

app.whenReady().then(() => {
  // Ensure app data dir exists
  const appDataPath = path.join(app.getPath('appData'), 'SorestiLauncher')
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true })
  }

  createWindow()
  createSplashWindow()
  registerAuthHandlers()
  registerGameHandlers()
  registerDownloadHandlers()
  registerJavaHandlers()
  registerSettingsHandlers()
  registerModsHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      createSplashWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
