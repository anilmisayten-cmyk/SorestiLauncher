import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { registerAuthHandlers } from './ipc/auth'
import { registerGameHandlers } from './ipc/game'
import { registerDownloadHandlers } from './ipc/download'
import { registerJavaHandlers } from './ipc/java'
import { registerSettingsHandlers } from './ipc/settings'
import { registerModsHandlers } from './ipc/mods'
import { initDiscord, destroyDiscord } from './ipc/discord'
// Overlay handled by Fabric mod in-game

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

// Overlay (legacy — now handled by Fabric mod in-game)
// IPC handlers kept for settings API compatibility


// Get app data path
ipcMain.handle('get-app-data-path', () => {
  return path.join(app.getPath('appData'), 'SorestiLauncher')
})

ipcMain.handle('get-app-version', () => app.getVersion())

  // Splash video ended or skipped
  ipcMain.on('splash:done', () => {
    showMainWindow()
  })

function setupBundledGame() {
  const flagPath = path.join(app.getPath('appData'), 'SorestiLauncher', '.bundled-setup-done')
  if (fs.existsSync(flagPath)) return // already done once

  try {
    const gameDir = path.join(app.getPath('appData'), 'SorestiLauncher', 'minecraft')
    const assetsDir = path.join(__dirname, '../../assets')

    // Copy vanilla 1.21.4 JAR + JSON
    const vanillaSrc = path.join(assetsDir, 'vanilla-setup')
    const versionsDir = path.join(gameDir, 'versions', '1.21.4')
    if (fs.existsSync(path.join(vanillaSrc, '1.21.4.jar'))) {
      if (!fs.existsSync(versionsDir)) fs.mkdirSync(versionsDir, { recursive: true })
      for (const file of ['1.21.4.jar', '1.21.4.json']) {
        const src = path.join(vanillaSrc, file)
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(versionsDir, file))
      }
      const idxSrc = path.join(vanillaSrc, 'assets', 'indexes')
      const idxDest = path.join(gameDir, 'assets', 'indexes')
      if (fs.existsSync(idxSrc)) {
        if (!fs.existsSync(idxDest)) fs.mkdirSync(idxDest, { recursive: true })
        for (const f of fs.readdirSync(idxSrc)) fs.copyFileSync(path.join(idxSrc, f), path.join(idxDest, f))
      }
    }

    // Copy vanilla libraries
    const vanillaLibsSrc = path.join(vanillaSrc, 'libraries')
    if (fs.existsSync(vanillaLibsSrc)) {
      const copyDir = (src: string, dest: string) => {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
        for (const e of fs.readdirSync(src, { withFileTypes: true })) {
          const s = path.join(src, e.name), d = path.join(dest, e.name)
          if (e.isDirectory()) copyDir(s, d)
          else if (!fs.existsSync(d)) fs.copyFileSync(s, d)
        }
      }
      copyDir(vanillaLibsSrc, path.join(gameDir, 'libraries'))
    }

    // Copy asset objects (icons, textures, sounds, fonts)
    const objSrc = path.join(vanillaSrc, 'assets', 'objects')
    const objDest = path.join(gameDir, 'assets', 'objects')
    if (fs.existsSync(objSrc)) {
      if (!fs.existsSync(objDest)) fs.mkdirSync(objDest, { recursive: true })
      const copyDir = (src: string, dest: string) => {
        for (const e of fs.readdirSync(src, { withFileTypes: true })) {
          const s = path.join(src, e.name), d = path.join(dest, e.name)
          if (e.isDirectory()) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); copyDir(s, d) }
          else if (!fs.existsSync(d)) fs.copyFileSync(s, d)
        }
      }
      copyDir(objSrc, objDest)
    }

    // Copy Fabric profile + libraries + overlay mod
    const fabricSrc = path.join(assetsDir, 'fabric-setup')
    if (fs.existsSync(path.join(fabricSrc, 'profile.json'))) {
      const profile = JSON.parse(fs.readFileSync(path.join(fabricSrc, 'profile.json'), 'utf-8'))
      const fabricVersionId = profile.id
      const fvDir = path.join(gameDir, 'versions', fabricVersionId)
      if (!fs.existsSync(fvDir)) fs.mkdirSync(fvDir, { recursive: true })
      if (!fs.existsSync(path.join(fvDir, `${fabricVersionId}.json`)))
        fs.writeFileSync(path.join(fvDir, `${fabricVersionId}.json`), JSON.stringify(profile, null, 2))
      if (!fs.existsSync(path.join(fvDir, `${fabricVersionId}.jar`)))
        fs.writeFileSync(path.join(fvDir, `${fabricVersionId}.jar`), '')

      const bundledLibs = path.join(fabricSrc, 'libraries')
      const libsDir = path.join(gameDir, 'libraries')
      if (fs.existsSync(bundledLibs)) {
        const copyDir = (src: string, dest: string) => {
          if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
          for (const e of fs.readdirSync(src, { withFileTypes: true })) {
            const s = path.join(src, e.name), d = path.join(dest, e.name)
            if (e.isDirectory()) copyDir(s, d)
            else if (!fs.existsSync(d)) fs.copyFileSync(s, d)
          }
        }
        copyDir(bundledLibs, libsDir)
      }

      const modsDir = path.join(gameDir, 'mods')
      const bundledMods = path.join(fabricSrc, 'mods')
      if (fs.existsSync(bundledMods)) {
        if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true })
        for (const f of fs.readdirSync(bundledMods)) {
          const dest = path.join(modsDir, f)
          fs.copyFileSync(path.join(bundledMods, f), dest)
        }
      }
    }

    // Copy bundled resource packs to game resourcepacks folder
    const respacksSrc = path.join(assetsDir, 'respacks')
    const respacksDest = path.join(gameDir, 'resourcepacks')
    if (fs.existsSync(respacksSrc)) {
      if (!fs.existsSync(respacksDest)) fs.mkdirSync(respacksDest, { recursive: true })
      for (const f of fs.readdirSync(respacksSrc)) {
        const src = path.join(respacksSrc, f)
        const dest = path.join(respacksDest, f)
        if (fs.statSync(src).isFile()) fs.copyFileSync(src, dest)
      }
    }

    // Mark done
    fs.writeFileSync(flagPath, Date.now().toString())
  } catch (e: any) {
    console.error('[setup] Bundled setup failed:', e.message)
  }
}

app.whenReady().then(() => {
  // Ensure app data dir exists
  const appDataPath = path.join(app.getPath('appData'), 'SorestiLauncher')
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true })
  }

  // Copy pre-downloaded game files (vanilla + Fabric + mod) from bundled assets
  setupBundledGame()

  createWindow()
  createSplashWindow()
  registerAuthHandlers()
  registerGameHandlers()
  registerDownloadHandlers()
  registerJavaHandlers()
  registerSettingsHandlers()
  registerModsHandlers()
  initDiscord()
  // Overlay now runs as a Fabric mod inside Minecraft

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      createSplashWindow()
    }
  })
})

app.on('window-all-closed', () => {
  destroyDiscord()
  if (process.platform !== 'darwin') app.quit()
})
