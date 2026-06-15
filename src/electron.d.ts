interface Window {
  electronAPI: {
    sendSplashDone: () => void
    minimize: () => void
    maximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    getAppDataPath: () => Promise<string>
    getAppVersion: () => Promise<string>
    openDirectory: () => Promise<string | null>
    openExternal: (url: string) => void
    microsoftLogin: () => Promise<any>
    offlineLogin: (username: string) => Promise<any>
    elybyLogin: (username: string, password?: string) => Promise<any>
    logout: (uuid: string) => Promise<boolean>
    getAccounts: () => Promise<any[]>
    getVersionList: () => Promise<any>
    installVersion: (versionId: string) => Promise<any>
    getInstalledVersions: () => Promise<string[]>
    deleteVersion: (versionId: string) => Promise<boolean>
    launchGame: (options: any) => Promise<any>
    killGame: () => void
    onDownloadProgress: (cb: (data: any) => void) => void
    onDownloadComplete: (cb: (id: string) => void) => void
    onGameLog: (cb: (line: string) => void) => void
    onGameExit: (cb: (code: number) => void) => void
    removeAllListeners: (channel: string) => void
    checkJava: () => Promise<any>
    installJava: () => Promise<any>
    searchModrinth: (query: string, type: string) => Promise<any>
    getSettings: () => Promise<any>
    saveSettings: (settings: any) => Promise<boolean>

    // Overlay
    overlayToggle: () => void
    overlayShow: () => void
    overlayHide: () => void
    onOverlayInput: (cb: (data: any) => void) => void
  }
}
