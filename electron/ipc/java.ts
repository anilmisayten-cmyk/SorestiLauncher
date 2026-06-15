import { ipcMain, app, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as child_process from 'child_process'
import * as https from 'https'
import AdmZip from 'adm-zip'

function getJavaDir(): string {
  return path.join(app.getPath('appData'), 'SorestiLauncher', 'java')
}

function checkJavaVersion(javaPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (javaPath !== 'java' && !fs.existsSync(javaPath)) return resolve(null)

    const timeout = setTimeout(() => { try { proc.kill() } catch {} ; resolve(null) }, 3000)
    const proc = child_process.spawn(javaPath, ['-version'], { stdio: 'pipe', windowsHide: true })
    let output = ''
    proc.stderr?.on('data', (d: Buffer) => { output += d.toString() })
    proc.stdout?.on('data', (d: Buffer) => { output += d.toString() })
    proc.on('close', () => {
      clearTimeout(timeout)
      if (output.includes('version')) {
        const match = output.match(/version "([^"]+)"/)
        resolve(match ? match[1] : 'unknown')
      } else resolve(null)
    })
    proc.on('error', () => { clearTimeout(timeout); resolve(null) })
  })
}

// Windows'ta `where java` ile Java konumunu bul
function findJavaWithWhere(): Promise<string | null> {
  return new Promise((resolve) => {
    child_process.exec('where java', { windowsHide: true }, (err, stdout) => {
      if (err || !stdout.trim()) return resolve(null)
      const lines = stdout.trim().split('\n').map(l => l.trim()).filter(Boolean)
      resolve(lines[0] || null)
    })
  })
}

// JAVA_HOME env variable'ından bul
function findJavaFromEnv(): string | null {
  const javaHome = process.env.JAVA_HOME || process.env.JDK_HOME || process.env.JRE_HOME
  if (!javaHome) return null
  const candidates = [
    path.join(javaHome, 'bin', 'java.exe'),
    path.join(javaHome, 'bin', 'java')
  ]
  return candidates.find(p => fs.existsSync(p)) || null
}

export function registerJavaHandlers() {
  ipcMain.handle('java:check', async () => {
    // 1. Bundled java
    const bundledJava = path.join(getJavaDir(), 'bin', 'java.exe')
    if (fs.existsSync(bundledJava)) {
      const version = await checkJavaVersion(bundledJava)
      if (version) return { found: true, path: bundledJava, version, bundled: true }
    }

    // 2. JAVA_HOME environment variable
    const envJava = findJavaFromEnv()
    if (envJava) {
      const version = await checkJavaVersion(envJava)
      if (version) return { found: true, path: envJava, version, bundled: false }
    }

    // 3. `where java` (Windows PATH lookup — en güvenilir yol)
    const whereResult = await findJavaWithWhere()
    if (whereResult) {
      const version = await checkJavaVersion(whereResult)
      if (version) return { found: true, path: whereResult, version, bundled: false }
    }

    // 4. `java` (PATH'ten direkt)
    const pathVersion = await checkJavaVersion('java')
    if (pathVersion) return { found: true, path: 'java', version: pathVersion, bundled: false }

    // 5. Yaygın kurulum yolları
    const commonPaths = [
      'C:\\Program Files\\Eclipse Adoptium\\jre-21.0.3.9-hotspot\\bin\\java.exe',
      'C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe',
      'C:\\Program Files\\Microsoft\\jdk-21.0.3.9-hotspot\\bin\\java.exe',
      'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe',
      'C:\\Program Files\\Java\\jre-21\\bin\\java.exe',
      'C:\\Program Files\\Java\\jdk1.8.0_301\\bin\\java.exe',
      'C:\\Program Files\\Java\\jre8\\bin\\java.exe',
      'C:\\Program Files\\Zulu\\zulu-21\\bin\\java.exe',
      'C:\\Program Files\\BellSoft\\LibericaJDK-21\\bin\\java.exe',
    ]

    const results = await Promise.all(
      commonPaths
        .filter(p => fs.existsSync(p))
        .map(async p => ({ p, v: await checkJavaVersion(p) }))
    )

    const found = results.find(r => r.v !== null)
    if (found) return { found: true, path: found.p, version: found.v, bundled: false }

    return { found: false, path: null, version: null, bundled: false }
  })

  ipcMain.handle('java:install', async () => ({
    downloadUrl: 'https://adoptium.net/temurin/releases/?version=21',
    message: 'Java 21 indirmek için bağlantıya tıklayın'
  }))
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'SorestiLauncher/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) return resolve(fetchJson(res.headers.location!))
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { reject(e) } })
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
    if (fs.existsSync(tmp)) { try { fs.unlinkSync(tmp) } catch {} }
    const file = fs.createWriteStream(tmp)
    const req = https.get(url, { headers: { 'User-Agent': 'SorestiLauncher/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) { file.close(); resolve(downloadFile(res.headers.location!, dest, onProgress)); return }
      if (res.statusCode !== 200) { file.close(); try { fs.unlinkSync(tmp) } catch {}; return reject(new Error(`HTTP ${res.statusCode}`)) }
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

export async function ensureJava(majorVersion: number, onProgress?: (percent: number, task: string) => void): Promise<string> {
  const javaDir = path.join(app.getPath('appData'), 'SorestiLauncher', 'java', majorVersion.toString())
  const javaExe = path.join(javaDir, 'bin', 'java.exe')
  
  if (fs.existsSync(javaExe)) return javaExe

  if (fs.existsSync(javaDir)) {
    const files = fs.readdirSync(javaDir)
    if (files.length === 1 && fs.statSync(path.join(javaDir, files[0])).isDirectory()) {
      const nestedExe = path.join(javaDir, files[0], 'bin', 'java.exe')
      if (fs.existsSync(nestedExe)) return nestedExe
    }
  }

  onProgress?.(0, `Java ${majorVersion} bilgileri alınıyor...`)
  const url = `https://api.adoptium.net/v3/assets/latest/${majorVersion}/hotspot?architecture=x64&image_type=jre&os=windows`
  let data: any
  try {
    data = await fetchJson(url)
  } catch (e) {
    throw new Error(`Java ${majorVersion} bilgileri alınamadı.`)
  }

  if (!data || data.length === 0) throw new Error(`Java ${majorVersion} bulunamadı.`)
  const pkg = data[0].binary.package
  const downloadUrl = pkg.link

  const zipDest = path.join(javaDir, `jre-${majorVersion}.zip`)
  onProgress?.(5, `Java ${majorVersion} indiriliyor...`)
  
  let lastPct = 0
  await downloadFile(downloadUrl, zipDest, (dl, tot) => {
    const pct = 5 + Math.round((dl / (tot || 1)) * 75)
    if (pct !== lastPct) {
      lastPct = pct
      onProgress?.(pct, `Java ${majorVersion}: ${(dl/1024/1024).toFixed(1)}MB / ${((tot||0)/1024/1024).toFixed(1)}MB`)
    }
  })

  onProgress?.(85, `Java ${majorVersion} kuruluyor...`)
  try {
    const zip = new AdmZip(zipDest)
    zip.extractAllTo(javaDir, true)
    fs.unlinkSync(zipDest)
  } catch (e) {
    throw new Error(`Java ${majorVersion} çıkarma işlemi başarısız.`)
  }

  onProgress?.(100, `Java ${majorVersion} hazır!`)
  
  if (fs.existsSync(javaExe)) return javaExe
  const files = fs.readdirSync(javaDir)
  if (files.length === 1 && fs.statSync(path.join(javaDir, files[0])).isDirectory()) {
    const nestedExe = path.join(javaDir, files[0], 'bin', 'java.exe')
    if (fs.existsSync(nestedExe)) return nestedExe
  }
  
  throw new Error(`Java ${majorVersion} kurulumu başarısız (java.exe bulunamadı).`)
}
