import React, { useEffect, useState } from 'react'
import { Play, Square, Download, AlertTriangle, Cpu, HardDrive, Clock, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { useToast } from '../App'

const MC_VERSION = '1.21.4'

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { currentAccount } = useAuthStore()
  const {
    installedVersions, isRunning, isDownloading,
    downloadProgress, setRunning, loadInstalledVersions,
    setDownloading, setDownloadProgress
  } = useGameStore()
  const { settings, load: loadSettings } = useSettingsStore()
  const { toast } = useToast()
  const [javaStatus, setJavaStatus] = useState<{ found: boolean; version: string | null } | null>(null)
  const [javaLoading, setJavaLoading] = useState(true)
  const [playtime, setPlaytime] = useState(0)
  const [playTimer, setPlayTimer] = useState<NodeJS.Timeout | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    loadInstalledVersions()
    loadSettings()
    checkJava()

    window.electronAPI.onGameLog((line) => {
      useGameStore.getState().addLog(line)
    })
    window.electronAPI.onGameExit((code) => {
      setRunning(false)
      if (playTimer) clearInterval(playTimer)
      toast(code === 0 ? t('home.gameClosed') : t('home.gameClosedWithCode', { code }), code === 0 ? 'info' : 'warning')
    })
    window.electronAPI.onDownloadComplete((id) => {
      if (id === MC_VERSION) {
        setInstalling(false)
        setDownloading(false)
        setDownloadProgress(null)
        loadInstalledVersions()
        toast(`Minecraft ${MC_VERSION} yüklendi!`, 'success')
      }
    })
    window.electronAPI.onDownloadProgress((data) => {
      if (data.versionId === MC_VERSION) {
        setDownloadProgress(data)
      }
    })
    return () => {
      window.electronAPI.removeAllListeners('game:log')
      window.electronAPI.removeAllListeners('game:exit')
      window.electronAPI.removeAllListeners('download:complete')
      window.electronAPI.removeAllListeners('download:progress')
    }
  }, [])

  const checkJava = async () => {
    setJavaLoading(true)
    try {
      const result = await window.electronAPI.checkJava()
      setJavaStatus(result)
    } catch {
      setJavaStatus({ found: false, version: null })
    } finally {
      setJavaLoading(false)
    }
  }

  // Check pre-bundled files on mount
  useEffect(() => {
    const timer = setTimeout(async () => {
      await loadInstalledVersions()
      // Ensure Fabric + overlay mod is set up from bundled assets
      try {
        const result = await window.electronAPI.ensureFabric(MC_VERSION)
        if (!result.alreadyInstalled) {
          toast('Fabric + Overlay kuruldu!', 'success')
        }
      } catch {}
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  const handlePlay = async () => {
    if (isRunning) {
      window.electronAPI.killGame()
      setRunning(false)
      if (playTimer) clearInterval(playTimer)
      return
    }

    if (!installedVersions.includes(MC_VERSION)) {
      toast(`Önce Minecraft ${MC_VERSION} yüklenmeli`, 'warning')
      return
    }

    if (!javaStatus?.found) {
      toast(t('home.javaNotFound'), 'error')
      return
    }

    const javaPath = settings.javaPath?.trim() || ''

    try {
      setRunning(true)
      useGameStore.getState().clearLogs()
      const timer = setInterval(() => setPlaytime(p => p + 1), 1000)
      setPlayTimer(timer)

      await window.electronAPI.launchGame({
        versionId: MC_VERSION,
        accountUUID: currentAccount!.uuid,
        accountUsername: currentAccount!.username,
        accountType: currentAccount!.type,
        gameDir: settings.gameDir,
        javaPath: javaPath,
        maxMemory: settings.maxMemory,
        minMemory: settings.minMemory
      })
    } catch (err: any) {
      setRunning(false)
      toast(err.message || t('home.gameFailed'), 'error')
    }
  }

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return t('home.timeHours', { h, m })
    if (m > 0) return t('home.timeMinutes', { m, sec })
    return t('home.timeSeconds', { sec })
  }

  return (
    <div className="page fade-in">
      {/* Hero */}
      <div className="home-hero">
        <div className="home-hero-bg" />
        <div className="home-hero-grid" />
        <div className="home-hero-content">
          <div className="hero-selected-version">
            <span className="badge badge-release">Oynanıyor</span>
            <span>Minecraft {MC_VERSION}</span>
          </div>
          <div className="hero-title">
            {t('home.heroReady')} <span>{t('home.heroEmphasis')}</span><br />
            {t('home.heroQuestion')}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            {t('home.playingAs', { username: currentAccount?.username })}
          </div>
          <div className="hero-actions">
            <button
              className={`play-btn ${isRunning ? 'playing' : ''}`}
              onClick={handlePlay}
              disabled={installing || isDownloading}
            >
              {isRunning ? <><Square size={18} fill="white" /> {t('home.stop')}</> : <><Play size={18} fill="black" /> {t('home.play')}</>}
            </button>

            {(installing || isDownloading) && downloadProgress && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, maxWidth: 280 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {downloadProgress.task || 'Minecraft 1.21.4 indiriliyor...'}
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${downloadProgress.percent}%` }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {downloadProgress.percent.toFixed(0)}%
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Java uyarısı */}
      {!javaLoading && javaStatus !== null && !javaStatus.found && settings.javaPath && settings.javaPath.trim() !== '' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: 'var(--warning-dim)', border: '1px solid rgba(255,171,64,0.3)',
          borderRadius: 'var(--radius-md)', color: 'var(--warning)', fontSize: 13
        }}>
          <AlertTriangle size={16} />
          <span>{t('home.javaPathWarning')}</span>
        </div>
      )}

      {/* Stats */}
      <div className="stats-row">
        <div className="card stat-card">
          <div className="stat-label">Sürüm</div>
          <div className="stat-value">{MC_VERSION}</div>
          <div className="stat-sub">{installedVersions.includes(MC_VERSION) ? '✅ Yüklü' : '⬇ Yükleniyor...'}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label"><Cpu size={11} style={{ display: 'inline', marginRight: 4 }} />{t('home.java')}</div>
          <div className="stat-value" style={{ fontSize: 16 }}>
            {settings.javaPath ? t('home.javaCustom') : t('home.javaAuto')}
          </div>
          <div className="stat-sub">{settings.javaPath ? t('home.javaManualPath') : t('home.javaAutoActive')}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label"><HardDrive size={11} style={{ display: 'inline', marginRight: 4 }} />{t('home.ram')}</div>
          <div className="stat-value">{settings.maxMemory} MB</div>
          <div className="stat-sub">min {settings.minMemory} MB</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label"><Clock size={11} style={{ display: 'inline', marginRight: 4 }} />{t('home.playtime')}</div>
          <div className="stat-value" style={{ color: isRunning ? 'var(--accent)' : undefined }}>
            {isRunning ? formatTime(playtime) : '0s'}
          </div>
          <div className="stat-sub">{isRunning ? t('home.statusRunning') : t('home.statusIdle')}</div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '16px 20px', flex: 1, cursor: 'pointer' }}
          onClick={() => navigate('/mods')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(64,196,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={16} color="var(--info)" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t('home.quickMods')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('home.quickModsSub')}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: '16px 20px', flex: 1, cursor: 'pointer' }}
          onClick={() => navigate('/console')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,171,64,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="var(--warning)" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t('home.quickConsole')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('home.quickConsoleSub')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Package(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={props.style}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
}
