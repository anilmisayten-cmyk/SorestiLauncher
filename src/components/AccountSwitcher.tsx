import React from 'react'
import { UserPlus, LogOut, Check, User, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../App'

interface Props {
  onClose: () => void
  onAddAccount: () => void
}

export default function AccountSwitcher({ onClose, onAddAccount }: Props) {
  const { t } = useTranslation()
  const { accounts, currentAccount, setCurrentAccount, removeAccount } = useAuthStore()
  const { toast } = useToast()

  const handleSwitch = async (account: any) => {
    setCurrentAccount(account)
    toast(t('accountSwitcher.switched', { username: account.username }), 'success')
    onClose()
  }

  const handleRemove = async (uuid: string, username: string) => {
    await removeAccount(uuid)
    toast(t('accountSwitcher.deleted', { username }), 'info')
    if (useAuthStore.getState().accounts.length === 0) {
      setCurrentAccount(null)
    }
  }

  return (
    <div className="account-switcher-overlay" onClick={onClose}>
      <div className="account-switcher" onClick={e => e.stopPropagation()}>
        <div className="account-switcher-header">
          <div className="account-switcher-title">{t('accountSwitcher.title')}</div>
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
                  {account.type === 'elyby' ? t('sidebar.accountElyby') : account.type === 'microsoft' ? t('sidebar.accountMicrosoft') : t('sidebar.accountOffline')}
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
                  title={t('accountSwitcher.deleteTitle')}
                >
                  <LogOut size={11} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="account-switcher-footer">
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => { onClose(); onAddAccount() }}>
            <UserPlus size={14} /> {t('accountSwitcher.addAccount')}
          </button>
        </div>
      </div>
    </div>
  )
}