import React, { useState, useEffect } from 'react'
import { Minus, Square, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import logoImg from '../assets/sorestilogo.png'

export default function TitleBar() {
  const { t } = useTranslation()
  const [isMax, setIsMax] = useState(false)

  useEffect(() => {
    const check = async () => {
      const m = await window.electronAPI.isMaximized()
      setIsMax(m)
    }
    check()
  }, [])

  const handleMaximize = async () => {
    window.electronAPI.maximize()
    setTimeout(async () => {
      const m = await window.electronAPI.isMaximized()
      setIsMax(m)
    }, 100)
  }

  return (
    <div className="titlebar">
      <div className="titlebar-logo">
        <img src={logoImg} alt="Soresti" style={{ width: 22, height: 22, borderRadius: 5 }} />
        <span className="titlebar-logo-text">SORESTI</span>
      </div>
      <div className="titlebar-drag-area" />
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={() => window.electronAPI.minimize()} title={t('titlebar.minimize')}>
          <Minus size={12} />
        </button>
        <button className="titlebar-btn maximize" onClick={handleMaximize} title={isMax ? t('titlebar.restore') : t('titlebar.maximize')}>
          <Square size={10} />
        </button>
        <button className="titlebar-btn close" onClick={() => window.electronAPI.close()} title={t('titlebar.close')}>
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
