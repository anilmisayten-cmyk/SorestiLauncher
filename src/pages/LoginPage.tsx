import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, LogIn, WifiOff } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../App'
import logoImg from '../assets/sorestilogo.png'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { addAccount, currentAccount } = useAuthStore()
  const { toast } = useToast()

  const handleOfflineLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) { setError('Kullanıcı adı girin'); return }
    if (username.trim().length < 3) { setError('En az 3 karakter'); return }
    if (username.trim().length > 16) { setError('En fazla 16 karakter'); return }
    setError('')
    setLoading(true)
    try {
      const account = await window.electronAPI.offlineLogin(username.trim())
      addAccount(account)
      toast(`Hoş geldin, ${account.username}!`, 'success')
      if (currentAccount) navigate('/')
    } catch (err: any) {
      setError(err.message || 'Giriş başarısız')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card scale-in">
        <div className="login-logo">
          <img src={logoImg} alt="Soresti" style={{ width: 80, height: 80, borderRadius: 16, boxShadow: 'var(--shadow-accent)' }} />
          <div>
            <div className="login-title">SORESTI</div>
            <div className="login-subtitle">Minecraft Launcher</div>
          </div>
        </div>

        <form className="login-form" onSubmit={handleOfflineLogin}>
          <div className="form-group">
            <label className="input-label">
              <User size={11} style={{ display: 'inline', marginRight: 4 }} />
              Kullanıcı Adı
            </label>
            <input
              className="input"
              type="text"
              placeholder="Minecraft kullanıcı adın"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              maxLength={16}
              autoFocus
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <WifiOff size={10} />
              Offline mod — gerçek hesap gerekmez
            </div>
          </div>

          {error && (
            <div className="form-error">
              <Lock size={12} />
              {error}
            </div>
          )}

          <button
            className="btn btn-primary btn-lg"
            type="submit"
            disabled={loading || !username.trim()}
            style={{ width: '100%' }}
          >
            {loading ? (
              <><span className="spinner" style={{ width: 16, height: 16 }} /> Giriş yapılıyor...</>
            ) : (
              <><LogIn size={16} /> Oyuna Gir</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
