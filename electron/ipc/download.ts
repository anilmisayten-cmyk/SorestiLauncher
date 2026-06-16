import { ipcMain, app, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as https from 'https'
import * as http from 'http'
import AdmZip from 'adm-zip'

interface VersionManifestEntry {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string
  time: string
  releaseTime: string
}

interface VersionManifest {
  latest: { release: string; snapshot: string }
  versions: VersionManifestEntry[]
}

const MIRRORS = {
  manifest: [
    'https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json',
    'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',
    'https://download.mcversions.com/mc/game/version_manifest_v2.json',
  ],
  libraries: [
    'https://bmclapi2.bangbang93.com/maven',
    'https://libraries.minecraft.net',
  ],
  assets: [
    'https://bmclapi2.bangbang93.com/assets',
    'https://resources.download.minecraft.net',
  ],
}

const agentOpts = { keepAlive: true, maxSockets: 1024, maxFreeSockets: 1024, keepAliveMsecs: 60000, scheduling: 'lifo' as const }
const httpsAgent = new https.Agent(agentOpts)
const httpAgent  = new http.Agent(agentOpts)

const REQ_HEADERS = { 'User-Agent': 'SorestiLauncher/3.0' }

function getGameDir(): string {
  return path.join(app.getPath('appData'), 'SorestiLauncher', 'minecraft')
}

function fetchJson(url: string, retries = 2): Promise<any> {
  return new Promise((resolve, reject) => {
    const tryFetch = (attempt: number) => {
      const isS = url.startsWith('https')
      const req = (isS ? https : http).get(url, { agent: isS ? httpsAgent : httpAgent, headers: REQ_HEADERS }, res => {
        if (res.statusCode === 301 || res.statusCode === 302) { res.resume(); return tryFetch(attempt) }
        let d = ''
        res.on('data', c => d += c)
        res.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { reject(e) } })
        res.on('error', () => { if (attempt < retries) tryFetch(attempt + 1); else reject(new Error(`Fetch failed after ${attempt+1} attempts`)) })
      })
      req.on('error', () => { if (attempt < retries) tryFetch(attempt + 1); else reject(new Error(`Fetch failed after ${attempt+1} attempts`)) })
      req.setTimeout(15000, () => { req.destroy(); if (attempt < retries) tryFetch(attempt + 1); else reject(new Error('Timeout')) })
    }
    tryFetch(0)
  })
}

function downloadFile(url: string, dest: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (fs.existsSync(dest)) return resolve(true)
    const dir = path.dirname(dest)
    try { fs.mkdirSync(dir, { recursive: true }) } catch {}
    const tmp = dest + '.' + Math.random().toString(36).slice(2) + '.tmp'
    let done = false
    let wf: fs.WriteStream | null = null
    try { wf = fs.createWriteStream(tmp) } catch { return resolve(false) }

    const tryGet = (u: string, attempt = 0) => {
      if (done || fs.existsSync(dest)) { try { if (!done) { done = true; try { fs.unlinkSync(tmp) } catch {} } } catch {}; return resolve(true) }
      if (attempt > 2) { try { if (!done) { done = true; try { fs.unlinkSync(tmp) } catch {} } } catch {}; return resolve(false) }
      const isS = u.startsWith('https')
      const req = (isS ? https : http).get(u, { agent: isS ? httpsAgent : httpAgent, headers: REQ_HEADERS }, res => {
        if (done) { res.resume(); return }
        if (res.statusCode === 301 || res.statusCode === 302) { res.resume(); return tryGet(res.headers.location!, attempt) }
        if (res.statusCode !== 200) { res.resume(); wf!.close(); return tryGet(u, attempt + 1) }
        res.pipe(wf!)
        wf!.on('finish', () => {
          if (done) return
          wf!.close()
          done = true
          try { if (!fs.existsSync(dest)) fs.renameSync(tmp, dest); else try { fs.unlinkSync(tmp) } catch {} } catch {}
          resolve(true)
        })
        res.on('error', () => { wf!.close(); tryGet(u, attempt + 1) })
      })
      req.on('error', () => { tryGet(u, attempt + 1) })
      req.setTimeout(15000, () => { req.destroy(); tryGet(u, attempt + 1) })
    }
    tryGet(url)
  })
}

// Extract natives JAR into nativesDir, skip META-INF and .git files
function extractNatives(jarBuffer: Buffer, nativesDir: string): void {
  try {
    if (!fs.existsSync(nativesDir)) fs.mkdirSync(nativesDir, { recursive: true })
    const zip = new AdmZip(jarBuffer)
    for (const entry of zip.getEntries()) {
      const name = entry.entryName
      if (entry.isDirectory) continue
      if (name.startsWith('META-INF') || name.includes('.git') || name.endsWith('.sha1') || name.endsWith('.md5')) continue
      // Only extract .dll, .so, .dylib, .jnilib files
      const ext = path.extname(name).toLowerCase()
      if (!['.dll', '.so', '.dylib', '.jnilib', ''].includes(ext) && !name.endsWith('64')) continue
      const destPath = path.join(nativesDir, path.basename(name))
      try {
        fs.writeFileSync(destPath, entry.getData())
      } catch {}
    }
  } catch {}
}

async function fetchWithFallback(urls: string[]): Promise<any> {
  const errors: Error[] = []
  for (const url of urls) {
    try { return await fetchJson(url) } catch (e: any) { errors.push(e) }
  }
  throw new Error(`Tüm kaynaklar başarısız: ${errors.map(e => e.message).join('; ')}`)
}

// Concurrency pool — max N parallel, never rejects
async function downloadPool(tasks: (() => Promise<void>)[], concurrency: number): Promise<void> {
  let i = 0
  const total = tasks.length
  async function worker() {
    while (i < tasks.length) {
      const idx = i++
      try { await tasks[idx]() } catch {}
    }
  }
  if (total > 0) {
    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker))
  }
}

interface LibraryRule { action: string; os?: { name: string } }

function isLibraryAllowed(lib: any): boolean {
  if (!lib.rules) return true
  let allow = false
  for (const rule of lib.rules as LibraryRule[]) {
    if (rule.action === 'allow') allow = !rule.os || rule.os.name === 'windows'
    else if (rule.action === 'disallow' && (!rule.os || rule.os.name === 'windows')) allow = false
  }
  return allow
}

export function registerDownloadHandlers() {
  const CACHE_PATH = path.join(app.getPath('appData'), 'SorestiLauncher', 'version-manifest-cache.json')
  const CACHE_TTL = 60 * 60 * 1000 // 1 saat

  function readCache(): { data: any; time: number } | null {
    try {
      if (!fs.existsSync(CACHE_PATH)) return null
      return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'))
    } catch { return null }
  }

  function writeCache(data: any) {
    try { fs.writeFileSync(CACHE_PATH, JSON.stringify({ data, time: Date.now() })) } catch {}
  }

  ipcMain.handle('game:get-version-list', async () => {
    const cache = readCache()
    const now = Date.now()

    // Eger cache tazeyse (1 saatten kisa), aninda don
    if (cache && (now - cache.time) < CACHE_TTL) {
      return cache.data
    }

    // Cache eski veya yok — fresh fetch yap (birden fazla mirror dene)
    try {
      const fresh = await fetchWithFallback(MIRRORS.manifest)
      writeCache(fresh)
      return fresh
    } catch {
      // Ag hatasi: eski cache varsa onu dondur
      if (cache) return cache.data
      throw new Error('Versiyon listesi alinamadi.')
    }
  })

  ipcMain.handle('game:get-installed-versions', async () => {
    const dir = path.join(getGameDir(), 'versions')
    if (!fs.existsSync(dir)) return []
    try { return fs.readdirSync(dir).filter(d => fs.existsSync(path.join(dir, d, `${d}.jar`))) }
    catch { return [] }
  })

  ipcMain.handle('game:install-version', async (event, versionId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
    const gameDir = getGameDir()
    const versionDir = path.join(gameDir, 'versions', versionId)
    const nativesDir = path.join(versionDir, 'natives')
    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })
    if (!fs.existsSync(nativesDir)) fs.mkdirSync(nativesDir, { recursive: true })

    const send = (pct: number, task: string, dl = 0, tot = 0) =>
      win?.webContents.send('download:progress', { versionId, percent: pct, task, downloaded: dl, total: tot })

    try {
      send(2, 'Manifest alınıyor...')
      const manifest: VersionManifest = await fetchWithFallback(MIRRORS.manifest)
      const entry = manifest.versions.find(v => v.id === versionId)
      if (!entry) throw new Error(`Versiyon bulunamadı: ${versionId}`)

      send(5, 'Versiyon JSON indiriliyor...')
      let versionJson: any = null
      try {
        versionJson = await fetchJson(entry.url)
      } catch {
        // Mirror'dan dene
        const mirrorUrl = entry.url.replace('piston-meta.mojang.com', 'bmclapi2.bangbang93.com')
        versionJson = await fetchJson(mirrorUrl)
      }
      fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(versionJson, null, 2))

      // Asset index
      const assetIndex = versionJson.assetIndex
      if (assetIndex?.url) {
        const indexDir = path.join(gameDir, 'assets', 'indexes')
        if (!fs.existsSync(indexDir)) fs.mkdirSync(indexDir, { recursive: true })
        const indexPath = path.join(indexDir, `${assetIndex.id}.json`)
        
        let indexData: any = null
        if (!fs.existsSync(indexPath)) {
          try {
            indexData = await fetchJson(assetIndex.url)
            fs.writeFileSync(indexPath, JSON.stringify(indexData))
          } catch {}
        } else {
          try { indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) } catch {}
        }

        // ─── Assets (Sounds, Textures, etc.) ───
        if (indexData?.objects) {
          const objectsDir = path.join(gameDir, 'assets', 'objects')
          if (!fs.existsSync(objectsDir)) fs.mkdirSync(objectsDir, { recursive: true })

          const hashEntries = Object.entries(indexData.objects).filter(([, obj]: any[]) => obj?.hash)
          const hashes = hashEntries.map(([, obj]: any[]) => obj.hash)
          // Filter out existing assets
          const missingAssets = hashes.filter(hash => {
            if (!hash || typeof hash !== 'string') return false
            const head = hash.substring(0, 2)
            const objPath = path.join(objectsDir, head, hash)
            return !fs.existsSync(objPath)
          })

          let assetsDone = hashes.length - missingAssets.length
          const totalAssets = hashes.length

          if (missingAssets.length > 0) {
            send(7, `📦 Assetler: ${assetsDone}/${totalAssets} (${missingAssets.length} yeni)`)

            const assetTasks = missingAssets.map(hash => async () => {
              const head = hash.substring(0, 2)
              const dest = path.join(objectsDir, head, hash)
              for (const mirror of MIRRORS.assets) {
                if (await downloadFile(`${mirror}/${head}/${hash}`, dest)) break
              }
              assetsDone++
              if (assetsDone % 200 === 0 || assetsDone === totalAssets) {
                send(7 + Math.round((assetsDone / Math.max(totalAssets, 1)) * 3), `📦 Assetler: ${assetsDone}/${totalAssets}`)
              }
            })
            await downloadPool(assetTasks, 256)
          }
          send(10, `✅ ${totalAssets} Asset hazır`)
        }
      }

      // ─── Libraries (JAR files) ───
      const libraries: any[] = versionJson.libraries || []
      const allowed = libraries.filter(l => isLibraryAllowed(l))
      const libsDir = path.join(gameDir, 'libraries')

      // Classpath jar files
      const jarLibs = allowed.filter(l => l.downloads?.artifact?.url)
      let doneJars = 0
      const totalJars = jarLibs.length
      const jarTasks = jarLibs.map(lib => async () => {
        const art = lib.downloads.artifact
        const dest = path.join(libsDir, art.path.replace(/\//g, path.sep))
        if (!fs.existsSync(dest)) {
          const urls = [art.url, ...MIRRORS.libraries.map(m => `${m}/${art.path}`)]
          for (const url of urls) {
            if (await downloadFile(url, dest)) break
          }
        }
        doneJars++
        send(10 + Math.round((doneJars / Math.max(totalJars, 1)) * 40), `📚 Kütüphaneler: ${doneJars}/${totalJars}`)
      })
      await downloadPool(jarTasks, 64)
      send(50, `✅ ${totalJars} kütüphane hazır`)

      // Classifier jars (natives, etc.)
      const classifierLibs = allowed.filter(l => {
        if (!l.downloads?.classifiers) return false
        const rawKey = l.natives?.windows
        if (!rawKey) return false
        const key = rawKey.replace('${arch}', '64')
        return !!(l.downloads.classifiers[key] || l.downloads.classifiers[rawKey])
      })
      let doneClassifiers = 0
      const totalClassifiers = classifierLibs.length
      const classifierTasks = classifierLibs.map(lib => async () => {
        const rawKey = lib.natives.windows
        const key = rawKey.replace('${arch}', '64')
        const classifier = lib.downloads.classifiers[key] || lib.downloads.classifiers[rawKey]
        if (classifier?.path) {
          const dest = path.join(libsDir, classifier.path.replace(/\//g, path.sep))
          if (!fs.existsSync(dest)) {
            const urls = [classifier.url, ...MIRRORS.libraries.map(m => `${m}/${classifier.path}`)]
            for (const url of urls) {
              if (url && await downloadFile(url, dest)) break
            }
          }
        }
        doneClassifiers++
        send(50 + Math.round((doneClassifiers / Math.max(totalClassifiers, 1)) * 6), `📦 Classifier: ${doneClassifiers}/${totalClassifiers}`)
      })
      await downloadPool(classifierTasks, 32)

      // ─── Natives (DLL extraction) ───
      send(57, '🔧 Native DLL çıkarılıyor...')

      const existingNatives = fs.existsSync(nativesDir) ? fs.readdirSync(nativesDir).filter(f => f.endsWith('.dll')) : []
      
      if (existingNatives.length === 0) {
        let nativesDone = 0
        const totalNativeLibs = classifierLibs.length
        const nativeTasks = classifierLibs.map(lib => async () => {
          const rawKey = lib.natives.windows
          const key = rawKey.replace('${arch}', '64')
          const classifier = lib.downloads.classifiers[key] || lib.downloads.classifiers[rawKey]
          if (classifier?.path) {
            const classifierPath = path.join(libsDir, classifier.path.replace(/\//g, path.sep))
            if (fs.existsSync(classifierPath)) {
              try {
                const buf = fs.readFileSync(classifierPath)
                extractNatives(buf, nativesDir)
              } catch {}
            }
          }
          nativesDone++
          send(57 + Math.round((nativesDone / Math.max(totalNativeLibs, 1)) * 13), `🔧 Natives: ${nativesDone}/${totalNativeLibs}`)
        })
        await downloadPool(nativeTasks, 16)
      } else {
        send(70, `✅ ${existingNatives.length} native DLL hazır`)
      }

      // ─── Client JAR ───
      send(72, 'Client JAR indiriliyor...')
      const clientUrl = versionJson.downloads?.client?.url
      if (clientUrl) {
        const jarPath = path.join(versionDir, `${versionId}.jar`)
        const clientMirrors = [clientUrl, ...MIRRORS.libraries.map(m => `${m}/net/minecraft/client/${versionId}/client-${versionId}.jar`)]
        for (const url of clientMirrors) {
          if (await downloadFile(url, jarPath)) break
        }
        send(98, 'Client JAR hazır')
      }

      send(100, '✅ Kurulum tamamlandı!')
      win?.webContents.send('download:complete', versionId)
      return { success: true }
    } catch (err: any) {
      throw new Error(err.message || 'İndirme başarısız')
    }
  })

  ipcMain.handle('game:delete-version', async (_event, versionId: string) => {
    const d = path.join(getGameDir(), 'versions', versionId)
    if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true })
    return true
  })
}
