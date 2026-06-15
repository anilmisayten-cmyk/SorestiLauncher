import { ipcMain, app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

interface Account {
  uuid: string
  username: string
  type: 'microsoft' | 'offline' | 'elyby'
  accessToken?: string
  clientToken?: string
  refreshToken?: string
  avatar?: string
}

const getAccountsPath = () =>
  path.join(app.getPath('appData'), 'SorestiLauncher', 'accounts.json')

function loadAccounts(): Account[] {
  const p = getAccountsPath()
  if (!fs.existsSync(p)) return []
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return []
  }
}

function saveAccounts(accounts: Account[]) {
  const p = getAccountsPath()
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(p, JSON.stringify(accounts, null, 2))
}

export function registerAuthHandlers() {
  // Offline login
  ipcMain.handle('auth:offline-login', async (_event, username: string) => {
    if (!username || username.trim().length < 3) {
      throw new Error('Kullanıcı adı en az 3 karakter olmalı')
    }
    const accounts = loadAccounts()
    const existing = accounts.find(
      a => a.username.toLowerCase() === username.toLowerCase() && a.type === 'offline'
    )
    if (existing) return existing

    const account: Account = {
      uuid: uuidv4(),
      username: username.trim(),
      type: 'offline'
    }
    accounts.push(account)
    saveAccounts(accounts)
    return account
  })

  // Microsoft login (opens browser for OAuth)
  ipcMain.handle('auth:microsoft-login', async () => {
    throw new Error('Microsoft girişi için uygulamayı Microsoft Azure\'a kayıt etmeniz gerekiyor. Şimdilik offline mod kullanın.')
  })

  // Ely.by Login
  ipcMain.handle('auth:elyby-login', async (_event, username: string, password?: string) => {
    if (!username || !password) throw new Error('Kullanıcı adı ve şifre gereklidir')
    const https = require('https')
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        agent: { name: 'Minecraft', version: 1 },
        username: username,
        password: password,
        requestUser: true
      })
      const req = https.request('https://authserver.ely.by/auth/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
      }, (res: any) => {
        let body = ''
        res.on('data', (c: any) => body += c)
        res.on('end', () => {
          try {
            const result = JSON.parse(body)
            if (result.error) return reject(new Error(result.errorMessage || result.error))
            const profile = result.selectedProfile
            if (!profile) return reject(new Error('Ely.by profili bulunamadı'))
            
            const account: Account = {
              uuid: profile.id, // Without dashes
              username: profile.name,
              type: 'elyby',
              accessToken: result.accessToken,
              clientToken: result.clientToken
            }
            const accounts = loadAccounts().filter(a => a.username !== account.username || a.type !== 'elyby')
            accounts.push(account)
            saveAccounts(accounts)
            resolve(account)
          } catch (e) { reject(new Error('Ely.by yanıtı okunamadı')) }
        })
      })
      req.on('error', () => reject(new Error('Ely.by sunucusuna ulaşılamadı')))
      req.write(data)
      req.end()
    })
  })

  // Get all accounts
  ipcMain.handle('auth:get-accounts', async () => {
    return loadAccounts()
  })

  // Logout / remove account
  ipcMain.handle('auth:logout', async (_event, uuid: string) => {
    const accounts = loadAccounts().filter(a => a.uuid !== uuid)
    saveAccounts(accounts)
    return true
  })
}
