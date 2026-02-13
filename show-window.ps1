Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
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

$proc = Get-Process -Id 119180 -ErrorAction SilentlyContinue
if ($proc -and $proc.MainWindowHandle -ne 0) {
    $handle = $proc.MainWindowHandle
    Write-Output "Handle: $handle"
    Write-Output "Visible: $([Win32]::IsWindowVisible($handle))"

    $rect = New-Object Win32+RECT
    [Win32]::GetWindowRect($handle, [ref]$rect) | Out-Null
    Write-Output "Position: Left=$($rect.Left) Top=$($rect.Top) Right=$($rect.Right) Bottom=$($rect.Bottom)"

    # SW_RESTORE = 9, then bring to front
    [Win32]::ShowWindow($handle, 9) | Out-Null
    [Win32]::SetForegroundWindow($handle) | Out-Null
    Write-Output "Attempted to restore and bring to foreground"
} else {
    Write-Output "No valid window handle found"
}
