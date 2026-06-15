import { BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import * as child_process from 'child_process'
import * as fs from 'fs'

const INPUT_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Input {
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);
    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }
}
"@
while ($true) {
    $keys = @{}
    @(0x01,0x02,0x57,0x41,0x53,0x44,0x20,0xA1,0xA0,0x45,0x10) | ForEach-Object {
        $name = switch($_) {
            0x01 { 'LMB' }; 0x02 { 'RMB' }; 0x57 { 'W' }; 0x41 { 'A' }
            0x53 { 'S' }; 0x44 { 'D' }; 0x20 { 'Space' }; 0xA1 { 'RShift' }
            0xA0 { 'LShift' }; 0x45 { 'E' }; 0x10 { 'Shift' }
        }
        $keys[$name] = [bool]([Input]::GetAsyncKeyState($_) -band 0x8000)
    }
    $pos = New-Object Input+POINT
    [Input]::GetCursorPos([ref]$pos) | Out-Null
    $obj = [PSCustomObject]@{ keys = $keys; mouseX = $pos.X; mouseY = $pos.Y }
    $obj | ConvertTo-Json -Compress
    Start-Sleep -Milliseconds 16
}
`

export class OverlayManager {
  private overlayWindow: BrowserWindow | null = null
  private inputProcess: child_process.ChildProcess | null = null
  private trackerInterval: NodeJS.Timeout | null = null
  private isVisible = false
  private mcBounds: { x: number; y: number; width: number; height: number } | null = null
  private clickTimestamps: number[] = []
  private leftWasDown = false

  createOverlay() {
    if (this.overlayWindow) return
    this.overlayWindow = new BrowserWindow({
      width: 1920, height: 1080,
      x: 0, y: 0,
      transparent: true, frame: false,
      alwaysOnTop: true, skipTaskbar: true,
      focusable: false, hasShadow: false,
      resizable: false, movable: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    this.overlayWindow.setIgnoreMouseEvents(true, { forward: true })
    this.overlayWindow.loadFile(path.join(__dirname, '../../dist/overlay/overlay.html'))
    this.overlayWindow.setVisibleOnAllWorkspaces(true)
    this.overlayWindow.hide()
    this.overlayWindow.on('closed', () => { this.overlayWindow = null })
  }

  toggle() {
    if (!this.overlayWindow) this.createOverlay()
    this.isVisible ? this.hide() : this.show()
  }

  show() {
    if (!this.overlayWindow) this.createOverlay()
    this.isVisible = true
    this.overlayWindow?.show()
    this.startInputMonitor()
    this.startWindowTracker()
  }

  hide() {
    this.isVisible = false
    this.overlayWindow?.hide()
    this.stopInputMonitor()
    this.stopWindowTracker()
  }

  private startInputMonitor() {
    if (this.inputProcess) return
    const scriptPath = path.join(__dirname, '../../scripts/input.ps1')
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true })
    fs.writeFileSync(scriptPath, INPUT_SCRIPT)

    this.inputProcess = child_process.spawn('powershell', [
      '-ExecutionPolicy', 'Bypass', '-NoProfile', '-File', scriptPath
    ], { stdio: ['ignore', 'pipe', 'ignore'] })

    let buffer = ''
    this.inputProcess.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const t = line.trim()
        if (!t) continue
        try {
          const s = JSON.parse(t)
          if (s.keys?.LMB && !this.leftWasDown) this.clickTimestamps.push(Date.now())
          this.leftWasDown = s.keys?.LMB || false
          const now = Date.now()
          this.clickTimestamps = this.clickTimestamps.filter(ts => now - ts < 1000)

          this.overlayWindow?.webContents.send('overlay:input', {
            cps: this.clickTimestamps.length,
            leftClick: s.keys?.LMB || false,
            rightClick: s.keys?.RMB || false,
            keys: s.keys || {},
            mouseX: s.mouseX || 0,
            mouseY: s.mouseY || 0
          })
        } catch {}
      }
    })
    this.inputProcess.on('exit', () => { this.inputProcess = null })
  }

  private stopInputMonitor() {
    if (this.inputProcess) { this.inputProcess.kill(); this.inputProcess = null }
  }

  private startWindowTracker() {
    if (this.trackerInterval) return
    const findMC = () => {
      const script = `powershell -NoProfile -Command "$p = Add-Type -MemberDefinition '[DllImport(\\\"user32.dll\\\")]public static extern bool GetWindowRect(IntPtr hWnd,out RECT r);[DllImport(\\\"user32.dll\\\")]public static extern int GetWindowText(IntPtr hWnd,System.Text.StringBuilder t,int n);public struct RECT{public int l,t,r,b;}' -Name W -Namespace W -PassThru;foreach($p in Get-Process javaw,java -EA 0){$h=$p.MainWindowHandle;if($h-ne[IntPtr]::Zero){$sb=New-Object System.Text.StringBuilder 256;[W.W]::GetWindowText($h,$sb,256)|Out-Null;if($sb.ToString()-like'*Minecraft*'){$r=New-Object W.RECT;[W.W]::GetWindowRect($h,[ref]$r)|Out-Null;$w=$r.r-$r.l;$h2=$r.b-$r.t;if($w-gt 100-and$h2-gt 100){Write-Output (\\\"{0},{1},{2},{3}\\\"-f$r.l,$r.t,$w,$h2);exit 0}}}}"`
      child_process.exec(script, { timeout: 3000 }, (err, stdout) => {
        if (!err && stdout?.trim()) {
          const parts = stdout.trim().split(',').map(Number)
          if (parts.length === 4) {
            const newBounds = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
            const old = this.mcBounds
            if (!old || old.x !== newBounds.x || old.y !== newBounds.y || old.width !== newBounds.width || old.height !== newBounds.height) {
              this.mcBounds = newBounds
              this.updateOverlayPosition()
            }
          }
        }
      })
    }
    findMC()
    this.trackerInterval = setInterval(findMC, 2000)
  }

  private stopWindowTracker() {
    if (this.trackerInterval) { clearInterval(this.trackerInterval); this.trackerInterval = null }
  }

  private updateOverlayPosition() {
    if (!this.overlayWindow || !this.mcBounds) return
    this.overlayWindow.setBounds({
      x: this.mcBounds.x, y: this.mcBounds.y,
      width: this.mcBounds.width, height: this.mcBounds.height
    })
  }

  // Right Shift watcher - always runs in background
  private shiftProcess: child_process.ChildProcess | null = null

  startShiftWatcher() {
    if (this.shiftProcess) return
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class K {
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);
}
"@
$was=$false
while($true){
  $d=[bool]([K]::GetAsyncKeyState(0xA1)-band0x8000)
  if($d-and!$was){Write-Output"toggle"}
  $was=$d
  Start-Sleep -Milliseconds 150
}
`
    const scriptPath = path.join(__dirname, '../../scripts/shift-watcher.ps1')
    fs.writeFileSync(scriptPath, script)
    this.shiftProcess = child_process.spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-File', scriptPath], { stdio: ['ignore', 'pipe', 'ignore'] })
    let buf = ''
    this.shiftProcess.stdout?.on('data', (d: Buffer) => {
      buf += d.toString()
      if (buf.includes('toggle')) {
        buf = ''
        this.toggle()
      }
    })
    this.shiftProcess.on('exit', () => { this.shiftProcess = null })
  }

  stopShiftWatcher() {
    if (this.shiftProcess) { this.shiftProcess.kill(); this.shiftProcess = null }
  }

  destroy() {
    this.stopShiftWatcher()
    this.hide()
    this.overlayWindow?.destroy()
    this.overlayWindow = null
  }
}

export const overlayManager = new OverlayManager()
