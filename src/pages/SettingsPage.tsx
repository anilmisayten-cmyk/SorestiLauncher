import React, { useEffect, useState } from 'react'
import { Save, FolderOpen, Cpu, HardDrive, Globe, RefreshCw, Eye, MousePointer, Keyboard, Gamepad2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../store/settingsStore'
import { useToast } from '../App'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
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
      toast(t('settings.saved'), 'success')
    } catch {
      toast(t('settings.saveFailed'), 'error')
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
          <div className="page-title">{t('settings.title')}</div>
          <div className="page-subtitle">{t('settings.subtitle')}</div>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />}
          {t('settings.save')}
        </button>
      </div>

      {/* Oyun */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FolderOpen size={15} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>{t('settings.gameFolder')}</span>
        </div>
        <div className="settings-section">
          <div>
            <label className="input-label">{t('settings.mcFolder')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={local.gameDir}
                onChange={e => update('gameDir', e.target.value)}
                placeholder={t('settings.mcFolderPlaceholder', { path: appDataPath + '\\minecraft' })}
              />
              <button className="btn btn-secondary btn-icon" style={{ width: 40, height: 40 }} onClick={handleBrowseDir}>
                <FolderOpen size={14} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {t('settings.mcFolderHelp', { path: appDataPath + '\\minecraft' })}
            </div>
          </div>
        </div>
      </div>

      {/* Java */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cpu size={15} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>{t('settings.java')}</span>
        </div>
        <div className="settings-section">
          <div>
            <label className="input-label">{t('settings.javaPath')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={local.javaPath}
                onChange={e => update('javaPath', e.target.value)}
                placeholder={t('settings.javaPlaceholder')}
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
              />
              <button
                className="btn btn-secondary btn-icon"
                style={{ width: 40, height: 40 }}
                onClick={() => window.electronAPI.openExternal('https://adoptium.net/temurin/releases/?version=21')}
                title={t('settings.javaDownload')}
              >
                <Globe size={14} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {t('settings.javaHelp')}
            </div>
          </div>
        </div>
      </div>

      {/* RAM */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <HardDrive size={15} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>{t('settings.memory')}</span>
        </div>
        <div className="settings-section">
          <div className="range-container">
            <div className="range-header">
              <label className="input-label" style={{ margin: 0 }}>{t('settings.maxRam')}</label>
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
              <label className="input-label" style={{ margin: 0 }}>{t('settings.minRam')}</label>
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
          <span style={{ fontWeight: 700, fontSize: 14 }}>{t('settings.launcher')}</span>
        </div>
        <div className="settings-section">
          <div className="settings-row">
            <div className="settings-label-group">
              <div className="settings-label">{t('settings.showSnapshots')}</div>
              <div className="settings-desc">{t('settings.showSnapshotsDesc')}</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={local.showSnapshots} onChange={e => update('showSnapshots', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="settings-row">
            <div className="settings-label-group">
              <div className="settings-label">{t('settings.language')}</div>
              <div className="settings-desc">{t('settings.languageDesc')}</div>
            </div>
            <select
              className="input"
              style={{ width: 140, padding: '0 10px', height: 34 }}
              value={local.language}
              onChange={e => { const v = e.target.value; update('language', v); i18n.changeLanguage(v) }}
            >
              <option value="tr">🇹🇷 Türkçe</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>
          <div className="settings-row">
            <div className="settings-label-group">
              <div className="settings-label">{t('settings.closeOnLaunch')}</div>
              <div className="settings-desc">{t('settings.closeOnLaunchDesc')}</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={local.closeOnLaunch} onChange={e => update('closeOnLaunch', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>

      {/* Overlay */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eye size={15} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>{t('settings.overlay')}</span>
        </div>
        <div className="settings-section">
          <div className="settings-row">
            <div className="settings-label-group">
              <div className="settings-label">{t('settings.overlayEnabled')}</div>
              <div className="settings-desc">{t('settings.overlayEnabledDesc')}</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={local.overlayEnabled} onChange={e => update('overlayEnabled', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
          {local.overlayEnabled && <>
            <div className="settings-row">
              <div className="settings-label-group">
                <div className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MousePointer size={13} color="var(--accent)" /> {t('settings.overlayCPS')}
                </div>
                <div className="settings-desc">{t('settings.overlayCPSDesc')}</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={local.overlayShowCPS} onChange={e => update('overlayShowCPS', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="settings-row">
              <div className="settings-label-group">
                <div className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Keyboard size={13} color="var(--accent)" /> {t('settings.overlayKeys')}
                </div>
                <div className="settings-desc">{t('settings.overlayKeysDesc')}</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={local.overlayShowKeystrokes} onChange={e => update('overlayShowKeystrokes', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="settings-row">
              <div className="settings-label-group">
                <div className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Gamepad2 size={13} color="var(--accent)" /> {t('settings.overlayCursor')}
                </div>
                <div className="settings-desc">{t('settings.overlayCursorDesc')}</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={local.overlayShowCursor} onChange={e => update('overlayShowCursor', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
          </>}
        </div>
      </div>

      {/* Hakkında */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700 }}>{t('app.name')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('settings.appVersion', { version: appVersion })}</div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => window.electronAPI.openExternal('https://github.com')}
            style={{ fontSize: 12 }}
          >
            {t('settings.github')}
          </button>
        </div>
      </div>
    </div>
  )
}
