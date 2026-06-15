import React from 'react'
import { UserPlus, LogOut, Check, User, X } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../App'

interface Props {
  onClose: () => void
  onAddAccount: () => void
}

export default function AccountSwitcher({ onClose, onAddAccount }: Props) {
  const { accounts, currentAccount, setCurrentAccount, removeAccount } = useAuthStore()
  const { toast } = useToast()

  const handleSwitch = async (account: any) => {
    setCurrentAccount(account)
    toast(`${account.username} hesabına geçildi`, 'success')
    onClose()
  }

  const handleRemove = async (uuid: string, username: string) => {
    await removeAccount(uuid)
    toast(`${username} silindi`, 'info')
    if (useAuthStore.getState().accounts.length === 0) {
      setCurrentAccount(null)
    }
  }

  return (
    <div className="account-switcher-overlay" onClick={onClose}>
      <div className="account-switcher" onClick={e => e.stopPropagation()}>
        <div className="account-switcher-header">
          <div className="account-switcher-title">Hesaplar</div>
          <button className="btn btn-icon" onClick={onClose} style={{ width: 28, height: 28 }}>
            <X size={14} />
          </button>
        </div>

        <div className="account-switcher-list">
          {accounts.map(account => (
            <div
              key={account.uuid}
              className={`account-switcher-item ${currentAccount?.uuid === account.uuid ? 'active' : ''}`}
              onClick={() => handleSwitch(account)}
            >
              <div className="account-switcher-avatar">
                {account.username[0].toUpperCase()}
              </div>
              <div className="account-switcher-info">
                <div className="account-switcher-name">{account.username}</div>
                <div className="account-switcher-type">
                  {account.type === 'elyby' ? 'Ely.by' : account.type === 'microsoft' ? 'Microsoft' : 'Offline'}
                </div>
              </div>
              {currentAccount?.uuid === account.uuid && (
                <Check size={16} className="account-switcher-check" />
              )}
              {accounts.length > 1 && (
                <button
                  className="btn btn-icon"
                  onClick={e => { e.stopPropagation(); handleRemove(account.uuid, account.username) }}
                  style={{ width: 26, height: 26, opacity: 0.6 }}
                  title="Hesabı sil"
                >
                  <LogOut size={11} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="account-switcher-footer">
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => { onClose(); onAddAccount() }}>
            <UserPlus size={14} /> Hesap Ekle
          </button>
        </div>
      </div>
    </div>
  )
}