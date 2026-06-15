import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { MemoryRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import VersionsPage from './pages/VersionsPage'
import ModsPage from './pages/ModsPage'
import SettingsPage from './pages/SettingsPage'
import ConsolePage from './pages/ConsolePage'
import SkinPage from './pages/SkinPage'
import { ToastContainer, useToastInternal } from './components/Toast'
import { useAuthStore } from './store/authStore'
import { useSettingsStore } from './store/settingsStore'

// Toast context
export const ToastContext = createContext<{
  toast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export default function App() {
  const { toasts, toast, removeToast } = useToastInternal()
  const { currentAccount, loadAccounts } = useAuthStore()
  const { settings } = useSettingsStore()
  const { i18n } = useTranslation()

  useEffect(() => {
    loadAccounts()
  }, [])

  // Auto-install Minecraft 1.21.4 on first launch
  useEffect(() => {
    const install = async () => {
      try {
        const installed = await window.electronAPI.getInstalledVersions()
        if (!installed.includes('1.21.4')) {
          toast('Minecraft 1.21.4 indiriliyor...', 'info')
          await window.electronAPI.installVersion('1.21.4')
          toast('Minecraft 1.21.4 yüklendi!', 'success')
        }
      } catch {}
    }
    install()
  }, [])

  useEffect(() => {
    if (settings.language && settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language)
    }
  }, [settings.language])

  const showSidebar = !!currentAccount

  return (
    <ToastContext.Provider value={{ toast }}>
      <Router>
        <div className="app-layout">
          <TitleBar />
          <div className="app-body">
            {showSidebar && <Sidebar />}
            <main className="main-content">
              {currentAccount ? (
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/versions" element={<VersionsPage />} />
                  <Route path="/mods" element={<ModsPage />} />
                  <Route path="/skin" element={<SkinPage />} />
                  <Route path="/console" element={<ConsolePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              ) : (
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="*" element={<Navigate to="/login" />} />
                </Routes>
              )}
            </main>
          </div>
        </div>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </Router>
    </ToastContext.Provider>
  )
}
