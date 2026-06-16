import { ipcMain, app, BrowserWindow, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as child_process from 'child_process'
import * as crypto from 'crypto'
import * as https from 'https'
import { ensureJava } from './java'
import { setStatus } from './discord'

const getSkinsDir = () => {
  const p = path.join(app.getPath('appData'), 'SorestiLauncher', 'skins')
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
  return p
}

let gameProcess: child_process.ChildProcess | null = null

interface LaunchOptions {
  versionId: string
  accountUUID: string
  accountUsername: string
  accountType: 'microsoft' | 'offline' | 'elyby'
  gameDir: string
  javaPath: string
  maxMemory: number
  minMemory: number
  accessToken?: string
}

interface LibraryRule {
  action: string
  os?: { name: string }
}

function isLibraryAllowed(lib: any): boolean {
  if (!lib.rules) return true
  let allow = false
  for (const rule of lib.rules as LibraryRule[]) {
    if (rule.action === 'allow') allow = !rule.os || rule.os.name === 'windows'
    else if (rule.action === 'disallow' && (!rule.os || rule.os.name === 'windows')) allow = false
  }
  return allow
}

interface ResolvedVersion {
  mainClass: string
  libraries: any[]
  jarPath: string | null
  args: { jvm: any[]; game: any[] }
  assetIndex?: { id: string; sha1?: string; size?: number; totalSize?: number; url?: string }
  type: string
  javaVersion?: { majorVersion: number }
  minecraftArguments?: string
}

function resolveVersionChain(gameDir: string, versionId: string): ResolvedVersion {
  const versionDir = path.join(gameDir, 'versions', versionId)
  const jsonPath = path.join(versionDir, `${versionId}.json`)
  if (!fs.existsSync(jsonPath)) throw new Error(`Versiyon JSON bulunamadı: ${versionId}. Tekrar indirin.`)

  const v = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  const result: ResolvedVersion = {
    mainClass: v.mainClass,
    libraries: v.libraries || [],
    jarPath: path.join(versionDir, `${versionId}.jar`),
    args: { jvm: v.arguments?.jvm || [], game: v.arguments?.game || [] },
    assetIndex: v.assetIndex,
    type: v.type || 'release',
    javaVersion: v.javaVersion,
    minecraftArguments: v.minecraftArguments,
  }

  if (v.inheritsFrom) {
    const parent = resolveVersionChain(gameDir, v.inheritsFrom)
    result.libraries = [...result.libraries, ...parent.libraries]
    result.jarPath = parent.jarPath
    result.mainClass = result.mainClass || parent.mainClass
    result.args.jvm = [...result.args.jvm, ...parent.args.jvm]
    result.args.game = [...result.args.game, ...parent.args.game]
    if (!result.assetIndex) result.assetIndex = parent.assetIndex
    if (!result.type || result.type === 'release') result.type = parent.type
    if (!result.javaVersion) result.javaVersion = parent.javaVersion
    if (!result.minecraftArguments) result.minecraftArguments = parent.minecraftArguments
  }

  return result
}

function mavenToPath(name: string): string {
  // Maven coordinate: groupId:artifactId:version
  const parts = name.split(':')
  if (parts.length < 3) return ''
  const [groupId, artifactId, version] = parts
  const classifier = parts.length > 3 ? '-' + parts[3] : ''
  return `${groupId.replace(/\./g, '/')}/${artifactId}/${version}/${artifactId}-${version}${classifier}.jar`
}

function buildClasspath(resolved: ResolvedVersion, gameDir: string): string {
  const libsDir = path.join(gameDir, 'libraries')
  const entries: string[] = []
  const seen = new Set<string>() // dedup: groupId:artifactId for base libs, groupId:artifactId:version:classifier for natives

  for (const lib of resolved.libraries) {
    if (!isLibraryAllowed(lib)) continue

    const parts = (lib.name || '').split(':')
    // For libraries WITH classifiers (natives), key includes classifier so they're never dedupped
    // For libraries WITHOUT classifiers, key is groupId:artifactId so version conflicts are resolved (last wins)
    const key = parts.length >= 4 ? parts.slice(0, 4).join(':') : (parts.length >= 2 ? `${parts[0]}:${parts[1]}` : '')
    if (key && seen.has(key)) continue
    if (key) seen.add(key)

    const art = lib.downloads?.artifact
    let libPath = ''
    if (art?.path) {
      libPath = path.join(libsDir, art.path.replace(/\//g, path.sep))
    } else if (lib.name) {
      const relPath = mavenToPath(lib.name)
      if (relPath) libPath = path.join(libsDir, relPath.replace(/\//g, path.sep))
    }
    if (libPath && fs.existsSync(libPath)) entries.push(libPath)
  }

  if (!resolved.jarPath || !fs.existsSync(resolved.jarPath))
    throw new Error(`Client JAR bulunamadı. Tekrar indirin.`)
  entries.push(resolved.jarPath)

  return entries.join(path.delimiter)
}

function resolveArgs(
  template: string,
  vars: Record<string, string>
): string[] {
  return template
    .split(' ')
    .map(token => {
      const match = token.match(/^\$\{(.+)\}$/)
      if (match) return vars[match[1]] ?? token
      return token
    })
    .filter(Boolean)
}

function parseModernArgs(
  argList: any[],
  vars: Record<string, string>
): string[] {
  const result: string[] = []
  for (const arg of argList) {
    if (typeof arg === 'string') {
      result.push(arg.replace(/\$\{([^}]+)\}/g, (_, k) => vars[k] ?? ''))
    } else if (arg.value) {
      const rules: any[] = arg.rules || []
      let allowed = false
      for (const rule of rules) {
        let match = true
        if (rule.os && rule.os.name !== 'windows') match = false
        if (rule.features) {
          if (rule.features.is_demo_user) match = false
          if (rule.features.has_custom_resolution) match = true
        }
        if (match) {
          allowed = (rule.action === 'allow')
        }
      }
      if (allowed) {
        const vals = Array.isArray(arg.value) ? arg.value : [arg.value]
        for (const v of vals) {
          result.push(v.replace(/\$\{([^}]+)\}/g, (_: string, k: string) => vars[k] ?? ''))
        }
      }
    }
  }
  return result
}

async function ensureAssets(assetIndexId: string, gameDir: string, onProgress?: (pct: number, current: number, total: number) => void) {
  const assetsDir = path.join(gameDir, 'assets')
  const indexesDir = path.join(assetsDir, 'indexes')
  const objectsDir = path.join(assetsDir, 'objects')
  const indexPath = path.join(indexesDir, `${assetIndexId}.json`)
  if (!fs.existsSync(indexPath)) return

  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
  const objects = index.objects || {}
  const entries = Object.keys(objects)
  if (entries.length === 0) return

  // Count how many already exist
  let existing = 0
  for (const key of entries) {
    const obj = objects[key]
    const hash: string = obj.hash
    const prefix = hash.slice(0, 2)
    const objPath = path.join(objectsDir, prefix, hash)
    if (fs.existsSync(objPath)) existing++
  }
  if (existing === entries.length) return // all done

  const total = entries.length - existing
  let downloaded = 0
  const concurrency = 8
  let running = 0
  let idx = 0

  await new Promise<void>((resolve) => {
    const next = () => {
      while (running < concurrency && idx < entries.length) {
        const key = entries[idx++]
        const obj = objects[key]
        const hash: string = obj.hash
        const prefix = hash.slice(0, 2)
        const objPath = path.join(objectsDir, prefix, hash)
        if (fs.existsSync(objPath)) continue

        running++
        const url = `https://resources.download.minecraft.net/${prefix}/${hash}`
        const dir = path.dirname(objPath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const file = fs.createWriteStream(objPath)

        const handle = (res: any) => {
          res.pipe(file)
          file.on('finish', () => {
            file.close()
            downloaded++
            running--
            onProgress?.(Math.round(downloaded / total * 100), downloaded, total)
            next()
          })
        }

        const req = https.get(url, (res: any) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            https.get(res.headers.location, handle).on('error', () => { file.close(); try { fs.unlinkSync(objPath) } catch {}; running--; next() })
          } else {
            handle(res)
          }
        })
        req.on('error', () => { file.close(); try { fs.unlinkSync(objPath) } catch {}; running--; next() })
        req.setTimeout(30000, () => { req.destroy(); file.close(); try { fs.unlinkSync(objPath) } catch {}; running--; next() })
      }
      if (running === 0 && (idx >= entries.length || errored)) resolve()
    }
    next()
  })
}

function extractNatives(resolved: ResolvedVersion, gameDir: string, nativesDir: string) {
  const libsDir = path.join(gameDir, 'libraries')
  const knownNatives = [
    'lwjgl', 'lwjgl-glfw', 'lwjgl-openal', 'lwjgl-opengl',
    'lwjgl-stb', 'lwjgl-jemalloc', 'lwjgl-tinyfd', 'lwjgl-freetype'
  ]
  for (const lib of resolved.libraries) {
    const name = lib.name || ''
    if (!name.includes(':natives-windows')) continue
    const art = lib.downloads?.artifact
    const relPath = art?.path || ''
    if (!relPath) continue
    const jarPath = path.join(libsDir, relPath.replace(/\//g, path.sep))
    if (!fs.existsSync(jarPath)) continue
    // Check if this is a native JAR for a known LWJGL component
    const matchesKnown = knownNatives.some(n => name.includes(n))
    if (!matchesKnown) continue
    try {
      const AdmZip = require('adm-zip')
      const zip = new AdmZip(jarPath)
      const entries = zip.getEntries()
      for (const entry of entries) {
        if (entry.entryName.endsWith('.dll') && !entry.isDirectory) {
          const dest = path.join(nativesDir, path.basename(entry.entryName))
          if (!fs.existsSync(dest)) {
            zip.extractEntryTo(entry, nativesDir, false, true)
          }
        }
      }
    } catch (e) {
      // adm-zip might not be available, try jar command
      try {
        require('child_process').execSync(
          `jar xf "${jarPath}" *.dll`,
          { cwd: nativesDir, stdio: 'ignore' }
        )
      } catch (e2) { /* ignore */ }
    }
  }
}

export function registerGameHandlers() {
  ipcMain.handle('skin:select-local', async (_event, username: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Skin Seç (.png)',
      filters: [{ name: 'Images', extensions: ['png'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null

    const targetPath = path.join(getSkinsDir(), `${username}.png`)
    fs.copyFileSync(filePaths[0], targetPath)
    return `file://${targetPath}?t=${Date.now()}`
  })

  ipcMain.handle('game:launch', async (event, options: LaunchOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
    const log = (line: string) => win?.webContents.send('game:log', line)

    try {
      const gameDir = options.gameDir?.trim() || path.join(app.getPath('appData'), 'SorestiLauncher', 'minecraft')
      let javaPath = options.javaPath?.trim() || ''
      let versionId = options.versionId

      // Auto-detect Fabric if available (prefer Fabric over vanilla for overlay support)
      const versionsDir = path.join(gameDir, 'versions')
      if (fs.existsSync(versionsDir)) {
        const fabricVersion = fs.readdirSync(versionsDir).find(v => v.startsWith('fabric-loader-') && v.endsWith('-' + versionId))
        if (fabricVersion) versionId = fabricVersion
      }

      const versionDir = path.join(gameDir, 'versions', versionId)

      const resolved = resolveVersionChain(gameDir, versionId)
      const mainClass = resolved.mainClass

      if (!javaPath) {
        let requiredJava = 8
        if (resolved.javaVersion?.majorVersion) {
          requiredJava = resolved.javaVersion.majorVersion
        } else {
          if (versionId.startsWith('1.17')) requiredJava = 16
          else if (versionId.match(/^1\.(18|19|20(\.[1-4])?)/)) requiredJava = 17
          else if (versionId.match(/^1\.2[0-9]/)) requiredJava = 21
        }
        
        javaPath = await ensureJava(requiredJava, (pct, task) => {
          win?.webContents.send('download:progress', { versionId, percent: pct, task, downloaded: 0, total: 100 })
        })
      }

      const nativesDir = path.join(versionDir, 'natives')
      const assetsDir = path.join(gameDir, 'assets')
      ;[nativesDir, assetsDir, path.join(assetsDir, 'indexes'), path.join(assetsDir, 'objects')]
        .forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) })

      try { extractNatives(resolved, gameDir, nativesDir) } catch (e: any) { log('[Soresti] Native çıkarma hatası (önemsiz): ' + e.message) }

      // Soresti bundled mods sync (enabled → copy, disabled → remove)
      try {
        const { syncBundledMods } = require('./mods')
        if (syncBundledMods) await syncBundledMods()
      } catch (e: any) { log('[Soresti] Bundled mod sync hatası: ' + e.message) }

      const assetIndexId = resolved.assetIndex?.id || versionId
      log('[Soresti] Asset objeleri kontrol ediliyor...')
      await ensureAssets(assetIndexId, gameDir, (pct, current, total) => {
        log(`[Soresti] Asset indiriliyor: ${current}/${total} (%${pct})`)
      })
      log('[Soresti] Asset objeleri hazır')

      const classpath = buildClasspath(resolved, gameDir)

      const getOfflineUUID = (username: string) => {
        const hash = crypto.createHash('md5').update('OfflinePlayer:' + username).digest()
        hash[6] = (hash[6] & 0x0f) | 0x30
        hash[8] = (hash[8] & 0x3f) | 0x80
        return hash.toString('hex')
      }
      
      const offlineUuid = getOfflineUUID(options.accountUsername)

      const vars: Record<string, string> = {
        auth_player_name: options.accountUsername,
        version_name: versionId,
        game_directory: gameDir,
        assets_root: assetsDir,
        assets_index_name: assetIndexId,
        auth_uuid: offlineUuid,
        auth_access_token: offlineUuid,  // Cracked fix: use UUID as token so Multiplayer button works
        user_type: 'mojang',
        version_type: resolved.type,
        user_properties: '{}',
        auth_session: `token:${offlineUuid}:${offlineUuid}`,
        natives_directory: nativesDir,
        launcher_name: 'SorestiLauncher',
        launcher_version: '1.0.0',
        classpath,
        resolution_width: '854',
        resolution_height: '480',
      }

      const jvmArgs: string[] = [
        `-Xms${Math.max(options.minMemory || 512, 256)}M`,
        `-Xmx${Math.max(options.maxMemory || 2048, 512)}M`,
        `-Djava.library.path=${nativesDir}`,
        `-Dminecraft.launcher.brand=SorestiLauncher`,
        `-Dminecraft.launcher.version=1.0.0`,
        `-Djava.net.preferIPv4Stack=true`,
      ]

      // Authlib-injector — only for non-offline accounts (offline doesn't need it)
      if (options.accountType !== 'offline') {
      const injectorPath = path.join(gameDir, 'authlib-injector.jar')
      if (!fs.existsSync(injectorPath)) {
        win?.webContents.send('game:launch-progress', { step: 'Authlib-Injector indiriliyor...' })
        const https = require('https')
        await new Promise<void>((resolve, reject) => {
          const file = fs.createWriteStream(injectorPath)
          https.get('https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar', (res: any) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
              https.get(res.headers.location, (res2: any) => { res2.pipe(file); file.on('finish', () => { file.close(); resolve() }) })
            } else {
              res.pipe(file); file.on('finish', () => { file.close(); resolve() })
            }
          }).on('error', reject)
        })
      }
      jvmArgs.push(`-javaagent:${injectorPath}=ely.by`)
      } // end if accountType !== 'offline'

      if (resolved.args.jvm.length > 0) {
        const jvmFromJson = parseModernArgs(resolved.args.jvm, vars)
        
        if (options.accountType === 'offline') {
          const localSkinPath = path.join(getSkinsDir(), `${options.accountUsername}.png`)
          if (fs.existsSync(localSkinPath)) {
            const rpPath = path.join(gameDir, 'resourcepacks', 'SorestiSkin')
            fs.mkdirSync(path.join(rpPath, 'assets/minecraft/textures/entity'), { recursive: true })
            fs.writeFileSync(path.join(rpPath, 'pack.mcmeta'), JSON.stringify({ pack: { pack_format: 1, description: "Soresti Local Skin" } }))
            fs.copyFileSync(localSkinPath, path.join(rpPath, 'assets/minecraft/textures/entity/steve.png'))
            fs.copyFileSync(localSkinPath, path.join(rpPath, 'assets/minecraft/textures/entity/alex.png'))
            
            const optionsTxtPath = path.join(gameDir, 'options.txt')
            if (fs.existsSync(optionsTxtPath)) {
              let opts = fs.readFileSync(optionsTxtPath, 'utf8')
              if (!opts.includes('resourcePacks:')) {
                 opts += '\nresourcePacks:["vanilla","file/SorestiSkin"]\n'
              } else if (!opts.includes('SorestiSkin')) {
                 opts = opts.replace(/resourcePacks:\[(.*?)\]/, (m, p) => `resourcePacks:[${p ? p + ',' : ''}"file/SorestiSkin"]`)
              }
              fs.writeFileSync(optionsTxtPath, opts)
            }
          }
        }

        jvmArgs.push(...jvmFromJson.filter(a => !jvmArgs.some(e => e === a || a.startsWith('-Djava.library.path'))))
      } else {
        jvmArgs.push('-cp', classpath)
      }

      const needsManualCp = resolved.args.jvm.length === 0
      if (!needsManualCp && !jvmArgs.includes('-cp')) {
        jvmArgs.push('-cp', classpath)
      }

      let gameArgs: string[] = []
      if (resolved.minecraftArguments) {
        gameArgs = resolveArgs(resolved.minecraftArguments, vars)
      } else if (resolved.args.game.length > 0) {
        gameArgs = parseModernArgs(resolved.args.game, vars)
      }

      const fullArgs = [...jvmArgs, mainClass, ...gameArgs]

      log(`[Soresti] Minecraft ${versionId} başlatılıyor...`)
      log(`[Soresti] Java: ${javaPath}`)
      log(`[Soresti] Kullanıcı: ${options.accountUsername}`)
      log(`[Soresti] Ana sınıf: ${mainClass}`)
      log(`[Soresti] Natives: ${nativesDir}`)

      setStatus(`Minecraft ${versionId}`, `${options.accountUsername} ile oynuyor`)

      gameProcess = child_process.spawn(javaPath, fullArgs, {
        cwd: gameDir,
        detached: false,
        windowsHide: false,
        stdio: ['ignore', 'pipe', 'pipe']
      })

      gameProcess.stdout?.on('data', (data: Buffer) => {
        data.toString().split('\n').forEach(line => { if (line.trim()) log(line.trimEnd()) })
      })
      gameProcess.stderr?.on('data', (data: Buffer) => {
        data.toString().split('\n').forEach(line => { if (line.trim()) log(`[ERR] ${line.trimEnd()}`) })
      })
      gameProcess.on('close', (code: number) => {
        win?.webContents.send('game:exit', code ?? 0)
        log(`[Soresti] Minecraft kapandı (kod: ${code})`)
        setStatus('Launcherda', 'Menude')
        gameProcess = null
      })
      gameProcess.on('error', (err: Error) => {
        log(`[Soresti HATA] ${err.message}`)
        if ((err as any).code === 'ENOENT') {
          log(`[Soresti] "${javaPath}" bulunamadı. Ayarlar > Java Yolu kontrol edin.`)
        }
        setStatus('Launcherda', 'Menude')
        win?.webContents.send('game:exit', -1)
        gameProcess = null
      })

      return { success: true, pid: gameProcess.pid }
    } catch (err: any) {
      throw new Error(err.message || 'Oyun başlatılamadı')
    }
  })

  ipcMain.on('game:kill', () => {
    if (gameProcess) { gameProcess.kill('SIGTERM'); gameProcess = null }
  })
}
