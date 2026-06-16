
$OutputEncoding = [System.Text.Encoding]::UTF8
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
