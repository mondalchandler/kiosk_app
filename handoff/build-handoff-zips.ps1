$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$packages = @{
  kiosk_app_one_click_windows = @(
    'index.html', 'styles.css', 'app.js', 'placeholder.png', 'static-center-banner.png',
    'server.ps1', 'server-core.cs', 'Start Kiosk.cmd', 'README.txt', 'media/ADD_MEDIA_HERE.txt'
  )
  kiosk_app_serverless = @(
    'index.html', 'styles.css', 'app.js', 'placeholder.png', 'static-center-banner.png',
    'README.txt', 'media/ADD_MEDIA_HERE.txt'
  )
}

foreach ($name in $packages.Keys) {
  $zipPath = Join-Path $PSScriptRoot ($name + '.zip')
  $temporaryZip = Join-Path $PSScriptRoot ($name + '.zip.tmp')
  if (Test-Path -LiteralPath $temporaryZip) { Remove-Item -LiteralPath $temporaryZip }
  $archive = [System.IO.Compression.ZipFile]::Open($temporaryZip, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($relative in $packages[$name]) {
      $source = Join-Path (Join-Path $PSScriptRoot $name) $relative
      if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing package file: $source" }
      $entry = $name + '/' + $relative.Replace('\', '/')
      [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $archive, $source, $entry, [System.IO.Compression.CompressionLevel]::Optimal
      )
    }
  } finally { $archive.Dispose() }
  Move-Item -LiteralPath $temporaryZip -Destination $zipPath -Force
  Write-Host "Built $zipPath (user media excluded)"
}

$combinedPath = Join-Path $PSScriptRoot 'kiosk_app_both_options.zip'
$temporaryCombined = Join-Path $PSScriptRoot 'kiosk_app_both_options.zip.tmp'
if (Test-Path -LiteralPath $temporaryCombined) { Remove-Item -LiteralPath $temporaryCombined }
$combined = [System.IO.Compression.ZipFile]::Open($temporaryCombined, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
    $combined, (Join-Path $PSScriptRoot 'START HERE.txt'), 'START HERE.txt',
    [System.IO.Compression.CompressionLevel]::Optimal
  )
  foreach ($name in ($packages.Keys | Sort-Object)) {
    foreach ($relative in $packages[$name]) {
      $source = Join-Path (Join-Path $PSScriptRoot $name) $relative
      if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing package file: $source" }
      $entry = $name + '/' + $relative.Replace('\', '/')
      [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $combined, $source, $entry, [System.IO.Compression.CompressionLevel]::Optimal
      )
    }
  }
} finally { $combined.Dispose() }
Move-Item -LiteralPath $temporaryCombined -Destination $combinedPath -Force
Write-Host "Built $combinedPath (user media excluded)"
