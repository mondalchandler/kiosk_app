param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
Add-Type -Path (Join-Path $root 'server-core.cs') -ReferencedAssemblies 'System.Web.Extensions'
$server = [KioskServer]::Start($root)
Write-Host "Kiosk running at $($server.Url)"
Write-Host "Add images or videos to $(Join-Path $root 'media'). The kiosk checks for new files every 10 seconds."
Write-Host 'Close this window to stop the kiosk.'
if (-not $NoBrowser) { Start-Process $server.Url }
try { $server.Serve() } finally { $server.Dispose() }
