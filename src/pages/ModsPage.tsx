import React, { useState, useEffect, useCallback } from 'react'
import { Search, Download, Trash2, FolderOpen, Package, Layers, RefreshCw, X, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { useToast } from '../App'

interface ModResult {
  project_id: string
  slug: string
  title: string
  description: string
  author: string
  icon_url: string | null
  downloads: number
  categories: string[]
  versions: string[]
  project_type: string
}

interface ModVersion {
  id: string
  name: string
  version_number: string
  game_versions: string[]
  loaders: string[]
  files: { url: string; filename: string; primary: boolean }[]
  date_published: string
}

interface InstalledMod {
  name: string
  size: number
  modified: string
}

type ActiveTab = 'browse' | 'installed' | 'fabric'

const LOADER_OPTIONS = (t: any) => [
  { value: 'all', label: t('mods.allLoaders') },
  { value: 'fabric', label: t('mods.loaderFabric') },
  { value: 'forge', label: t('mods.loaderForge') },
  { value: 'quilt', label: t('mods.loaderQuilt') },
  { value: 'neoforge', label: t('mods.loaderNeoForge') },
]

const POPULAR_VERSIONS = ['1.21.4', '1.21.1', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.8.9']

export default function ModsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<ActiveTab>('browse')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ModResult[]>([])
  const [loading, setLoading] = useState(false)
  const [gameVersion, setGameVersion] = useState('')
  const [loader, setLoader] = useState('all')

  // Mod version picker modal
  const [selectedMod, setSelectedMod] = useState<ModResult | null>(null)
  const [modVersions, setModVersions] = useState<ModVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [downloadingMod, setDownloadingMod] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({})

  // Installed
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([])
  const [loadingInstalled, setLoadingInstalled] = useState(false)

  // Fabric
  const [fabricGameVersion, setFabricGameVersion] = useState('1.21.4')
  const [fabricLoaders, setFabricLoaders] = useState<any[]>([])
  const [loadingFabric, setLoadingFabric] = useState(false)
  const [installingFabric, setInstallingFabric] = useState<string | null>(null)
  const [fabricProgress, setFabricProgress] = useState(0)

  const { installedVersions } = useGameStore()
  const { toast } = useToast()

  useEffect(() => {
    searchMods('')
    window.electronAPI.onModProgress?.((data: any) => {
      setDownloadProgress(prev => ({ ...prev, [data.fileName]: data.percent }))
      if (data.fileName && data.fileName.startsWith('fabric')) {
        setFabricProgress(data.percent)
      }
    })
    window.electronAPI.onModDone?.((data: any) => {
      setDownloadProgress(prev => {
        const next = { ...prev }
        delete next[data.fileName]
        return next
      })
      setDownloadingMod(null)
      if (data.fileName?.startsWith('fabric')) {
        setInstallingFabric(null)
        setFabricProgress(0)
        toast(t('mods.fabricInstalled'), 'success')
      }
    })
    return () => {
      window.electronAPI.removeAllListeners('mods:progress')
      window.electronAPI.removeAllListeners('mods:done')
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'installed') loadInstalledMods()
    if (activeTab === 'fabric') loadFabricLoaders()
  }, [activeTab, fabricGameVersion])

  const searchMods = async (q: string) => {
    setLoading(true)
    try {
      const data = await window.electronAPI.searchMods(q, gameVersion || undefined, loader !== 'all' ? loader : undefined)
      setResults(data?.hits ?? [])
    } catch {
      toast(t('mods.modrinthError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadInstalledMods = async () => {
    setLoadingInstalled(true)
    try {
      const mods = await window.electronAPI.getInstalledMods()
      setInstalledMods(mods)
    } catch {}
    finally { setLoadingInstalled(false) }
  }

  const loadFabricLoaders = async () => {
    setLoadingFabric(true)
    try {
      const loaders = await window.electronAPI.getFabricLoaders(fabricGameVersion)
      setFabricLoaders(loaders ?? [])
    } catch {
      setFabricLoaders([])
      toast(t('mods.fabricLoaderNotFound', { version: fabricGameVersion }), 'warning')
    } finally {
      setLoadingFabric(false)
    }
  }

  const openModVersions = async (mod: ModResult) => {
    setSelectedMod(mod)
    setModVersions([])
    setLoadingVersions(true)
    try {
      const versions = await window.electronAPI.getModVersions(
        mod.project_id,
        gameVersion || undefined,
        loader !== 'all' ? loader : undefined
      )
      setModVersions(versions ?? [])
    } catch {
      toast(t('mods.versionInfoFailed'), 'error')
    } finally {
      setLoadingVersions(false)
    }
  }

  const downloadMod = async (version: ModVersion) => {
    const file = version.files.find(f => f.primary) ?? version.files[0]
    if (!file) { toast(t('mods.noFileFound'), 'error'); return }
    setDownloadingMod(file.filename)
    try {
      const result = await window.electronAPI.downloadMod(file.url, file.filename, version.id)
      if (result.alreadyExists) {
        toast(t('mods.alreadyInstalled', { filename: file.filename }), 'info')
      } else {
        toast(t('mods.downloadedMod', { filename: file.filename }), 'success')
      }
      setSelectedMod(null)
    } catch (e: any) {
      toast(e.message || t('mods.downloadFailed'), 'error')
      setDownloadingMod(null)
    }
  }

  const deleteMod = async (fileName: string) => {
    try {
      await window.electronAPI.deleteMod(fileName)
      toast(t('mods.modDeleted', { fileName }), 'info')
      loadInstalledMods()
    } catch {
      toast(t('mods.deleteFailed'), 'error')
    }
  }

  const installFabric = async (loaderVersion: string) => {
    setInstallingFabric(loaderVersion)
    setFabricProgress(0)
    try {
      const result = await window.electronAPI.installFabric(fabricGameVersion, loaderVersion)
      if (result.alreadyInstalled) {
        toast(t('mods.fabricAlreadyInstalled'), 'info')
        setInstallingFabric(null)
      }
    } catch (e: any) {
      toast(e.message || t('mods.fabricInstallFailed'), 'error')
      setInstallingFabric(null)
    }
  }

  const formatDownloads = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return n.toString()
  }

  const formatSize = (bytes: number) => {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`
    return `${bytes} B`
  }

  return (
    <div className="page fade-in" style={{ position: 'relative' }}>
      {/* Header */}
      <div className="page-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <div>
          <div className="page-title">{t('mods.title')}</div>
          <div className="page-subtitle">{t('mods.subtitle')}</div>
        </div>
        <button className="btn btn-secondary" onClick={() => window.electronAPI.openModsFolder()}>
          <FolderOpen size={13} /> {t('mods.modsFolder')}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 24, padding: '0 30px', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([
          { id: 'browse', label: t('mods.search'), icon: null },
          { id: 'installed', label: t('mods.installedTab', { count: installedMods.length }), icon: null },
          { id: 'fabric', label: t('mods.installFabric'), icon: null },
        ] as const).map(tab => (
          <div
            key={tab.id}
            style={{
              padding: '12px 0', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* ─── BROWSE TAB ─── */}
      {activeTab === 'browse' && (
        <>
          <form onSubmit={e => { e.preventDefault(); searchMods(query) }} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
              <Search size={14} className="search-icon" />
              <input
                className="input search-input"
                placeholder={t('mods.searchPlaceholder')}
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <select
              className="input"
              style={{ width: 140, padding: '0 10px' }}
              value={gameVersion}
              onChange={e => setGameVersion(e.target.value)}
            >
              <option value="">{t('mods.allVersions')}</option>
              {POPULAR_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select
              className="input"
              style={{ width: 160, padding: '0 10px' }}
              value={loader}
              onChange={e => setLoader(e.target.value)}
            >
              {LOADER_OPTIONS(t).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <Search size={13} />} {t('mods.searchBtn')}
            </button>
          </form>

          {loading ? (
            <div className="loading-overlay"><div className="spinner" /><span>{t('mods.searching')}</span></div>
          ) : results.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">{t('mods.noResults')}</div>
              <div className="empty-state-desc">{t('mods.changeSearch')}</div>
            </div>
          ) : (
            <div className="mod-grid">
              {results.map(mod => (
                <div key={mod.project_id} className="card mod-card" style={{ cursor: 'pointer' }} onClick={() => openModVersions(mod)}>
                  <div className="mod-card-header">
                    {mod.icon_url
                      ? <img src={mod.icon_url} alt={mod.title} className="mod-icon" />
                      : <div className="mod-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📦</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mod-name">{mod.title}</div>
                      <div className="mod-author">{t('mods.by')} {mod.author}</div>
                    </div>
                  </div>
                  <div className="mod-desc">{mod.description}</div>
                  <div className="mod-footer">
                    <div className="mod-downloads">⬇ {formatDownloads(mod.downloads)}</div>
                    <button
                      className="btn btn-primary"
                      style={{ padding: '5px 12px', fontSize: 11 }}
                      onClick={e => { e.stopPropagation(); openModVersions(mod) }}
                    >
                      <Download size={11} /> {t('mods.download')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── INSTALLED TAB ─── */}
      {activeTab === 'installed' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('mods.installedInfo', { count: installedMods.length })}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={loadInstalledMods} disabled={loadingInstalled}>
                <RefreshCw size={13} className={loadingInstalled ? 'spinning' : ''} /> {t('mods.refresh')}
              </button>
              <button className="btn btn-secondary" onClick={() => window.electronAPI.openModsFolder()}>
                <FolderOpen size={13} /> {t('mods.openFolder')}
              </button>
            </div>
          </div>

          {loadingInstalled ? (
            <div className="loading-overlay"><div className="spinner" /></div>
          ) : installedMods.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <div className="empty-state-title">{t('mods.noModsInstalled')}</div>
              <div className="empty-state-desc">{t('mods.noModsDesc')}</div>
            </div>
          ) : (
            <div className="version-list">
              {installedMods.map(mod => (
                <div key={mod.name} className="version-item">
                  <div className="version-icon" style={{ fontSize: 18 }}>🔧</div>
                  <div className="version-info">
                    <div className="version-id" style={{ fontSize: 13 }}>{mod.name}</div>
                    <div className="version-date">{formatSize(mod.size)}</div>
                  </div>
                  <div className="version-actions">
                    <button
                      className="btn btn-danger"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      onClick={() => deleteMod(mod.name)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── FABRIC TAB ─── */}
      {activeTab === 'fabric' && (
        <>
          <div className="card" style={{ padding: '16px 20px', marginBottom: 20, background: 'rgba(118,66,138,0.1)', border: '1px solid rgba(118,66,138,0.3)' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('mods.fabricInstallTitle')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {t('mods.fabricInstallDesc')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{t('mods.mcVersion')}</span>
            <select
              className="input"
              style={{ width: 160, padding: '0 10px' }}
              value={fabricGameVersion}
              onChange={e => setFabricGameVersion(e.target.value)}
            >
              {POPULAR_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={loadFabricLoaders} disabled={loadingFabric}>
              <RefreshCw size={13} className={loadingFabric ? 'spinning' : ''} /> {t('mods.refresh')}
            </button>
          </div>

          {loadingFabric ? (
            <div className="loading-overlay"><div className="spinner" /><span>{t('mods.fabricLoading')}</span></div>
          ) : fabricLoaders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🧵</div>
              <div className="empty-state-title">{t('mods.fabricNotFound')}</div>
            </div>
          ) : (
            <div className="version-list">
              {fabricLoaders.slice(0, 10).map((entry: any, i: number) => {
                const lv = entry.loader?.version ?? entry.loader
                const isInstalling = installingFabric === lv
                return (
                  <div key={lv} className="version-item">
                    <div className="version-icon" style={{ fontSize: 18 }}>🧵</div>
                    <div className="version-info">
                      <div className="version-id">fabric-loader-{lv}</div>
                      <div className="version-date">Minecraft {fabricGameVersion} {i === 0 ? t('mods.latestBadge') : ''}</div>
                    </div>
                    <div className="version-actions">
                      {isInstalling && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className="progress-fill" style={{ width: `${fabricProgress}%` }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--accent)' }}>{fabricProgress}%</span>
                        </div>
                      )}
                      <button
                        className={`btn ${i === 0 ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '6px 14px', fontSize: 12 }}
                        disabled={!!installingFabric}
                        onClick={() => installFabric(lv)}
                      >
                        {isInstalling
                          ? <><span className="spinner" style={{ width: 12, height: 12 }} /> {t('mods.installing')}</>
                          : <><Download size={12} /> {t('mods.install')}</>
                        }
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ─── MOD VERSION MODAL ─── */}
      {selectedMod && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={() => setSelectedMod(null)}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 560,
            maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              {selectedMod.icon_url
                ? <img src={selectedMod.icon_url} alt="" style={{ width: 40, height: 40, borderRadius: 8 }} />
                : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📦</div>
              }
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedMod.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('mods.modalBy')} {selectedMod.author}</div>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px 8px' }} onClick={() => setSelectedMod(null)}>
                <X size={14} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ overflow: 'auto', flex: 1, padding: '12px 20px' }}>
              {loadingVersions ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <div className="spinner" />
                </div>
              ) : modVersions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {gameVersion
                    ? t('mods.modalNoVersionFilter', { gameVersion })
                    : t('mods.modalNoVersion')
                  }
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {modVersions.slice(0, 15).map(v => {
                    const file = v.files.find(f => f.primary) ?? v.files[0]
                    const isDownloading = downloadingMod === file?.filename
                    const progress = file ? downloadProgress[file.filename] : undefined
                    return (
                      <div key={v.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{v.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {v.game_versions.slice(0, 3).join(', ')}
                            {v.loaders.length > 0 && ` · ${v.loaders.join(', ')}`}
                          </div>
                          {isDownloading && progress !== undefined && (
                            <div className="progress-bar" style={{ marginTop: 6 }}>
                              <div className="progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                          )}
                        </div>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '6px 14px', fontSize: 12, flexShrink: 0 }}
                          disabled={!!downloadingMod}
                          onClick={() => downloadMod(v)}
                        >
                          {isDownloading
                            ? <><span className="spinner" style={{ width: 12, height: 12 }} /> {progress ?? 0}%</>
                            : <><Download size={12} /> {t('mods.modalDownload')}</>
                          }
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
