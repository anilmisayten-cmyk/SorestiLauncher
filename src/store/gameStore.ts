import { create } from 'zustand'

interface DownloadProgress {
  versionId: string
  percent: number
  downloaded: number
  total: number
  task: string
}

interface GameState {
  selectedVersion: string
  installedVersions: string[]
  isRunning: boolean
  isDownloading: boolean
  downloadProgress: DownloadProgress | null
  logs: string[]

  setSelectedVersion: (v: string) => void
  setInstalledVersions: (v: string[]) => void
  setRunning: (v: boolean) => void
  setDownloading: (v: boolean) => void
  setDownloadProgress: (p: DownloadProgress | null) => void
  addLog: (line: string) => void
  clearLogs: () => void
  loadInstalledVersions: () => Promise<void>
}

export const useGameStore = create<GameState>((set) => ({
  selectedVersion: '',
  installedVersions: [],
  isRunning: false,
  isDownloading: false,
  downloadProgress: null,
  logs: [],

  setSelectedVersion: (v) => set({ selectedVersion: v }),
  setInstalledVersions: (v) => set({ installedVersions: v }),
  setRunning: (v) => set({ isRunning: v }),
  setDownloading: (v) => set({ isDownloading: v }),
  setDownloadProgress: (p) => set({ downloadProgress: p }),
  addLog: (line) => set(s => ({ logs: [...s.logs.slice(-500), line] })),
  clearLogs: () => set({ logs: [] }),

  loadInstalledVersions: async () => {
    try {
      const versions = await window.electronAPI.getInstalledVersions()
      set({ installedVersions: versions })
      return versions
    } catch {
      return []
    }
  }
}))
