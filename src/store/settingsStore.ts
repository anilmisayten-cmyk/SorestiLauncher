import { create } from 'zustand'

export interface AppSettings {
  gameDir: string
  javaPath: string
  maxMemory: number
  minMemory: number
  theme: string
  language: string
  showSnapshots: boolean
  closeOnLaunch: boolean
  overlayEnabled: boolean
  overlayShowCPS: boolean
  overlayShowKeystrokes: boolean
  overlayShowCursor: boolean
}

function detectLang(): string {
  try {
    const saved = localStorage.getItem('soresti_lang')
    if (saved === 'en' || saved === 'tr') return saved
  } catch {}
  return 'tr'
}

const defaults: AppSettings = {
  gameDir: '',
  javaPath: 'java',
  maxMemory: 2048,
  minMemory: 512,
  theme: 'dark',
  language: detectLang(),
  showSnapshots: false,
  closeOnLaunch: false,
  overlayEnabled: true,
  overlayShowCPS: true,
  overlayShowKeystrokes: true,
  overlayShowCursor: true
}

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  save: (s: Partial<AppSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaults,
  loaded: false,

  load: async () => {
    try {
      const s = await window.electronAPI.getSettings()
      set({ settings: { ...defaults, ...s }, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  save: async (partial) => {
    const updated = { ...get().settings, ...partial }
    set({ settings: updated })
    try {
      await window.electronAPI.saveSettings(updated)
    } catch {}
  }
}))
