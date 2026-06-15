import React, { useEffect, useState } from 'react'
import { Save, FolderOpen, Cpu, HardDrive, Globe, RefreshCw } from 'lucide-react'
import { useSettingsStore } from '../store/settingsStore'
import { useToast } from '../App'

export default function SettingsPage() {
  const { settings, load, save } = useSettingsStore()
  const { toast } = useToast()
  const [local, setLocal] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [appDataPath, setAppDataPath] = useState('')

  useEffect(() => {
    load().then(() => setLocal(useSettingsStore.getState().settings))
    window.electronAPI.getAppVersion().then(setAppVersion)
    window.electronAPI.getAppDataPath().then(setAppDataPath)
  }, [])

  useEffect(() => { setLocal(settings) }, [settings])

  const handleSave = async () => {
    setSaving(true)
    try {
      await save(local)
      toast('Ayarlar kaydedildi!', 'success')
    } catch {
      toast('Kaydetme başarısız', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleBrowseDir = async () => {
    const dir = await window.electronAPI.openDirectory()
    if (dir) setLocal(l => ({ ...l, gameDir: dir }))
  }

  const update = (key: keyof typeof local, value: any) =>
    setLocal(l => ({ ...l, [key]: value }))

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Ayarlar</div>
          <div className="page-subtitle">Launcher yapılandırması</div>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />}
          Kaydet
        </button>
      </div>

      {/* Oyun */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FolderOpen size={15} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Oyun Klasörü</span>
        </div>
        <div className="settings-section">
          <div>
            <label className="input-label">Minecraft Klasörü</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={local.gameDir}
                onChange={e => update('gameDir', e.target.value)}
                placeholder={`Varsayılan: ${appDataPath}\\minecraft`}
              />
              <button className="btn btn-secondary btn-icon" style={{ width: 40, height: 40 }} onClick={handleBrowseDir}>
                <FolderOpen size={14} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Boş bırakırsanız: {appDataPath}\minecraft
            </div>
          </div>
        </div>
      </div>

      {/* Java */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cpu size={15} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Java</span>
        </div>
        <div className="settings-section">
          <div>
            <label className="input-label">Java Yolu</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={local.javaPath}
                onChange={e => update('javaPath', e.target.value)}
                placeholder="java (PATH'ten) veya tam yol"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
              />
              <button
                className="btn btn-secondary btn-icon"
                style={{ width: 40, height: 40 }}
                onClick={() => window.electronAPI.openExternal('https://adoptium.net/temurin/releases/?version=21')}
                title="Java İndir"
              >
                <Globe size={14} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Örn: C:\Program Files\Eclipse Adoptium\jre-21\bin\java.exe
            </div>
          </div>
        </div>
      </div>

      {/* RAM */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <HardDrive size={15} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Bellek (RAM)</span>
        </div>
        <div className="settings-section">
          <div className="range-container">
            <div className="range-header">
              <label className="input-label" style={{ margin: 0 }}>Maksimum RAM</label>
              <span className="range-value">{local.maxMemory} MB</span>
            </div>
            <input
              type="range"
              min={512} max={16384} step={256}
              value={local.maxMemory}
              onChange={e => update('maxMemory', Number(e.target.value))}
              style={{ accentColor: 'var(--accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>512 MB</span><span>16 GB</span>
            </div>
          </div>
          <div className="range-container">
            <div className="range-header">
              <label className="input-label" style={{ margin: 0 }}>Minimum RAM</label>
              <span className="range-value">{local.minMemory} MB</span>
            </div>
            <input
              type="range"
              min={256} max={4096} step={256}
              value={local.minMemory}
              onChange={e => update('minMemory', Number(e.target.value))}
              style={{ accentColor: 'var(--accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>256 MB</span><span>4 GB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Launcher */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={15} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Launcher</span>
        </div>
        <div className="settings-section">
          <div className="settings-row">
            <div className="settings-label-group">
              <div className="settings-label">Snapshot Versiyonlar</div>
              <div className="settings-desc">Versiyon listesinde snapshot versiyonları göster</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={local.showSnapshots} onChange={e => update('showSnapshots', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="settings-row">
            <div className="settings-label-group">
              <div className="settings-label">Oyun Açılınca Kapat</div>
              <div className="settings-desc">Minecraft başlatıldığında launcher'ı kapat</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={local.closeOnLaunch} onChange={e => update('closeOnLaunch', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>

      {/* Hakkında */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Soresti Launcher</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>v{appVersion} · Electron + React + TypeScript</div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => window.electronAPI.openExternal('https://github.com')}
            style={{ fontSize: 12 }}
          >
            GitHub
          </button>
        </div>
      </div>
    </div>
  )
}
