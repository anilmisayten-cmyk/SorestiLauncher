import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  sendSplashDone: () => ipcRenderer.send('splash:done'),
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // App info
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAssetPath: (filename: string) => ipcRenderer.invoke('get-asset-path', filename),

  // Dialogs
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // External links
  openExternal: (url: string) => ipcRenderer.send('open-external', url),

  // Auth
  microsoftLogin: () => ipcRenderer.invoke('auth:microsoft-login'),
  offlineLogin: (username: string) => ipcRenderer.invoke('auth:offline-login', username),
  elybyLogin: (username: string, password?: string) => ipcRenderer.invoke('auth:elyby-login', username, password),
  logout: (uuid: string) => ipcRenderer.invoke('auth:logout', uuid),
  getAccounts: () => ipcRenderer.invoke('auth:get-accounts'),
  
  // Skins
  selectLocalSkin: (username: string) => ipcRenderer.invoke('skin:select-local', username),

  // Versions
  getVersionList: () => ipcRenderer.invoke('game:get-version-list'),
  installVersion: (versionId: string) => ipcRenderer.invoke('game:install-version', versionId),
  getInstalledVersions: () => ipcRenderer.invoke('game:get-installed-versions'),
  deleteVersion: (versionId: string) => ipcRenderer.invoke('game:delete-version', versionId),

  // Launch
  launchGame: (options: LaunchOptions) => ipcRenderer.invoke('game:launch', options),
  killGame: () => ipcRenderer.send('game:kill'),

  // Download progress events
  onDownloadProgress: (callback: (data: DownloadProgress) => void) =>
    ipcRenderer.on('download:progress', (_e, data) => callback(data)),
  onDownloadComplete: (callback: (versionId: string) => void) =>
    ipcRenderer.on('download:complete', (_e, id) => callback(id)),
  onGameLog: (callback: (line: string) => void) =>
    ipcRenderer.on('game:log', (_e, line) => callback(line)),
  onGameExit: (callback: (code: number) => void) =>
    ipcRenderer.on('game:exit', (_e, code) => callback(code)),
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),

  // Java
  checkJava: () => ipcRenderer.invoke('java:check'),
  installJava: () => ipcRenderer.invoke('java:install'),

  // Mods
  searchMods: (query: string, gameVersion?: string, loader?: string) => ipcRenderer.invoke('mods:search', query, gameVersion, loader),
  getModVersions: (projectId: string, gameVersion?: string, loader?: string) => ipcRenderer.invoke('mods:get-versions', projectId, gameVersion, loader),
  downloadMod: (downloadUrl: string, fileName: string, versionId: string) => ipcRenderer.invoke('mods:download', downloadUrl, fileName, versionId),
  getInstalledMods: () => ipcRenderer.invoke('mods:get-installed'),
  deleteMod: (fileName: string) => ipcRenderer.invoke('mods:delete', fileName),
  openModsFolder: () => ipcRenderer.invoke('mods:open-folder'),
  onModProgress: (callback: (data: any) => void) => ipcRenderer.on('mods:progress', (_e, data) => callback(data)),
  onModDone: (callback: (data: any) => void) => ipcRenderer.on('mods:done', (_e, data) => callback(data)),
  // Bundled Soresti mods
  getBundledMods: () => ipcRenderer.invoke('mods:get-bundled'),
  setBundledModEnabled: (fileName: string, enabled: boolean) => ipcRenderer.invoke('mods:set-bundled-enabled', fileName, enabled),
  // Fabric
  getFabricLoaders: (gameVersion: string) => ipcRenderer.invoke('fabric:get-loaders', gameVersion),
  installFabric: (gameVersion: string, loaderVersion: string) => ipcRenderer.invoke('fabric:install', gameVersion, loaderVersion),
  ensureFabric: (gameVersion: string) => ipcRenderer.invoke('game:ensure-fabric', gameVersion),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),

  // Overlay handled by Fabric mod in-game (no Electron overlay)
})

interface LaunchOptions {
  versionId: string
  accountUUID: string
  gameDir: string
  javaPath: string
  maxMemory: number
  minMemory: number
}

interface DownloadProgress {
  versionId: string
  percent: number
  downloaded: number
  total: number
  task: string
}

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
