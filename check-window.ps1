$proc = Get-Process -Name 'upwork-research-agent' -ErrorAction SilentlyContinue
if ($proc) {
    foreach ($p in $proc) {
        Write-Output "PID: $($p.Id)"
        Write-Output "Handle: $($p.MainWindowHandle)"
        Write-Output "Title: '$($p.MainWindowTitle)'"
        Write-Output "Responding: $($p.Responding)"
        Write-Output "---"
    }
} else {
    Write-Output "No upwork-research-agent process found"
}
