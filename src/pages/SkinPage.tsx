import React, { useEffect, useRef, useState } from 'react'
import { SkinViewer } from 'skinview3d'
import { useTranslation } from 'react-i18next'
import { AlertCircle, RefreshCw, User } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export default function SkinPage() {
  const { t } = useTranslation()
  const { currentAccount } = useAuthStore()
  const viewerRef = useRef<HTMLDivElement>(null)
  const viewerInstance = useRef<SkinViewer | null>(null)
  const [loading, setLoading] = useState(true)
  const [skinFound, setSkinFound] = useState(false)

  useEffect(() => {
    if (!viewerRef.current) return

    const canvas = document.createElement('canvas')
    viewerRef.current.appendChild(canvas)

    const viewer = new SkinViewer({
      canvas,
      width: 300,
      height: 400,
    })

    viewer.autoRotate = true
    viewer.autoRotateSpeed = 0.5
    viewerInstance.current = viewer

    return () => {
      viewer.dispose()
      if (viewerRef.current) viewerRef.current.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    if (!viewerInstance.current || !currentAccount) return
    setLoading(true)
    setSkinFound(false)

    const username = currentAccount.username
    // Try Mojang/Minotar: if the username matches a premium player, their skin appears
    const skinUrl = `https://minotar.net/skin/${encodeURIComponent(username)}`

    viewerInstance.current.loadSkin(skinUrl)
      .then(() => {
        setSkinFound(true)
        setLoading(false)
      })
      .catch(() => {
        // Fallback Steve
        viewerInstance.current?.loadSkin('https://minotar.net/skin/MHF_Steve')
        setSkinFound(false)
        setLoading(false)
      })
  }, [currentAccount?.username])

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{t('skin.title')}</div>
          <div className="page-subtitle">{t('skin.subtitle')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 40, marginTop: 20 }}>
        {/* Viewer */}
        <div style={{
          width: 300,
          background: 'var(--card-bg)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('skin.preview3d')}</span>
            {loading && <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          </div>
          <div ref={viewerRef} style={{ width: 300, height: 400, background: 'linear-gradient(to bottom, #2b303a, #1a1d24)' }} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, maxWidth: 480 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
              <div style={{
                width: 48, height: 48,
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700, color: '#fff'
              }}>
                {currentAccount?.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{currentAccount?.username}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('skin.offlineAccount')}</div>
              </div>
            </div>

            <div style={{
              background: skinFound ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${skinFound ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: 8, padding: 14, marginBottom: 20
            }}>
              <div style={{ display: 'flex', gap: 10, color: skinFound ? '#10b981' : '#f87171', alignItems: 'flex-start' }}>
                <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  {skinFound ? (
                    <>
                      <strong>{t('skin.skinFound')}</strong><br />
                      <strong>{currentAccount?.username}</strong> {t('skin.skinFoundDesc')}
                    </>
                  ) : (
                    <>
                      <strong>{t('skin.skinNotFound')}</strong><br />
                      <strong>{currentAccount?.username}</strong> {t('skin.skinNotFoundDesc')}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-glass)', borderRadius: 8, padding: 14, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong><User size={13} style={{ display: 'inline', marginRight: 4 }} />{t('skin.howItWorks')}</strong><br />
              {t('skin.howItWorksDesc')}
              <br /><br />
              <strong>{t('skin.example')}</strong> {t('skin.exampleText')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
