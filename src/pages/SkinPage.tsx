import React, { useEffect, useRef, useState } from 'react'
import { SkinViewer } from 'skinview3d'
import { AlertCircle, RefreshCw, User } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export default function SkinPage() {
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
          <div className="page-title">Karakterin (Skin)</div>
          <div className="page-subtitle">Hesap adından otomatik skin aranır</div>
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
            <span>3D Önizleme</span>
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
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Offline Hesap</div>
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
                      <strong>Skin bulundu!</strong><br />
                      <strong>{currentAccount?.username}</strong> adlı bir premium oyuncunun skini var ve oyununda bu skin yüklendi. Oyun içinde de aynı şekilde görüneceksin!
                    </>
                  ) : (
                    <>
                      <strong>Skin bulunamadı.</strong><br />
                      <strong>{currentAccount?.username}</strong> adında bir premium oyuncu bulunamadı, Steve skini kullanılıyor. Gerçek bir Minecraft oyuncusunun adını kullanırsan onun skiniyle oynarsın!
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-glass)', borderRadius: 8, padding: 14, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong><User size={13} style={{ display: 'inline', marginRight: 4 }} />Nasıl çalışır?</strong><br />
              Launcher, hesap adını Minotar veritabanında arar. Eğer aynı adda bir premium Minecraft oyuncusu varsa, o oyuncunun skini otomatik olarak seninki olur. Herkes seni o skinle görür!
              <br /><br />
              <strong>Örnek:</strong> Eğer kullanıcı adın <em>"Dream"</em> ise, gerçek Dream'in skiniyle oynarsın!
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
