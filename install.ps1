#Requires -Version 5.1
<#
.SYNOPSIS
    Script de instalação automática do Portal Frieren no Windows 10.
    Execute como Administrador a partir da raiz do projeto.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$PORTAL_DIR  = 'C:\Portal'
$BACKEND_DIR = "$PORTAL_DIR\backend"
$VENV_DIR    = "$PORTAL_DIR\venv"
$TOOLS_DIR   = "$PORTAL_DIR\tools"
$LOGS_DIR    = "$PORTAL_DIR\logs"
$SCRIPT_DIR  = Split-Path -Parent $MyInvocation.MyCommand.Definition

# ── 1. Verificar privilégios de Administrador ─────────────────────────────────

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
    Write-Host ""
    Write-Host "ERRO: Execute este script como Administrador." -ForegroundColor Red
    Write-Host "Clique com botao direito no PowerShell > 'Executar como administrador'" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Portal Frieren — Instalacao Windows   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 2. Verificar Python 3.12 ──────────────────────────────────────────────────

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

# ── 3. Verificar NSSM ─────────────────────────────────────────────────────────

Write-Host "Verificando NSSM..." -ForegroundColor Yellow

$nssmExe = $null
if (Test-Path "$TOOLS_DIR\nssm.exe") {
    $nssmExe = "$TOOLS_DIR\nssm.exe"
} else {
    $nssmExe = (Get-Command nssm.exe -ErrorAction SilentlyContinue)?.Source
}

if (-not $nssmExe) {
    Write-Host ""
    Write-Host "ERRO: nssm.exe nao encontrado." -ForegroundColor Red
    Write-Host "Baixe em: https://nssm.cc/download" -ForegroundColor Yellow
    Write-Host "Coloque nssm.exe em: $TOOLS_DIR\" -ForegroundColor Yellow
    Write-Host "(Crie a pasta se necessario e execute o script novamente)" -ForegroundColor Yellow
    exit 1
}

Write-Host "  NSSM encontrado: $nssmExe" -ForegroundColor Green

# ── 4. Criar estrutura de diretorios ─────────────────────────────────────────

Write-Host "Criando estrutura de diretorios..." -ForegroundColor Yellow

$dirs = @(
    $LOGS_DIR,
    "$PORTAL_DIR\media\downloads",
    "$PORTAL_DIR\media\covers",
    "$PORTAL_DIR\media\pdf_workspace",
    $TOOLS_DIR
)
foreach ($d in $dirs) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
}

Write-Host "  Diretorios criados em $PORTAL_DIR" -ForegroundColor Green

# Avisar sobre ferramentas opcionais
$missing = @()
if (-not (Test-Path "$TOOLS_DIR\yt-dlp.exe"))  { $missing += "yt-dlp.exe   -> https://github.com/yt-dlp/yt-dlp/releases" }
if (-not (Test-Path "$TOOLS_DIR\ffmpeg.exe"))   { $missing += "ffmpeg.exe   -> https://ffmpeg.org/download.html" }

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "  Aviso: ferramentas opcionais ausentes em $TOOLS_DIR\:" -ForegroundColor Yellow
    foreach ($m in $missing) { Write-Host "    - $m" -ForegroundColor Yellow }
    Write-Host "  (o portal funcionara sem elas, mas Downloads e PDF podem falhar)" -ForegroundColor Yellow
    Write-Host ""
}

# ── 5. Copiar backend ─────────────────────────────────────────────────────────

Write-Host "Copiando backend para $BACKEND_DIR..." -ForegroundColor Yellow

if (-not (Test-Path "$SCRIPT_DIR\backend")) {
    Write-Host "ERRO: pasta 'backend' nao encontrada ao lado deste script." -ForegroundColor Red
    exit 1
}

if (Test-Path $BACKEND_DIR) {
    Remove-Item -Recurse -Force $BACKEND_DIR
}
Copy-Item -Recurse "$SCRIPT_DIR\backend" $BACKEND_DIR

# Copiar frontend build se existir
$frontendBuild = "$SCRIPT_DIR\frontend\dist"
if (Test-Path $frontendBuild) {
    Write-Host "Copiando frontend build..." -ForegroundColor Yellow
    $frontendDest = "$PORTAL_DIR\frontend\dist"
    if (Test-Path $frontendDest) { Remove-Item -Recurse -Force $frontendDest }
    New-Item -ItemType Directory -Force -Path (Split-Path $frontendDest) | Out-Null
    Copy-Item -Recurse $frontendBuild $frontendDest
    Write-Host "  Frontend copiado." -ForegroundColor Green
} else {
    Write-Host "  Aviso: frontend/dist nao encontrado. Gere o build antes do deploy." -ForegroundColor Yellow
}

Write-Host "  Backend copiado." -ForegroundColor Green

# ── 6. Criar venv e instalar dependencias ────────────────────────────────────

Write-Host "Criando ambiente virtual Python..." -ForegroundColor Yellow
& $pythonExe -m venv $VENV_DIR
$pipExe    = "$VENV_DIR\Scripts\pip.exe"
$pythonVenv = "$VENV_DIR\Scripts\python.exe"

Write-Host "Instalando dependencias Python (pode demorar alguns minutos)..." -ForegroundColor Yellow
& $pipExe install -r "$BACKEND_DIR\requirements.txt"
Write-Host "  Dependencias instaladas." -ForegroundColor Green

# ── 7. Configurar executables.json ────────────────────────────────────────────

$configDest    = "$BACKEND_DIR\config\executables.json"
$configExample = "$BACKEND_DIR\config\executables.json.example"

if (-not (Test-Path $configDest)) {
    if (Test-Path $configExample) {
        Copy-Item $configExample $configDest
        Write-Host ""
        Write-Host "  IMPORTANTE: edite $configDest" -ForegroundColor Yellow
        Write-Host "  Preencha weather_api_key, thegamesdb_api_key e os paths" -ForegroundColor Yellow
        Write-Host ""
    }
}

# ── 8. Banco de dados e arquivos estaticos ────────────────────────────────────

Push-Location $BACKEND_DIR

Write-Host "Aplicando migracoes do banco..." -ForegroundColor Yellow
& $pythonVenv manage.py migrate

Write-Host "Coletando arquivos estaticos..." -ForegroundColor Yellow
& $pythonVenv manage.py collectstatic --noinput

# ── 9. Criar superusuario ─────────────────────────────────────────────────────

Write-Host ""
$createUser = Read-Host "Criar superusuario agora? (S/N)"
if ($createUser -match '^[Ss]') {
    & $pythonVenv manage.py createsuperuser
}

Pop-Location

# ── 10. Porta ────────────────────────────────────────────────────────────────

Write-Host ""
$portInput = Read-Host "Porta do servidor (Enter para usar 8070)"
$PORT = if ($portInput -match '^\d+$') { $portInput } else { '8070' }

# ── 11. Registrar servicos NSSM ───────────────────────────────────────────────

Write-Host ""
Write-Host "Registrando servicos Windows..." -ForegroundColor Yellow

# Gerar secret key aleatoria
$SECRET_KEY = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 50 | ForEach-Object { [char]$_ })

$envVars = "DJANGO_SETTINGS_MODULE=portal.settings DJANGO_SECRET_KEY=$SECRET_KEY DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,*"

# PortalWeb
& $nssmExe install PortalWeb $pythonVenv 2>$null
& $nssmExe set PortalWeb AppParameters "$BACKEND_DIR\manage.py runserver 0.0.0.0:$PORT"
& $nssmExe set PortalWeb AppDirectory $BACKEND_DIR
& $nssmExe set PortalWeb AppEnvironmentExtra $envVars
& $nssmExe set PortalWeb AppStdout "$LOGS_DIR\django.log"
& $nssmExe set PortalWeb AppStderr "$LOGS_DIR\django_error.log"
& $nssmExe set PortalWeb Start SERVICE_AUTO_START
& $nssmExe set PortalWeb AppRestartDelay 3000

# PortalHuey
& $nssmExe install PortalHuey $pythonVenv 2>$null
& $nssmExe set PortalHuey AppParameters "$BACKEND_DIR\manage.py run_huey"
& $nssmExe set PortalHuey AppDirectory $BACKEND_DIR
& $nssmExe set PortalHuey AppEnvironmentExtra $envVars
& $nssmExe set PortalHuey AppStdout "$LOGS_DIR\huey.log"
& $nssmExe set PortalHuey AppStderr "$LOGS_DIR\huey_error.log"
& $nssmExe set PortalHuey Start SERVICE_AUTO_START
& $nssmExe set PortalHuey AppRestartDelay 5000

Write-Host "  Servicos registrados." -ForegroundColor Green

# ── 12. Iniciar servicos ──────────────────────────────────────────────────────

Write-Host "Iniciando servicos..." -ForegroundColor Yellow
Start-Service PortalHuey
Start-Sleep -Seconds 2
Start-Service PortalWeb
Write-Host "  Servicos iniciados." -ForegroundColor Green

# ── 13. Regra de Firewall ────────────────────────────────────────────────────

Write-Host "Configurando firewall (porta $PORT)..." -ForegroundColor Yellow
New-NetFirewallRule `
    -DisplayName "Portal Frieren" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $PORT `
    -Action Allow `
    -ErrorAction SilentlyContinue | Out-Null
Write-Host "  Regra de firewall criada." -ForegroundColor Green

# ── 14. Resumo final ──────────────────────────────────────────────────────────

$localIP = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169' } |
    Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Portal instalado com sucesso!         " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Acesse: http://localhost:$PORT" -ForegroundColor Cyan
if ($localIP) {
    Write-Host "  Rede local: http://${localIP}:$PORT" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "  Logs: $LOGS_DIR\" -ForegroundColor Gray
Write-Host "  Config: $BACKEND_DIR\config\executables.json" -ForegroundColor Gray
Write-Host ""
Write-Host "  Para desinstalar: execute uninstall.ps1 como Administrador" -ForegroundColor Gray
Write-Host ""
