const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

const GAME_VERSION = '1.21.4'
const BASE_DIR = path.join(__dirname, '..', 'assets', 'fabric-setup')

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    mod.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(JSON.parse(data)))
    }).on('error', reject)
  })
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const file = fs.createWriteStream(dest)
    const mod = url.startsWith('https') ? https : http
    const request = (u) => {
      mod.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request(res.headers.location)
          return
        }
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
      }).on('error', reject)
    }
    request(url)
  })
}

async function main() {
  console.log(`Fetching Fabric loader metadata for ${GAME_VERSION}...`)
  const loaders = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${GAME_VERSION}`)
  const loader = loaders[0]
  const loaderVersion = loader.loader.version
  console.log(`Latest loader: ${loaderVersion}`)

  const profile = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${GAME_VERSION}/${loaderVersion}/profile/json`)
  if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true })
  fs.writeFileSync(path.join(BASE_DIR, 'profile.json'), JSON.stringify(profile, null, 2))

  const libsDir = path.join(BASE_DIR, 'libraries')
  if (!fs.existsSync(libsDir)) fs.mkdirSync(libsDir, { recursive: true })
  const libraries = profile.libraries || []
  let done = 0
  for (const lib of libraries) {
    done++
    console.log(`[${done}/${libraries.length}] ${lib.name}`)
    const parts = lib.name.split(':')
    const groupPath = parts[0].replace(/\./g, '/')
    const jarName = `${parts[1]}-${parts[2]}.jar`
    const url = lib.url
      ? `${lib.url}${groupPath}/${parts[1]}/${parts[2]}/${jarName}`
      : lib.downloads?.artifact?.url
    if (!url) { console.log('  SKIP (no url)'); continue }
    const dest = path.join(libsDir, groupPath, parts[1], parts[2], jarName)
    try {
      await downloadFile(url, dest)
      console.log('  OK')
    } catch (e) {
      console.log(`  FAILED: ${e.message}`)
    }
  }

  // Copy overlay mod
  const modSrc = path.join(__dirname, '..', 'assets', 'sorestioverlay.jar')
  const modsDir = path.join(BASE_DIR, 'mods')
  if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true })
  if (fs.existsSync(modSrc)) {
    fs.copyFileSync(modSrc, path.join(modsDir, 'sorestioverlay.jar'))
    console.log('Mod JAR copied')
  }

  console.log(`\nDone! Fabric ${loaderVersion} for ${GAME_VERSION} downloaded to ${BASE_DIR}`)
}

main().catch(console.error)
