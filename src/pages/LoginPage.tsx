import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { User, Lock, LogIn, WifiOff } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../App'
import logoImg from '../assets/sorestilogo.png'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { addAccount, currentAccount } = useAuthStore()
  const { toast } = useToast()

  const handleOfflineLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) { setError(t('login.validationRequired')); return }
    if (username.trim().length < 3) { setError(t('login.validationMin')); return }
    if (username.trim().length > 16) { setError(t('login.validationMax')); return }
    setError('')
    setLoading(true)
    try {
      const account = await window.electronAPI.offlineLogin(username.trim())
      addAccount(account)
      toast(t('login.welcome', { username: account.username }), 'success')
      if (currentAccount) navigate('/')
    } catch (err: any) {
      setError(err.message || t('login.failed'))
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
            <div className="login-title">{t('login.title')}</div>
            <div className="login-subtitle">{t('login.subtitle')}</div>
          </div>
        </div>

        <form className="login-form" onSubmit={handleOfflineLogin}>
          <div className="form-group">
            <label className="input-label">
              <User size={11} style={{ display: 'inline', marginRight: 4 }} />
              {t('login.usernameLabel')}
            </label>
            <input
              className="input"
              type="text"
              placeholder={t('login.usernamePlaceholder')}
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              maxLength={16}
              autoFocus
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <WifiOff size={10} />
              {t('login.offlineInfo')}
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
              <><span className="spinner" style={{ width: 16, height: 16 }} /> {t('login.loading')}</>
            ) : (
              <><LogIn size={16} /> {t('login.play')}</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
