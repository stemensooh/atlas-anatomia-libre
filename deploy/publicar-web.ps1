<#
.SYNOPSIS
  Compila el visor (web/) en este equipo y lo publica en el VPS (D-017). Guía: docs/DESPLIEGUE.md

.DESCRIPTION
  1. `pnpm run build` en web/ (copia data/processed a dist/data/processed).
  2. Empaqueta web/dist en un .tgz y lo sube con scp.
  3. En el VPS lo descomprime en <Destino>/releases/<fecha>, apunta <Destino>/current a esa versión
     (cambio atómico con `ln -sfn`) y conserva las 3 últimas.
  Usa tu clave SSH habitual: este script no guarda ni pide credenciales.

.EXAMPLE
  .\deploy\publicar-web.ps1 -Servidor usuario@atlas.stemensoft.com
.EXAMPLE
  .\deploy\publicar-web.ps1 -Servidor usuario@203.0.113.10 -SinCompilar
#>
param(
  [Parameter(Mandatory = $true)][string]$Servidor,   # usuario@host del VPS
  [string]$Destino = "/var/www/atlas",
  [switch]$SinCompilar                              # reutiliza web/dist ya compilado
)

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$web = Join-Path $raiz "web"
$dist = Join-Path $web "dist"

if (-not $SinCompilar) {
  Write-Host "==> Compilando el visor..." -ForegroundColor Cyan
  Push-Location $web
  try {
    pnpm run build
    if ($LASTEXITCODE -ne 0) { throw "La compilación falló." }
  } finally { Pop-Location }
}

if (-not (Test-Path (Join-Path $dist "index.html"))) { throw "No existe web/dist/index.html." }
if (-not (Test-Path (Join-Path $dist "data/processed/metadata.json"))) {
  throw "Falta web/dist/data/processed/metadata.json (¿existe data/processed?)."
}

$version = Get-Date -Format "yyyyMMdd-HHmmss"
$paquete = Join-Path ([IO.Path]::GetTempPath()) "atlas-web-$version.tgz"
Write-Host "==> Empaquetando web/dist..." -ForegroundColor Cyan
tar -czf $paquete -C $dist .
if ($LASTEXITCODE -ne 0) { throw "tar falló." }
"{0:N1} MB" -f ((Get-Item $paquete).Length / 1MB) | Write-Host

try {
  Write-Host "==> Subiendo a $Servidor..." -ForegroundColor Cyan
  scp $paquete "${Servidor}:/tmp/atlas-web-$version.tgz"
  if ($LASTEXITCODE -ne 0) { throw "scp falló." }

  Write-Host "==> Activando la versión $version..." -ForegroundColor Cyan
  $remoto = @"
set -e
R='$Destino/releases/$version'
mkdir -p "`$R"
tar -xzf '/tmp/atlas-web-$version.tgz' -C "`$R"
rm -f '/tmp/atlas-web-$version.tgz'
chmod -R a+rX "`$R"
ln -sfn "`$R" '$Destino/current'
cd '$Destino/releases' && ls -1t | tail -n +4 | xargs -r rm -rf
echo "Publicado: `$R"
"@ -replace "`r", ""
  $remoto | ssh $Servidor "bash -s"
  if ($LASTEXITCODE -ne 0) { throw "La activación en el VPS falló." }
} finally {
  Remove-Item $paquete -ErrorAction SilentlyContinue
}

Write-Host "==> Listo: https://atlas.stemensoft.com" -ForegroundColor Green
