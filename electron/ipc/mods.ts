import { ipcMain, app, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as https from 'https'

function getGameDir(): string {
  return path.join(app.getPath('appData'), 'SorestiLauncher', 'minecraft')
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'SorestiLauncher/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) return resolve(fetchJson(res.headers.location!))
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
      res.on('error', reject)
    })
    req.on('error', reject)
  })
}

function downloadFile(url: string, dest: string, onProgress?: (dl: number, tot: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) return resolve()
    const dir = path.dirname(dest)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const tmp = dest + '.tmp'
    const file = fs.createWriteStream(tmp)
    const req = https.get(url, { headers: { 'User-Agent': 'SorestiLauncher/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        try { fs.unlinkSync(tmp) } catch {}
        return resolve(downloadFile(res.headers.location!, dest, onProgress))
      }
      if (res.statusCode !== 200) {
        file.close()
        try { fs.unlinkSync(tmp) } catch {}
        return reject(new Error(`HTTP ${res.statusCode} — ${url}`))
      }
      const tot = parseInt(res.headers['content-length'] || '0', 10)
      let dl = 0
      res.on('data', (chunk: Buffer) => { dl += chunk.length; onProgress?.(dl, tot) })
      res.pipe(file)
      file.on('finish', () => {
        file.close()
        try { fs.renameSync(tmp, dest) } catch {}
        resolve()
      })
      res.on('error', () => { try { fs.unlinkSync(tmp) } catch {}; reject(new Error('Download failed')) })
    })
    req.on('error', () => { try { fs.unlinkSync(tmp) } catch {}; reject(new Error('Network error')) })
  })
}

export function registerModsHandlers() {
  // ─── Modrinth Mod Search ───
  ipcMain.handle('mods:search', async (_event, query: string, gameVersion?: string, loader?: string) => {
    try {
      const facets: string[][] = [['project_type:mod']]
      if (gameVersion) facets.push([`versions:${gameVersion}`])
      if (loader && loader !== 'all') facets.push([`categories:${loader}`])
      const facetsStr = JSON.stringify(facets)
      const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=24&facets=${encodeURIComponent(facetsStr)}&index=downloads`
      return await fetchJson(url)
    } catch (e: any) {
      throw new Error('Modrinth\'e bağlanılamadı')
    }
  })

  // ─── Get mod versions for download ───
  ipcMain.handle('mods:get-versions', async (_event, projectId: string, gameVersion?: string, loader?: string) => {
    try {
      let url = `https://api.modrinth.com/v2/project/${projectId}/version`
      const params: string[] = []
      if (gameVersion) params.push(`game_versions=["${gameVersion}"]`)
      if (loader && loader !== 'all') params.push(`loaders=["${loader}"]`)
      if (params.length > 0) url += '?' + params.join('&')
      return await fetchJson(url)
    } catch (e: any) {
      throw new Error('Mod versiyonları alınamadı')
    }
  })

  // ─── Download a mod JAR into mods/ folder ───
  ipcMain.handle('mods:download', async (event, downloadUrl: string, fileName: string, versionId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
    const gameDir = getGameDir()
    const modsDir = path.join(gameDir, 'mods')
    if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true })

    const dest = path.join(modsDir, fileName)
    if (fs.existsSync(dest)) return { success: true, path: dest, alreadyExists: true }

    let lastPct = 0
    await downloadFile(downloadUrl, dest, (dl, tot) => {
      const pct = Math.round((dl / (tot || 1)) * 100)
      if (pct !== lastPct) {
        lastPct = pct
        win?.webContents.send('mods:progress', { fileName, percent: pct, downloaded: dl, total: tot })
      }
    })
    win?.webContents.send('mods:done', { fileName })
    return { success: true, path: dest }
  })

  // ─── Get installed mods ───
  ipcMain.handle('mods:get-installed', async () => {
    const modsDir = path.join(getGameDir(), 'mods')
    if (!fs.existsSync(modsDir)) return []
    return fs.readdirSync(modsDir)
      .filter(f => f.endsWith('.jar'))
      .map(f => {
        const stat = fs.statSync(path.join(modsDir, f))
        return { name: f, size: stat.size, modified: stat.mtime }
      })
  })

  // ─── Delete a mod ───
  ipcMain.handle('mods:delete', async (_event, fileName: string) => {
    const filePath = path.join(getGameDir(), 'mods', fileName)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    return true
  })

  // ─── Open mods folder ───
  ipcMain.handle('mods:open-folder', async () => {
    const modsDir = path.join(getGameDir(), 'mods')
    if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true })
    const { shell } = require('electron')
    shell.openPath(modsDir)
    return true
  })

  // ─── Fabric: Get available loader versions ───
  ipcMain.handle('fabric:get-loaders', async (_event, gameVersion: string) => {
    try {
      return await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`)
    } catch {
      throw new Error(`Fabric ${gameVersion} için yükleyici bulunamadı`)
    }
  })

  // ─── Fabric: Install loader ───
  ipcMain.handle('fabric:install', async (event, gameVersion: string, loaderVersion: string) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
    const gameDir = getGameDir()
    const fabricVersionId = `fabric-loader-${loaderVersion}-${gameVersion}`
    const versionDir = path.join(gameDir, 'versions', fabricVersionId)

    if (fs.existsSync(path.join(versionDir, `${fabricVersionId}.json`))) {
      return { success: true, versionId: fabricVersionId, alreadyInstalled: true }
    }

    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })

    win?.webContents.send('mods:progress', { fileName: fabricVersionId, percent: 5, downloaded: 0, total: 100 })

    // Get Fabric profile JSON
    const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${gameVersion}/${loaderVersion}/profile/json`
    const fabricJson = await fetchJson(profileUrl)

    // Save as version JSON
    fs.writeFileSync(path.join(versionDir, `${fabricVersionId}.json`), JSON.stringify(fabricJson, null, 2))

    win?.webContents.send('mods:progress', { fileName: fabricVersionId, percent: 20, downloaded: 0, total: 100 })

    // Download fabric libraries
    const libsDir = path.join(gameDir, 'libraries')
    const libraries = fabricJson.libraries || []
    let done = 0

    for (const lib of libraries) {
      if (!lib.url && !lib.downloads?.artifact?.url) { done++; continue }
      // Convert maven coords to path
      const [group, artifact, version] = lib.name.split(':')
      const groupPath = group.replace(/\./g, '/')
      const jarName = `${artifact}-${version}.jar`
      const libPath = path.join(libsDir, groupPath, artifact, version, jarName)
      if (!fs.existsSync(libPath)) {
        const libUrl = lib.url
          ? `${lib.url}${groupPath}/${artifact}/${version}/${jarName}`
          : lib.downloads.artifact.url
        try {
          await downloadFile(libUrl, libPath)
        } catch {}
      }
      done++
      const pct = 20 + Math.round((done / Math.max(libraries.length, 1)) * 75)
      win?.webContents.send('mods:progress', { fileName: fabricVersionId, percent: pct, downloaded: done, total: libraries.length })
    }

    // Create a dummy JAR (Fabric uses inheritsFrom, actual JAR is vanilla)
    const dummyJar = path.join(versionDir, `${fabricVersionId}.jar`)
    if (!fs.existsSync(dummyJar)) fs.writeFileSync(dummyJar, '')

    // Copy Soresti Overlay mod
    const overlaySrc = path.join(__dirname, '../../assets/sorestioverlay.jar')
    const modsDir = path.join(gameDir, 'mods')
    if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true })
    const overlayDest = path.join(modsDir, 'sorestioverlay.jar')
    if (fs.existsSync(overlaySrc) && !fs.existsSync(overlayDest)) {
      fs.copyFileSync(overlaySrc, overlayDest)
    }

    win?.webContents.send('mods:progress', { fileName: fabricVersionId, percent: 100, downloaded: 0, total: 100 })
    win?.webContents.send('mods:done', { fileName: fabricVersionId })

    return { success: true, versionId: fabricVersionId }
  })

  // ─── Check Fabric already installed (bundled setup does this once at startup) ───
  ipcMain.handle('game:ensure-fabric', async (event, gameVersion: string) => {
    const gameDir = getGameDir()
    const versionsDir = path.join(gameDir, 'versions')
    if (fs.existsSync(versionsDir)) {
      const existing = fs.readdirSync(versionsDir).find(v => v.startsWith('fabric-loader-') && v.endsWith('-' + gameVersion))
      if (existing) return { success: true, alreadyInstalled: true, versionId: existing }
    }
    return { success: false, reason: 'fabric_not_setup' }
  })
}
