const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

const GAME_VERSION = '1.21.4'
const BASE_DIR = path.join(__dirname, '..', 'assets', 'vanilla-setup')

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    mod.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJson(res.headers.location).then(resolve).catch(reject)
        return
      }
      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (!data) return reject(new Error('Empty response'))
        try { resolve(JSON.parse(data)) } catch(e) { reject(e) }
      })
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
        const total = parseInt(res.headers['content-length'], 10)
        let downloaded = 0
        res.on('data', (chunk) => {
          downloaded += chunk.length
          const pct = total ? Math.round(downloaded / total * 100) : 0
          process.stdout.write(`\r  ${pct}% (${Math.round(downloaded / 1024 / 1024 * 100) / 100}MB / ${Math.round(total / 1024 / 1024 * 100) / 100}MB)`)
        })
        res.pipe(file)
        file.on('finish', () => { process.stdout.write('\n'); file.close(); resolve() })
      }).on('error', reject)
    }
    request(url)
  })
}

async function main() {
  if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true })

  // Download version manifest first to get the version JSON URL
  console.log('Fetching version manifest...')
  // Use BMCLAPI mirror for speed in China/Asia
  const versionJsonUrl = `https://launchermeta.mojang.com/mc/game/version_manifest_v2.json`
  const manifest = await fetchJson(versionJsonUrl)
  const version = manifest.versions.find(v => v.id === GAME_VERSION)
  if (!version) { console.error('Version not found'); return }

  // Download version JSON
  console.log('Downloading version JSON...')
  const versionJson = await fetchJson(version.url)
  const jsonPath = path.join(BASE_DIR, `${GAME_VERSION}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(versionJson, null, 2))

  // Download client JAR
  const jarUrl = versionJson.downloads?.client?.url
  if (jarUrl) {
    console.log(`Downloading client JAR (${Math.round((versionJson.downloads.client.size || 0) / 1024 / 1024 * 100) / 100}MB)...`)
    const jarDest = path.join(BASE_DIR, `${GAME_VERSION}.jar`)
    if (!fs.existsSync(jarDest)) {
      await downloadFile(jarUrl, jarDest)
    } else {
      console.log('JAR already exists, skipping')
    }
  }

  // Download asset index (small JSON)
  const assetIndex = versionJson.assetIndex
  if (assetIndex?.url) {
    console.log('Downloading asset index...')
    const indexDest = path.join(BASE_DIR, 'assets', 'indexes', `${assetIndex.id}.json`)
    if (!fs.existsSync(indexDest)) {
      const idx = await fetchJson(assetIndex.url)
      if (!fs.existsSync(path.dirname(indexDest))) fs.mkdirSync(path.dirname(indexDest), { recursive: true })
      fs.writeFileSync(indexDest, JSON.stringify(idx, null, 2))
    }
  }

  // Download all libraries
  console.log('\nDownloading libraries...')
  const libsBase = path.join(BASE_DIR, 'libraries')
  const libs = versionJson.libraries || []
  let libCount = 0
  for (const lib of libs) {
    const art = lib.downloads?.artifact
    if (!art?.url || !art?.path) continue
    const dest = path.join(libsBase, art.path.replace(/\//g, path.sep))
    if (fs.existsSync(dest)) continue
    console.log(`[${++libCount}/${libs.length}] ${lib.name}`)
    await downloadFile(art.url, dest)
  }

  // Download all asset objects
  console.log('\nDownloading asset objects...')
  const assetIndexFile = path.join(BASE_DIR, 'assets', 'indexes', `${versionJson.assetIndex.id}.json`)
  if (fs.existsSync(assetIndexFile)) {
    const index = JSON.parse(fs.readFileSync(assetIndexFile, 'utf-8'))
    const objects = index.objects || {}
    const assetKeys = Object.keys(objects)
    let done = 0
    const total = assetKeys.length
    // Download with concurrency
    const concurrency = 16
    let idx = 0
    await new Promise((resolve) => {
      const next = () => {
        while (idx < total) {
          const i = idx++
          const key = assetKeys[i]
          const obj = objects[key]
          const hash = obj.hash
          const prefix = hash.slice(0, 2)
          const dest = path.join(BASE_DIR, 'assets', 'objects', prefix, hash)
          if (fs.existsSync(dest)) { done++; continue }
          const url = `https://resources.download.minecraft.net/${prefix}/${hash}`
          const dir = path.dirname(dest)
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
          const file = fs.createWriteStream(dest)
          const mod = url.startsWith('https') ? https : http
          const request = (u) => {
            mod.get(u, (res) => {
              if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                request(res.headers.location); return
              }
              res.pipe(file)
              file.on('finish', () => { file.close(); done++; process.stdout.write(`\rAsset: ${done}/${total}`); next() })
            }).on('error', () => { file.close(); try { fs.unlinkSync(dest) } catch {}; done++; next() })
          }
          request(url)
          if (done + idx >= total + concurrency) break
        }
        if (done >= total) { console.log(); resolve() }
      }
      next()
    })
  }

  console.log(`\nDone! Vanilla ${GAME_VERSION} downloaded to ${BASE_DIR}`)
}

main().catch(console.error)
