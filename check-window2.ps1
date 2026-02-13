$proc = Get-Process -Name 'upwork-research-agent' -ErrorAction SilentlyContinue
if ($proc) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Check {
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }
}
"@
    foreach ($p in $proc) {
        $rect = New-Object Win32Check+RECT
        [Win32Check]::GetWindowRect($p.MainWindowHandle, [ref]$rect) | Out-Null
        $w = $rect.Right - $rect.Left
        $h = $rect.Bottom - $rect.Top
        Write-Output "PID=$($p.Id) Handle=$($p.MainWindowHandle) Visible=$([Win32Check]::IsWindowVisible($p.MainWindowHandle)) Size=${w}x${h} Pos=($($rect.Left),$($rect.Top))"
    }
}
