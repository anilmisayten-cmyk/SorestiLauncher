import React, { useState, useEffect } from 'react'
import { Minus, Square, X } from 'lucide-react'
import logoImg from '../assets/sorestilogo.png'

export default function TitleBar() {
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
        <button className="titlebar-btn" onClick={() => window.electronAPI.minimize()} title="Küçült">
          <Minus size={12} />
        </button>
        <button className="titlebar-btn maximize" onClick={handleMaximize} title={isMax ? 'Geri Al' : 'Büyüt'}>
          <Square size={10} />
        </button>
        <button className="titlebar-btn close" onClick={() => window.electronAPI.close()} title="Kapat">
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
