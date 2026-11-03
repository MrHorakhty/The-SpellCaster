# GS6/GS7: reserve one chord in a separate process to exercise real OS conflicts.
# No keyboard input is generated. Closing stdin/process always releases the key.
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class ShortcutFixture {
    [DllImport("user32.dll", SetLastError=true)]
    public static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint key);
    [DllImport("user32.dll", SetLastError=true)]
    public static extern bool UnregisterHotKey(IntPtr window, int id);
}
'@
$registered = $false
try {
    $registered = [ShortcutFixture]::RegisterHotKey([IntPtr]::Zero, 48721, 0x4006, 66)
    if (-not $registered) { throw "Fixture registration failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
    [Console]::Out.WriteLine('READY')
    [Console]::Out.Flush()
    $null = [Console]::In.ReadLine()
} finally {
    if ($registered) { $null = [ShortcutFixture]::UnregisterHotKey([IntPtr]::Zero, 48721) }
}
