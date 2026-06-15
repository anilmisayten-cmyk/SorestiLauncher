import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home, Layers, Package, Terminal, Settings,
  LogOut, ChevronRight, Cpu, User, UserPlus, ChevronDown
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import { useToast } from '../App'
import AccountSwitcher from './AccountSwitcher'

const navItems = [
  { path: '/', icon: Home, label: 'Ana Sayfa' },
  { path: '/versions', icon: Layers, label: 'Versiyonlar' },
  { path: '/mods', icon: Package, label: 'Modlar' },
  { path: '/skin', icon: User, label: 'Karakter' },
  { path: '/console', icon: Terminal, label: 'Konsol' },
]

const bottomItems = [
  { path: '/login', icon: UserPlus, label: 'Hesap Ekle' },
  { path: '/settings', icon: Settings, label: 'Ayarlar' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentAccount, accounts, setCurrentAccount, removeAccount } = useAuthStore()
  const { isRunning, logs } = useGameStore()
  const { toast } = useToast()
  const [showSwitcher, setShowSwitcher] = useState(false)

  const handleLogout = async () => {
    if (currentAccount) {
      await removeAccount(currentAccount.uuid)
      if (!useAuthStore.getState().currentAccount) {
        setCurrentAccount(null)
      }
      toast('Hesaptan çıkıldı', 'info')
    }
  }

  const avatarLetter = currentAccount?.username?.[0]?.toUpperCase() ?? '?'

  return (
    <aside className="sidebar">
      {/* User */}
      <div className="sidebar-user" onClick={() => setShowSwitcher(true)} title="Hesap Değiştir">
        <div className="sidebar-avatar">{avatarLetter}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-username">{currentAccount?.username ?? 'Bilinmiyor'}</div>
          <div className="sidebar-user-type">
            <span>●</span>
            {currentAccount?.type === 'elyby' ? 'Ely.by' : currentAccount?.type === 'microsoft' ? 'Microsoft' : 'Offline'}
            <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.5 }}>▼</span>
          </div>
        </div>
        {accounts.length > 1 && (
          <ChevronDown size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
        )}
      </div>

      {showSwitcher && (
        <AccountSwitcher
          onClose={() => setShowSwitcher(false)}
          onAddAccount={() => navigate('/login')}
        />
      )}

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Menü</div>
        {navItems.map(item => (
          <div
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <item.icon className="nav-icon" size={16} />
            <span className="nav-label">{item.label}</span>
            {item.path === '/console' && logs.length > 0 && (
              <span className="nav-badge">{Math.min(logs.length, 99)}</span>
            )}
            {item.path === '/' && isRunning && (
              <span className="nav-badge" style={{ background: '#00e676', animation: 'pulse 1s infinite' }}>●</span>
            )}
          </div>
        ))}

        <div className="nav-section-label" style={{ marginTop: 'auto' }}>Sistem</div>
        {bottomItems.map(item => (
          <div
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <item.icon className="nav-icon" size={16} />
            <span className="nav-label">{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-version">Soresti Launcher v1.0.0</div>
      </div>
    </aside>
  )
}
