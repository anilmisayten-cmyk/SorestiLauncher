import React, { useRef, useEffect, useState } from 'react'
import { Trash2, Download, Square } from 'lucide-react'
import { useGameStore } from '../store/gameStore'

export default function ConsolePage() {
  const { logs, clearLogs, isRunning } = useGameStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, autoScroll])

  const classifyLine = (line: string) => {
    const l = line.toLowerCase()
    if (l.includes('[soresti]')) return 'system'
    if (l.includes('[err]') || l.includes('error') || l.includes('exception')) return 'error'
    if (l.includes('warn')) return 'warn'
    if (l.includes('info')) return 'info'
    return ''
  }

  const exportLogs = () => {
    const content = logs.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `soresti-log-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page fade-in" style={{ gap: 16 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Konsol</div>
          <div className="page-subtitle">
            {logs.length} satır · {isRunning ? '🟢 Oyun çalışıyor' : '⚫ Oyun kapalı'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={exportLogs} disabled={logs.length === 0}>
            <Download size={13} /> Kaydet
          </button>
          <button className="btn btn-secondary" onClick={clearLogs} disabled={logs.length === 0}>
            <Trash2 size={13} /> Temizle
          </button>
          {isRunning && (
            <button className="btn btn-danger" onClick={() => window.electronAPI.killGame()}>
              <Square size={13} fill="currentColor" /> Durdur
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        <label className="toggle" style={{ margin: 0 }}>
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
          <span className="toggle-slider" />
        </label>
        Otomatik kaydır
      </div>

      <div className="console" style={{ flex: 1, height: 'auto', minHeight: 400 }}>
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
            Henüz çıktı yok. Minecraft başlatınca burada görünecek.
          </div>
        ) : (
          logs.map((line, i) => (
            <div key={i} className={`console-line ${classifyLine(line)}`}>
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
