import { ipcMain, app, BrowserWindow, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as child_process from 'child_process'
import * as crypto from 'crypto'
import { ensureJava } from './java'

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

function buildClasspath(gameDir: string, versionId: string): string {
  const versionDir = path.join(gameDir, 'versions', versionId)
  const jsonPath = path.join(versionDir, `${versionId}.json`)
  if (!fs.existsSync(jsonPath)) throw new Error(`Versiyon JSON bulunamadı: ${versionId}. Tekrar indirin.`)

  const versionJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  const libsDir = path.join(gameDir, 'libraries')
  const entries: string[] = []

  for (const lib of versionJson.libraries || []) {
    if (!isLibraryAllowed(lib)) continue
    const art = lib.downloads?.artifact
    if (!art?.path) continue
    const libPath = path.join(libsDir, art.path.replace(/\//g, path.sep))
    if (fs.existsSync(libPath)) entries.push(libPath)
  }

  const jarPath = path.join(versionDir, `${versionId}.jar`)
  if (!fs.existsSync(jarPath)) throw new Error(`Client JAR bulunamadı: ${versionId}. Tekrar indirin.`)
  entries.push(jarPath)

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

  ipcMain.handle('game:launch', async (_event, options: LaunchOptions) => {
    const win = BrowserWindow.getAllWindows()[0]
    const log = (line: string) => win?.webContents.send('game:log', line)

    try {
      const gameDir = options.gameDir?.trim() || path.join(app.getPath('appData'), 'SorestiLauncher', 'minecraft')
      let javaPath = options.javaPath?.trim() || ''
      const versionId = options.versionId

      const versionDir = path.join(gameDir, 'versions', versionId)
      const jsonPath = path.join(versionDir, `${versionId}.json`)
      if (!fs.existsSync(jsonPath)) throw new Error(`${versionId} yüklü değil. Önce indirin.`)

      const versionJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
      const mainClass: string = versionJson.mainClass

      if (!javaPath) {
        let requiredJava = 8
        if (versionJson.javaVersion?.majorVersion) {
          requiredJava = versionJson.javaVersion.majorVersion
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

      const classpath = buildClasspath(gameDir, versionId)
      const assetIndexId = versionJson.assetIndex?.id || versionId

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
        version_type: versionJson.type || 'release',
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
      ]

      // Authlib-injector for ALL accounts — intercepts Mojang multiplayer permission check
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

      if (versionJson.arguments?.jvm) {
        const jvmFromJson = parseModernArgs(versionJson.arguments.jvm, vars)
        
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

      const needsManualCp = !versionJson.arguments?.jvm
      if (!needsManualCp && !jvmArgs.includes('-cp')) {
        jvmArgs.push('-cp', classpath)
      }

      let gameArgs: string[] = []
      if (versionJson.minecraftArguments) {
        gameArgs = resolveArgs(versionJson.minecraftArguments, vars)
      } else if (versionJson.arguments?.game) {
        gameArgs = parseModernArgs(versionJson.arguments.game, vars)
      }

      const fullArgs = [...jvmArgs, mainClass, ...gameArgs]

      log(`[Soresti] Minecraft ${versionId} başlatılıyor...`)
      log(`[Soresti] Java: ${javaPath}`)
      log(`[Soresti] Kullanıcı: ${options.accountUsername}`)
      log(`[Soresti] Ana sınıf: ${mainClass}`)
      log(`[Soresti] Natives: ${nativesDir}`)

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
        gameProcess = null
      })
      gameProcess.on('error', (err: Error) => {
        log(`[Soresti HATA] ${err.message}`)
        if ((err as any).code === 'ENOENT') {
          log(`[Soresti] "${javaPath}" bulunamadı. Ayarlar > Java Yolu kontrol edin.`)
        }
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
