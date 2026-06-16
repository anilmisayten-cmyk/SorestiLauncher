
$OutputEncoding = [System.Text.Encoding]::UTF8
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
  if($d-and!$was){Write-Output "toggle"}
  $was=$d
  Start-Sleep -Milliseconds 150
}
