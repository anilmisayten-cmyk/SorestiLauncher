import DiscordRPC from 'discord-rpc'

const CLIENT_ID = '1516212083149111448'
let rpc: DiscordRPC.Client | null = null
let ready = false

export async function initDiscord() {
  try {
    DiscordRPC.register(CLIENT_ID)
    rpc = new DiscordRPC.Client({ transport: 'ipc' })
    rpc.on('ready', () => {
      ready = true
      setStatus('Launcherda', 'Menude')
    })
    await rpc.login({ clientId: CLIENT_ID })
  } catch {}
}

export function setStatus(details: string, state: string) {
  if (!ready || !rpc) return
  try {
    rpc.setActivity({
      details,
      state,
      startTimestamp: Date.now(),
      largeImageKey: 'soresti',
      largeImageText: 'Soresti Launcher',
      instance: false
    })
  } catch {}
}

export function destroyDiscord() {
  ready = false
  try { rpc?.destroy() } catch {}
  rpc = null
}
