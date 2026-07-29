$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $repositoryRoot "web"
$webDistribution = Join-Path $webRoot "dist"
$androidAssets = Join-Path $repositoryRoot "android\app\src\main\assets"

Push-Location $webRoot
try {
    npm.cmd install
    npm.cmd run build
} finally {
    Pop-Location
}

$resolvedRepository = (Resolve-Path -LiteralPath $repositoryRoot).Path
$resolvedAssets = (Resolve-Path -LiteralPath $androidAssets).Path
if (-not $resolvedAssets.StartsWith($resolvedRepository)) {
    throw "Refusing to replace assets outside the repository."
}

Get-ChildItem -LiteralPath $resolvedAssets -Force | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $webDistribution "*") -Destination $resolvedAssets -Recurse -Force
Write-Host "Web assets synchronized with the Android project."

