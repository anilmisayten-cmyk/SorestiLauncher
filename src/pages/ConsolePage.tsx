import React, { useRef, useEffect, useState } from 'react'
import { Trash2, Download, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'

export default function ConsolePage() {
  const { t } = useTranslation()
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
          <div className="page-title">{t('console.title')}</div>
          <div className="page-subtitle">
            {t('console.lines', { count: logs.length })} · {isRunning ? t('console.running') : t('console.stopped')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={exportLogs} disabled={logs.length === 0}>
            <Download size={13} /> {t('console.save')}
          </button>
          <button className="btn btn-secondary" onClick={clearLogs} disabled={logs.length === 0}>
            <Trash2 size={13} /> {t('console.clear')}
          </button>
          {isRunning && (
            <button className="btn btn-danger" onClick={() => window.electronAPI.killGame()}>
              <Square size={13} fill="currentColor" /> {t('console.stop')}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        <label className="toggle" style={{ margin: 0 }}>
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
          <span className="toggle-slider" />
        </label>
        {t('console.autoScroll')}
      </div>

      <div className="console" style={{ flex: 1, height: 'auto', minHeight: 400 }}>
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
            {t('console.empty')}
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
