import React, { useEffect, useState, useMemo } from 'react'
import { Download, Trash2, Search, RefreshCw, CheckCircle, Filter } from 'lucide-react'
import { useGameStore } from '../store/gameStore'
import { useToast } from '../App'

interface VersionEntry {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  releaseTime: string
}

interface VersionManifest {
  latest: { release: string; snapshot: string }
  versions: VersionEntry[]
}

const TYPE_LABELS: Record<string, string> = {
  release: 'Release',
  snapshot: 'Snapshot',
  old_beta: 'Beta',
  old_alpha: 'Alpha'
}

const TYPE_EMOJIS: Record<string, string> = {
  release: '⛏️',
  snapshot: '🔬',
  old_beta: '🧪',
  old_alpha: '📜'
}

export default function VersionsPage() {
  const [manifest, setManifest] = useState<VersionManifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'release' | 'snapshot' | 'old_beta' | 'old_alpha'>('all')
  const [activeTab, setActiveTab] = useState<'all' | 'installed'>('all')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const {
    installedVersions, selectedVersion, setSelectedVersion,
    isDownloading, setDownloading: setGlobalDownloading,
    setDownloadProgress, downloadProgress, loadInstalledVersions
  } = useGameStore()
  const { toast } = useToast()

  useEffect(() => {
    fetchManifest()
    loadInstalledVersions()

    window.electronAPI.onDownloadProgress((data) => {
      setDownloadProgress(data)
    })
    window.electronAPI.onDownloadComplete((id) => {
      setDownloading(null)
      setGlobalDownloading(false)
      setDownloadProgress(null)
      loadInstalledVersions()
      toast(`${id} başarıyla indirildi!`, 'success')
    })
    return () => {
      window.electronAPI.removeAllListeners('download:progress')
      window.electronAPI.removeAllListeners('download:complete')
    }
  }, [])

  const fetchManifest = async () => {
    setLoading(true)
    try {
      const data = await window.electronAPI.getVersionList()
      setManifest(data)
    } catch (err: any) {
      toast(err.message || 'Versiyon listesi alınamadı', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleInstall = async (versionId: string) => {
    if (isDownloading) { toast('Zaten bir indirme devam ediyor', 'warning'); return }
    setDownloading(versionId)
    setGlobalDownloading(true)
    try {
      await window.electronAPI.installVersion(versionId)
    } catch (err: any) {
      toast(err.message || 'İndirme başarısız', 'error')
      setDownloading(null)
      setGlobalDownloading(false)
    }
  }

  const handleDelete = async (versionId: string) => {
    setDeleting(versionId)
    try {
      await window.electronAPI.deleteVersion(versionId)
      await loadInstalledVersions()
      if (selectedVersion === versionId) setSelectedVersion('')
      toast(`${versionId} silindi`, 'info')
    } catch {
      toast('Silme başarısız', 'error')
    } finally {
      setDeleting(null)
    }
  }

  const handleSelect = (id: string) => {
    setSelectedVersion(id)
    toast(`${id} seçildi`, 'success')
  }

  const filtered = useMemo(() => {
    if (!manifest) return []
    return manifest.versions.filter(v => {
      const isInstalled = installedVersions.includes(v.id)
      if (activeTab === 'installed' && !isInstalled) return false
      if (filter !== 'all' && v.type !== filter) return false
      if (search && !v.id.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [manifest, filter, search, activeTab, installedVersions])

  const releaseDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('tr-TR') }
    catch { return iso }
  }

  return (
    <div className="page fade-in">
      <div className="page-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <div>
          <div className="page-title">Versiyonlar</div>
          <div className="page-subtitle">
            {manifest ? `${manifest.versions.length} versiyon mevcut` : 'Yükleniyor...'}
            {' · '}{installedVersions.length} yüklü
          </div>
        </div>
        <button className="btn btn-secondary" onClick={fetchManifest} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spinning' : ''} /> Yenile
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 20, padding: '0 30px', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <div 
          style={{ padding: '12px 0', cursor: 'pointer', fontWeight: 600, color: activeTab === 'all' ? 'var(--accent)' : 'var(--text-muted)', borderBottom: activeTab === 'all' ? '2px solid var(--accent)' : '2px solid transparent', transition: 'all 0.2s' }}
          onClick={() => setActiveTab('all')}
        >
          Tüm Versiyonlar
        </div>
        <div 
          style={{ padding: '12px 0', cursor: 'pointer', fontWeight: 600, color: activeTab === 'installed' ? 'var(--accent)' : 'var(--text-muted)', borderBottom: activeTab === 'installed' ? '2px solid var(--accent)' : '2px solid transparent', transition: 'all 0.2s' }}
          onClick={() => setActiveTab('installed')}
        >
          Yüklü Sürümler <span style={{ background: 'var(--card-bg)', padding: '2px 8px', borderRadius: 12, fontSize: 11, marginLeft: 6 }}>{installedVersions.length}</span>
        </div>
      </div>

      {/* Active download banner */}
      {downloading && downloadProgress && (
        <div className="card card-accent" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span className="spinner" />
            <span style={{ fontWeight: 600 }}>{downloading} indiriliyor</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent)' }}>
              {downloadProgress.percent.toFixed(0)}%
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${downloadProgress.percent}%` }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            {downloadProgress.task}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-row">
        <div className="search-wrapper" style={{ maxWidth: 280 }}>
          <Search size={14} className="search-icon" />
          <input
            className="input search-input"
            placeholder="Versiyon ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {(['all', 'release', 'snapshot', 'old_beta', 'old_alpha'] as const).map(f => (
          <div
            key={f}
            className={`filter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Tümü' : TYPE_LABELS[f]}
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" />
          <span>Versiyonlar yükleniyor...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">Versiyon bulunamadı</div>
          <div className="empty-state-desc">Arama kriterini değiştirin</div>
        </div>
      ) : (
        <div className="version-list">
          {filtered.map(v => {
            const installed = installedVersions.includes(v.id)
            const isSelected = selectedVersion === v.id
            const isDownl = downloading === v.id
            return (
              <div
                key={v.id}
                className={`version-item ${isSelected ? 'selected' : ''} ${installed ? 'installed' : ''}`}
                onClick={() => installed && handleSelect(v.id)}
              >
                <div className="version-icon">{TYPE_EMOJIS[v.type]}</div>
                <div className="version-info">
                  <div className="version-id">{v.id}</div>
                  <div className="version-date">{releaseDate(v.releaseTime)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge badge-${v.type === 'release' ? 'release' : v.type === 'snapshot' ? 'snapshot' : 'old'}`}>
                    {TYPE_LABELS[v.type]}
                  </span>
                  {installed && <span className="badge badge-installed">✓ Yüklü</span>}
                  {isSelected && <span className="badge badge-release">★ Seçili</span>}
                </div>
                <div className="version-actions" onClick={e => e.stopPropagation()}>
                  {installed ? (
                    <>
                      {!isSelected && (
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}
                          onClick={() => handleSelect(v.id)}>
                          <CheckCircle size={12} /> Seç
                        </button>
                      )}
                      <button
                        className="btn btn-danger"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => handleDelete(v.id)}
                        disabled={deleting === v.id}
                      >
                        {deleting === v.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Trash2 size={12} />}
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', fontSize: 12 }}
                      onClick={() => handleInstall(v.id)}
                      disabled={isDownloading}
                    >
                      {isDownl ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Download size={12} />}
                      {isDownl ? 'İndiriliyor' : 'İndir'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
