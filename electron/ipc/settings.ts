import { ipcMain, app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

interface AppSettings {
  gameDir: string
  javaPath: string
  maxMemory: number
  minMemory: number
  theme: string
  language: string
  showSnapshots: boolean
  closeOnLaunch: boolean
}

const defaults: AppSettings = {
  gameDir: '',
  javaPath: 'java',
  maxMemory: 2048,
  minMemory: 512,
  theme: 'dark',
  language: 'tr',
  showSnapshots: false,
  closeOnLaunch: false
}

function getSettingsPath() {
  return path.join(app.getPath('appData'), 'SorestiLauncher', 'settings.json')
}

function loadSettings(): AppSettings {
  const p = getSettingsPath()
  if (!fs.existsSync(p)) return defaults
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(p, 'utf-8')) }
  } catch { return defaults }
}

function saveSettings(s: AppSettings) {
  const p = getSettingsPath()
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(p, JSON.stringify(s, null, 2))
}

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:save', (_e, s: AppSettings) => {
    saveSettings(s)
    return true
  })
}
