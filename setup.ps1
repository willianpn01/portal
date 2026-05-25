#Requires -Version 7.0
<#
.SYNOPSIS
    Configura o ambiente do Portal Frieren.
    Execute a partir da raiz do projeto (C:\Portal).
    NAO precisa ser Administrador.

.EXEMPLO
    cd C:\Portal
    .\setup.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$PORTAL_DIR  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BACKEND_DIR = "$PORTAL_DIR\backend"
$VENV_DIR    = "$PORTAL_DIR\venv"
$TOOLS_DIR   = "$PORTAL_DIR\tools"
$LOGS_DIR    = "$PORTAL_DIR\logs"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Portal Frieren — Setup               " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Verificar Python 3.12 ──────────────────────────────────────────────────

Write-Host "Verificando Python 3.12..." -ForegroundColor Yellow

$pythonExe = $null
try {
    $pyList = & py -0p 2>$null
    foreach ($line in $pyList) {
        if ($line -match '3\.12') {
            $pythonExe = ($line -split '\s+' | Where-Object { $_ -match '\.exe$' } | Select-Object -First 1)
            if (-not $pythonExe) {
                $pythonExe = ($line.Trim() -split '\s+')[-1]
            }
            break
        }
    }
} catch {}

if (-not $pythonExe -or -not (Test-Path $pythonExe)) {
    Write-Host ""
    Write-Host "ERRO: Python 3.12 nao encontrado." -ForegroundColor Red
    Write-Host "Baixe em: https://python.org/downloads" -ForegroundColor Yellow
    Write-Host "Marque 'Add Python to PATH' durante a instalacao." -ForegroundColor Yellow
    exit 1
}

Write-Host "  Python 3.12 encontrado: $pythonExe" -ForegroundColor Green

# ── 2. Verificar backend ───────────────────────────────────────────────────────

if (-not (Test-Path "$BACKEND_DIR\manage.py")) {
    Write-Host ""
    Write-Host "ERRO: pasta 'backend' nao encontrada em $BACKEND_DIR" -ForegroundColor Red
    Write-Host "Verifique se o clone do repositorio foi feito corretamente." -ForegroundColor Yellow
    exit 1
}

Write-Host "  Backend encontrado." -ForegroundColor Green

# ── 3. Criar estrutura de diretorios ──────────────────────────────────────────

Write-Host "Criando estrutura de diretorios..." -ForegroundColor Yellow

$dirs = @(
    $LOGS_DIR,
    "$PORTAL_DIR\media\downloads",
    "$PORTAL_DIR\media\covers",
    "$PORTAL_DIR\media\pdf_workspace",
    "$PORTAL_DIR\media\savestates",
    $TOOLS_DIR
)
foreach ($d in $dirs) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
}

Write-Host "  Diretorios criados." -ForegroundColor Green

# Avisar sobre ferramentas opcionais
$missing = @()
if (-not (Test-Path "$TOOLS_DIR\yt-dlp.exe"))  { $missing += "yt-dlp.exe   -> https://github.com/yt-dlp/yt-dlp/releases" }
if (-not (Test-Path "$TOOLS_DIR\ffmpeg.exe"))   { $missing += "ffmpeg.exe   -> https://ffmpeg.org/download.html" }
if (-not (Test-Path "$TOOLS_DIR\nssm.exe"))     { $missing += "nssm.exe     -> https://nssm.cc/download (necessario para instalar como servico)" }

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "  Aviso: ferramentas ausentes em $TOOLS_DIR\:" -ForegroundColor Yellow
    foreach ($m in $missing) { Write-Host "    - $m" -ForegroundColor Yellow }
    Write-Host ""
}

# ── 4. Criar venv e instalar dependencias ─────────────────────────────────────

Write-Host "Criando ambiente virtual Python..." -ForegroundColor Yellow
& $pythonExe -m venv $VENV_DIR

$pipExe     = "$VENV_DIR\Scripts\pip.exe"
$pythonVenv = "$VENV_DIR\Scripts\python.exe"

Write-Host "Instalando dependencias Python (pode demorar alguns minutos)..." -ForegroundColor Yellow
& $pipExe install -r "$BACKEND_DIR\requirements.txt"
Write-Host "  Dependencias instaladas." -ForegroundColor Green

# ── 5. Configurar executables.json ────────────────────────────────────────────

$configDest    = "$BACKEND_DIR\config\executables.json"
$configExample = "$BACKEND_DIR\config\executables.json.example"

if (-not (Test-Path $configDest)) {
    if (Test-Path $configExample) {
        Copy-Item $configExample $configDest
        Write-Host ""
        Write-Host "  executables.json criado a partir do exemplo." -ForegroundColor Green
        Write-Host "  PROXIMO PASSO: edite o arquivo antes de continuar:" -ForegroundColor Yellow
        Write-Host "  $configDest" -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host "  executables.json ja existe, mantido sem alteracao." -ForegroundColor Green
}

# ── 6. Banco de dados ─────────────────────────────────────────────────────────

Push-Location $BACKEND_DIR

Write-Host "Aplicando migracoes do banco..." -ForegroundColor Yellow
& $pythonVenv manage.py migrate
Write-Host "  Migracoes aplicadas." -ForegroundColor Green

# ── 7. Arquivos estaticos ─────────────────────────────────────────────────────

Write-Host "Coletando arquivos estaticos..." -ForegroundColor Yellow
& $pythonVenv manage.py collectstatic --noinput
Write-Host "  Arquivos estaticos coletados." -ForegroundColor Green

# ── 8. Criar superusuario ─────────────────────────────────────────────────────

Write-Host ""
$createUser = Read-Host "Criar superusuario agora? (S/N)"
if ($createUser -match '^[Ss]') {
    & $pythonVenv manage.py createsuperuser
}

Pop-Location

# ── Resumo ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup concluido!                      " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Proximos passos:" -ForegroundColor Cyan
Write-Host "  1. Edite: $BACKEND_DIR\config\executables.json" -ForegroundColor White
Write-Host "     Preencha os paths e chaves de API." -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Teste manualmente (dois PowerShells):" -ForegroundColor White
Write-Host "     PS1: cd $BACKEND_DIR" -ForegroundColor Gray
Write-Host "          $pythonVenv manage.py runserver 0.0.0.0:8070" -ForegroundColor Gray
Write-Host "     PS2: cd $BACKEND_DIR" -ForegroundColor Gray
Write-Host "          $pythonVenv manage.py run_huey" -ForegroundColor Gray
Write-Host "     Acesse: http://localhost:8070" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Se tudo OK, instale como servico Windows:" -ForegroundColor White
Write-Host "     (Como Administrador) .\service_install.ps1" -ForegroundColor Gray
Write-Host ""
