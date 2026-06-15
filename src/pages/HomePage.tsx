import React, { useEffect, useState } from 'react'
import { Play, Square, Download, AlertTriangle, Cpu, HardDrive, Clock, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { useToast } from '../App'

export default function HomePage() {
  const navigate = useNavigate()
  const { currentAccount } = useAuthStore()
  const {
    selectedVersion, installedVersions, isRunning, isDownloading,
    downloadProgress, setRunning, loadInstalledVersions
  } = useGameStore()
  const { settings, load: loadSettings } = useSettingsStore()
  const { toast } = useToast()
  const [javaStatus, setJavaStatus] = useState<{ found: boolean; version: string | null } | null>(null)
  const [javaLoading, setJavaLoading] = useState(true)
  const [playtime, setPlaytime] = useState(0)
  const [playTimer, setPlayTimer] = useState<NodeJS.Timeout | null>(null)

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
      toast(code === 0 ? 'Minecraft kapatıldı' : `Minecraft kapandı (kod: ${code})`, code === 0 ? 'info' : 'warning')
    })
    return () => {
      window.electronAPI.removeAllListeners('game:log')
      window.electronAPI.removeAllListeners('game:exit')
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

  const handlePlay = async () => {
    if (isRunning) {
      window.electronAPI.killGame()
      setRunning(false)
      if (playTimer) clearInterval(playTimer)
      return
    }

    if (!selectedVersion) {
      toast('Bir versiyon seçin', 'warning')
      navigate('/versions')
      return
    }

    if (!javaStatus?.found) {
      toast('Java bulunamadı! Ayarlar > Java Yolu ayarlayın', 'error')
      return
    }
    // settings.javaPath yoksa backend kendi otomatik Java'yı (ensureJava) indirecek ve kullanacak.
    const javaPath = settings.javaPath?.trim() || ''

    try {
      setRunning(true)
      useGameStore.getState().clearLogs()
      const timer = setInterval(() => setPlaytime(p => p + 1), 1000)
      setPlayTimer(timer)

      await window.electronAPI.launchGame({
        versionId: selectedVersion,
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
      toast(err.message || 'Oyun başlatılamadı', 'error')
    }
  }

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}s ${m}d`
    if (m > 0) return `${m}d ${sec}s`
    return `${sec}s`
  }

  const displayVersion = selectedVersion || (installedVersions[0] ?? null)

  return (
    <div className="page fade-in">
      {/* Hero */}
      <div className="home-hero">
        <div className="home-hero-bg" />
        <div className="home-hero-grid" />
        <div className="home-hero-content">
          {displayVersion && (
            <div className="hero-selected-version">
              <span className="badge badge-release">Seçili</span>
              <span>{displayVersion}</span>
            </div>
          )}
          <div className="hero-title">
            Oynamaya <span>hazır</span><br />
            mısın?
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            {currentAccount?.username} olarak oynuyorsun
          </div>
          <div className="hero-actions">
            <button
              className={`play-btn ${isRunning ? 'playing' : ''}`}
              onClick={handlePlay}
              disabled={isDownloading}
            >
              {isRunning ? <><Square size={18} fill="white" /> Durdur</> : <><Play size={18} fill="black" /> Oyna</>}
            </button>

            {!selectedVersion && (
              <button className="btn btn-secondary" onClick={() => navigate('/versions')}>
                <Download size={14} /> Versiyon Seç
              </button>
            )}

            {isDownloading && downloadProgress && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, maxWidth: 280 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {downloadProgress.task}
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

      {/* Warnings - Artık sadece elle girilen hatalı yolları veya genel sistem uyarılarını vereceğiz ama Java otomatik indiği için bu uyarıyı büyük oranda kaldırabiliriz, şimdilik Java yolu boşsa uyarı vermiyoruz çünkü auto-java devrede. */}
      {!javaLoading && javaStatus !== null && !javaStatus.found && settings.javaPath && settings.javaPath.trim() !== '' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: 'var(--warning-dim)', border: '1px solid rgba(255,171,64,0.3)',
          borderRadius: 'var(--radius-md)', color: 'var(--warning)', fontSize: 13
        }}>
          <AlertTriangle size={16} />
          <span>Belirtilen Özel Java yolu hatalı. Ayarları sıfırlayın veya düzeltin.</span>
        </div>
      )}

      {/* Stats */}
      <div className="stats-row">
        <div className="card stat-card">
          <div className="stat-label"><Layers size={11} style={{ display: 'inline', marginRight: 4 }} />Versiyon</div>
          <div className="stat-value">{displayVersion ?? '—'}</div>
          <div className="stat-sub">{installedVersions.length} versiyon yüklü</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label"><Cpu size={11} style={{ display: 'inline', marginRight: 4 }} />Java</div>
          <div className="stat-value" style={{ fontSize: 16 }}>
            {settings.javaPath ? 'Özel' : 'Otomatik'}
          </div>
          <div className="stat-sub">{settings.javaPath ? 'Manuel Yol' : 'Auto-JRE Aktif'}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label"><HardDrive size={11} style={{ display: 'inline', marginRight: 4 }} />RAM</div>
          <div className="stat-value">{settings.maxMemory} MB</div>
          <div className="stat-sub">min {settings.minMemory} MB</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label"><Clock size={11} style={{ display: 'inline', marginRight: 4 }} />Oynama</div>
          <div className="stat-value" style={{ color: isRunning ? 'var(--accent)' : undefined }}>
            {isRunning ? formatTime(playtime) : '0s'}
          </div>
          <div className="stat-sub">{isRunning ? '🟢 Oyunda' : 'Beklemede'}</div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '16px 20px', flex: 1, cursor: 'pointer' }}
          onClick={() => navigate('/versions')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={16} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Versiyonlar</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{installedVersions.length} yüklü</div>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: '16px 20px', flex: 1, cursor: 'pointer' }}
          onClick={() => navigate('/mods')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(64,196,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={16} color="var(--info)" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Modlar</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Modrinth</div>
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
              <div style={{ fontSize: 13, fontWeight: 700 }}>Konsol</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Oyun çıktısı</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Layers(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={props.style}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
}

function Package(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={props.style}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
}
