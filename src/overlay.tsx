import { useState, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'

interface InputState {
  cps: number
  leftClick: boolean
  rightClick: boolean
  keys: Record<string, boolean>
  mouseX: number
  mouseY: number
}

const ACCENT = '#ff9800'
const ACCENT_DIM = 'rgba(255,152,0,0.55)'
const BG = 'rgba(0,0,0,0.6)'
const BORDER = 'rgba(255,152,0,0.2)'
const KEY_BG = 'rgba(0,0,0,0.45)'

function Overlay() {
  const [input, setInput] = useState<InputState>({ cps: 0, leftClick: false, rightClick: false, keys: {}, mouseX: 0, mouseY: 0 })

  useEffect(() => {
    const handler = (_e: any, data: InputState) => setInput(data)
    window.electronAPI?.onOverlayInput?.(handler)
    return () => { window.electronAPI?.removeAllListeners?.('overlay:input') }
  }, [])

  const showClick = input.leftClick || input.rightClick

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', pointerEvents: 'none' }}>
      {/* CPS + Clicks */}
      <div style={{
        position: 'absolute', top: 14, left: 14,
        display: 'flex', gap: 8, alignItems: 'flex-start'
      }}>
        <div style={{
          background: BG, borderRadius: 10, padding: '10px 16px',
          backdropFilter: 'blur(8px)', border: '1px solid ' + BORDER,
          display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60
        }}>
          <div style={{ color: ACCENT, fontSize: 28, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1.1 }}>{input.cps}</div>
          <div style={{ color: '#fff9', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>CPS</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { label: 'LMB', active: input.leftClick },
            { label: 'RMB', active: input.rightClick }
          ].map(c => (
            <div key={c.label} style={{
              width: 48, height: 28, borderRadius: 6,
              background: c.active ? ACCENT_DIM : 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: c.active ? '#fff' : '#fff6', fontSize: 10, fontWeight: 800,
              border: '1px solid ' + (c.active ? ACCENT : 'rgba(255,255,255,0.08)'),
              transition: 'all 0.05s', fontFamily: 'monospace',
              backdropFilter: 'blur(4px)'
            }}>{c.label}</div>
          ))}
        </div>
      </div>

      {/* Keystrokes - WASD */}
      <div style={{
        position: 'absolute', top: 14, right: 14,
        display: 'flex', flexDirection: 'column', gap: 4
      }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Key k="W" p={input.keys.W} /></div>
        <div style={{ display: 'flex', gap: 4 }}>
          <Key k="A" p={input.keys.A} /> <Key k="S" p={input.keys.S} /> <Key k="D" p={input.keys.D} />
        </div>
        <div style={{ height: 4 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          <Key k="E" p={input.keys.E} />
          <Key k="SPACE" p={input.keys.Space} wide />
          <Key k="SHIFT" p={input.keys.Shift || input.keys.RShift || input.keys.LShift} wide />
        </div>
      </div>

      {/* Custom Cursor */}
      <div style={{
        position: 'absolute', left: input.mouseX, top: input.mouseY,
        width: 18, height: 18, borderRadius: '50%',
        border: '2px solid ' + ACCENT,
        background: ACCENT + '22',
        transform: 'translate(-50%, -50%)',
        boxShadow: '0 0 10px ' + ACCENT + '66',
        transition: 'width 0.08s, height 0.08s',
        pointerEvents: 'none'
      }} />

      {/* Crosshair */}
      <div style={{
        position: 'absolute', left: input.mouseX, top: input.mouseY,
        transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.6
      }}>
        <div style={{ position: 'absolute', width: 16, height: 1, background: ACCENT, left: -8, top: 0 }} />
        <div style={{ position: 'absolute', width: 1, height: 16, background: ACCENT, top: -8, left: 0 }} />
      </div>
    </div>
  )
}

function Key({ k, p, wide }: { k: string; p?: boolean; wide?: boolean }) {
  return (
    <div style={{
      width: wide ? 72 : 34, height: 34, borderRadius: 6,
      background: p ? ACCENT_DIM : KEY_BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: p ? '#fff' : '#fff6', fontSize: 10, fontWeight: 800,
      fontFamily: 'monospace',
      border: '1px solid ' + (p ? ACCENT : 'rgba(255,255,255,0.06)'),
      transition: 'all 0.05s',
      backdropFilter: 'blur(4px)',
      letterSpacing: '0.03em'
    }}>{k}</div>
  )
}

createRoot(document.getElementById('root')!).render(<Overlay />)
