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

interface Settings {
  overlayEnabled: boolean
  overlayShowCPS: boolean
  overlayShowKeystrokes: boolean
  overlayShowCursor: boolean
  overlayCPSPos: { x: number; y: number }
  overlayCPSScale: number
  overlayCPSColor: string
  overlayKeysPos: { x: number | null; y: number }
  overlayKeysScale: number
  overlayKeysColor: string
  overlayCursorColor: string
}

const DEFAULT_SETTINGS: Settings = {
  overlayEnabled: true,
  overlayShowCPS: true,
  overlayShowKeystrokes: true,
  overlayShowCursor: true,
  overlayCPSPos: { x: 14, y: 14 },
  overlayCPSScale: 1,
  overlayCPSColor: '#ff9800',
  overlayKeysPos: { x: null, y: 14 },
  overlayKeysScale: 1,
  overlayKeysColor: '#ff9800',
  overlayCursorColor: '#ff9800'
}

const PRESET_COLORS = ['#ff4444', '#44ff44', '#4488ff', '#ffdd44', '#ff44ff', '#44ffdd', '#ffffff', '#ff9800']

function Overlay() {
  const [input, setInput] = useState<InputState>({ cps: 0, leftClick: false, rightClick: false, keys: {}, mouseX: 0, mouseY: 0 })
  const [menu, setMenu] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [tab, setTab] = useState<'cps' | 'keys' | 'cursor'>('cps')

  useEffect(() => {
    window.electronAPI?.onOverlayInput?.((data: InputState) => setInput(data))
    window.electronAPI?.onOverlayMenu?.((open: boolean) => setMenu(open))
    window.electronAPI?.getOverlaySettings?.().then((s: any) => {
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...s })
    })
    window.electronAPI?.onOverlaySettingsChanged?.((s: any) => {
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...s })
    })
  }, [])

  const save = useCallback((partial: Partial<Settings>) => {
    const updated = { ...settings, ...partial }
    setSettings(updated)
    window.electronAPI?.saveOverlaySettings?.(updated)
  }, [settings])

  // HUD colors & pos
  const c = settings.overlayCPSColor || '#ff9800'
  const kc = settings.overlayKeysColor || '#ff9800'
  const cc = settings.overlayCursorColor || '#ff9800'
  const cDim = c + '88'
  const cGlow = c + '44'

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', pointerEvents: menu ? 'auto' : 'none' }}>

      {/* ─── HUD ─── */}
      {settings.overlayShowCPS && (
        <div style={{
          position: 'absolute',
          left: settings.overlayCPSPos.x, top: settings.overlayCPSPos.y,
          transform: `scale(${settings.overlayCPSScale || 1})`,
          transformOrigin: 'top left'
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: '10px 16px',
            backdropFilter: 'blur(8px)', border: '1px solid ' + cGlow,
            display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60
          }}>
            <div style={{ color: c, fontSize: 28, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1.1 }}>{input.cps}</div>
            <div style={{ color: '#fff9', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>CPS</div>
          </div>
        </div>
      )}

      {settings.overlayShowKeystrokes && (
        <div style={{
          position: 'absolute',
          left: settings.overlayKeysPos.x ?? (input.mouseX - (input.mcBounds?.x || 0) - 60),
          top: settings.overlayKeysPos.y,
          transform: `scale(${settings.overlayKeysScale || 1})`,
          transformOrigin: 'top right'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><K k="W" p={input.keys.W} c={kc} /></div>
            <div style={{ display: 'flex', gap: 4 }}><K k="A" p={input.keys.A} c={kc} /><K k="S" p={input.keys.S} c={kc} /><K k="D" p={input.keys.D} c={kc} /></div>
            <div style={{ height: 4 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              <K k="E" p={input.keys.E} c={kc} />
              <K k="SPACE" p={input.keys.Space} c={kc} w={72} />
              <K k="SHIFT" p={input.keys.Shift || input.keys.RShift || input.keys.LShift} c={kc} w={72} />
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <K2 label="LMB" p={input.leftClick} c={kc} />
              <K2 label="RMB" p={input.rightClick} c={kc} />
            </div>
          </div>
        </div>
      )}

      {settings.overlayShowCursor && (
        <>
          <div style={{
            position: 'absolute', left: input.mouseX, top: input.mouseY,
            width: 18, height: 18, borderRadius: '50%',
            border: '2px solid ' + cc,
            background: cc + '22',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 10px ' + cc + '66',
            transition: 'width 0.08s, height 0.08s',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute', left: input.mouseX, top: input.mouseY,
            transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.5
          }}>
            <div style={{ position: 'absolute', width: 16, height: 1, background: cc, left: -8, top: 0 }} />
            <div style={{ position: 'absolute', width: 1, height: 16, background: cc, top: -8, left: 0 }} />
          </div>
        </>
      )}

      {/* ─── Menu ─── */}
      {menu && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            width: 520, maxHeight: '80vh',
            background: 'rgba(12,10,8,0.95)',
            borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#ff9800', letterSpacing: '0.02em' }}>
                ⚙ OVERLAY AYARLARI
              </span>
              <button onClick={() => {
                setMenu(false)
                window.electronAPI?.overlayToggle?.()
              }} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff8', borderRadius: 8, padding: '6px 14px',
                cursor: 'pointer', fontSize: 12, fontWeight: 600
              }}>✕ KAPAT</button>
            </div>

            {/* Tabs + Content */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Side Tabs */}
              <div style={{
                width: 120, borderRight: '1px solid rgba(255,255,255,0.06)',
                padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 2
              }}>
                {(['cps', 'keys', 'cursor'] as const).map(t => (
                  <div key={t} onClick={() => setTab(t)} style={{
                    padding: '10px 16px', cursor: 'pointer',
                    background: tab === t ? 'rgba(255,152,0,0.08)' : 'transparent',
                    borderRight: tab === t ? '2px solid #ff9800' : '2px solid transparent',
                    color: tab === t ? '#ff9800' : '#fff6',
                    fontSize: 13, fontWeight: tab === t ? 700 : 500,
                    transition: 'all 0.15s'
                  }}>
                    {t === 'cps' ? '📊 CPS' : t === 'keys' ? '⌨️ Tuşlar' : '🖱️ Cursor'}
                  </div>
                ))}
              </div>

              {/* Content */}
              <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
                {tab === 'cps' && <CPSSettings settings={settings} save={save} c={c} cDim={cDim} />}
                {tab === 'keys' && <KeysSettings settings={settings} save={save} kc={kc} />}
                {tab === 'cursor' && <CursorSettings settings={settings} save={save} cc={cc} />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CPSSettings({ settings, save, c, cDim }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ToggleRow label="CPS Göster" value={settings.overlayShowCPS} onChange={v => save({ overlayShowCPS: v })} />
      <ColorRow label="Renk" value={c} onChange={v => save({ overlayCPSColor: v })} />
      <SliderRow label="Boyut" min={0.5} max={2} step={0.1} value={settings.overlayCPSScale} onChange={v => save({ overlayCPSScale: v })} format={v => v.toFixed(1) + 'x'} />
      <SliderRow label="X Konum" min={0} max={300} step={1} value={settings.overlayCPSPos.x} onChange={v => save({ overlayCPSPos: { ...settings.overlayCPSPos, x: v } })} format={v => v + 'px'} />
      <SliderRow label="Y Konum" min={0} max={300} step={1} value={settings.overlayCPSPos.y} onChange={v => save({ overlayCPSPos: { ...settings.overlayCPSPos, y: v } })} format={v => v + 'px'} />
    </div>
  )
}

function KeysSettings({ settings, save, kc }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ToggleRow label="Tuşları Göster" value={settings.overlayShowKeystrokes} onChange={v => save({ overlayShowKeystrokes: v })} />
      <ColorRow label="Renk" value={kc} onChange={v => save({ overlayKeysColor: v })} />
      <SliderRow label="Boyut" min={0.5} max={2} step={0.1} value={settings.overlayKeysScale} onChange={v => save({ overlayKeysScale: v })} format={v => v.toFixed(1) + 'x'} />
      <SliderRow label="Y Konum" min={0} max={300} step={1} value={settings.overlayKeysPos.y} onChange={v => save({ overlayKeysPos: { ...settings.overlayKeysPos, y: v } })} format={v => v + 'px'} />
      <div style={{ fontSize: 11, color: '#fff5' }}>X konumu mouse'u takip eder (sağ üst köşe)</div>
    </div>
  )
}

function CursorSettings({ settings, save, cc }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ToggleRow label="Custom Cursor Göster" value={settings.overlayShowCursor} onChange={v => save({ overlayShowCursor: v })} />
      <ColorRow label="Renk" value={cc} onChange={v => save({ overlayCursorColor: v })} />
    </div>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#fffe' }}>{label}</span>
      <label style={{ position: 'relative', width: 40, height: 22, cursor: 'pointer' }}>
        <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
        <span style={{
          position: 'absolute', inset: 0, borderRadius: 11,
          background: value ? 'rgba(255,152,0,0.25)' : 'rgba(255,255,255,0.08)',
          border: '1px solid ' + (value ? 'rgba(255,152,0,0.4)' : 'rgba(255,255,255,0.1)'),
          transition: 'all 0.2s'
        }}>
          <span style={{
            position: 'absolute', width: 16, height: 16, borderRadius: '50%',
            background: value ? '#ff9800' : '#fff4',
            top: 2, left: value ? 21 : 2,
            transition: 'all 0.2s',
            boxShadow: value ? '0 0 8px rgba(255,152,0,0.4)' : 'none'
          }} />
        </span>
      </label>
    </div>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState(value)
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#fffe', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {PRESET_COLORS.map(clr => (
          <div key={clr} onClick={() => onChange(clr)}
            style={{
              width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
              background: clr, border: clr === value ? '2px solid white' : '2px solid rgba(255,255,255,0.1)',
              transition: 'all 0.1s', transform: clr === value ? 'scale(1.1)' : 'scale(1)',
              boxShadow: clr === value ? '0 0 12px ' + clr : 'none'
            }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#fff5', fontWeight: 600 }}>#</span>
        <input value={custom.startsWith('#') ? custom.slice(1) : custom}
          onChange={e => setCustom(e.target.value)}
          onBlur={() => onChange('#' + custom.replace(/^#/, ''))}
          onKeyDown={e => { if (e.key === 'Enter') onChange('#' + custom.replace(/^#/, '')) }}
          style={{
            width: 80, padding: '4px 8px', borderRadius: 6,
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', fontSize: 12, fontFamily: 'monospace', outline: 'none'
          }}
          placeholder="ff9800"
        />
        <div style={{
          width: 24, height: 24, borderRadius: 4, background: value,
          border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0
        }} />
      </div>
    </div>
  )
}

function SliderRow({ label, min, max, step, value, onChange, format }: any) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#fffe' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#ff9800', fontWeight: 700 }}>{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%', height: 4, borderRadius: 2,
          accentColor: '#ff9800', cursor: 'pointer',
          background: 'rgba(255,255,255,0.08)'
        }} />
    </div>
  )
}

function K({ k, p, c, w }: { k: string; p?: boolean; c: string; w?: number }) {
  return (
    <div style={{
      width: w || 34, height: 34, borderRadius: 6,
      background: p ? c + '88' : 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: p ? '#fff' : '#fff6', fontSize: 10, fontWeight: 800,
      fontFamily: 'monospace',
      border: '1px solid ' + (p ? c : 'rgba(255,255,255,0.06)'),
      transition: 'all 0.05s', backdropFilter: 'blur(4px)'
    }}>{k}</div>
  )
}

function K2({ label, p, c }: { label: string; p?: boolean; c: string }) {
  return (
    <div style={{
      width: 50, height: 28, borderRadius: 6,
      background: p ? c + '88' : 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: p ? '#fff' : '#fff6', fontSize: 10, fontWeight: 800,
      fontFamily: 'monospace',
      border: '1px solid ' + (p ? c : 'rgba(255,255,255,0.06)'),
      transition: 'all 0.05s', backdropFilter: 'blur(4px)'
    }}>{label}</div>
  )
}

createRoot(document.getElementById('root')!).render(<Overlay />)
