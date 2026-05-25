#Requires -Version 7.0
<#
.SYNOPSIS
    Registra e inicia os servicos Windows do Portal Frieren via NSSM.
    Execute como Administrador DEPOIS de testar o portal manualmente.

.EXEMPLO
    cd C:\Portal
    .\service_install.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$PORTAL_DIR  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BACKEND_DIR = "$PORTAL_DIR\backend"
$VENV_DIR    = "$PORTAL_DIR\venv"
$TOOLS_DIR   = "$PORTAL_DIR\tools"
$LOGS_DIR    = "$PORTAL_DIR\logs"
$pythonVenv  = "$VENV_DIR\Scripts\python.exe"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Portal Frieren — Instalar Servicos   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Verificar privilégios de Administrador ─────────────────────────────────

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
    Write-Host "ERRO: Execute este script como Administrador." -ForegroundColor Red
    Write-Host "Clique com botao direito no PowerShell > 'Executar como administrador'" -ForegroundColor Yellow
    exit 1
}

# ── 2. Verificar pre-requisitos ───────────────────────────────────────────────

Write-Host "Verificando pre-requisitos..." -ForegroundColor Yellow

if (-not (Test-Path $pythonVenv)) {
    Write-Host "ERRO: venv nao encontrado em $VENV_DIR" -ForegroundColor Red
    Write-Host "Execute setup.ps1 primeiro." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "$BACKEND_DIR\manage.py")) {
    Write-Host "ERRO: backend nao encontrado em $BACKEND_DIR" -ForegroundColor Red
    exit 1
}

$nssmExe = $null
if (Test-Path "$TOOLS_DIR\nssm.exe") {
    $nssmExe = "$TOOLS_DIR\nssm.exe"
} else {
    $found = Get-Command nssm.exe -ErrorAction SilentlyContinue
    if ($found) { $nssmExe = $found.Source }
}

if (-not $nssmExe) {
    Write-Host "ERRO: nssm.exe nao encontrado." -ForegroundColor Red
    Write-Host "Baixe em: https://nssm.cc/download" -ForegroundColor Yellow
    Write-Host "Coloque nssm.exe em: $TOOLS_DIR\" -ForegroundColor Yellow
    exit 1
}

Write-Host "  Python venv: $pythonVenv" -ForegroundColor Green
Write-Host "  NSSM: $nssmExe" -ForegroundColor Green

# ── 3. Porta ──────────────────────────────────────────────────────────────────

Write-Host ""
$portInput = Read-Host "Porta do servidor (Enter para usar 8070)"
$PORT = if ($portInput -match '^\d+$') { $portInput } else { '8070' }

# ── 4. Remover servicos existentes se houver ──────────────────────────────────

foreach ($svc in @('PortalWeb', 'PortalHuey')) {
    $existing = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  Removendo servico existente: $svc..." -ForegroundColor Yellow
        if ($existing.Status -eq 'Running') {
            Stop-Service $svc -Force
        }
        & $nssmExe remove $svc confirm 2>$null
    }
}

# ── 5. Gerar secret key ───────────────────────────────────────────────────────

$SECRET_KEY = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 50 | ForEach-Object { [char]$_ })
$envVars    = "DJANGO_SETTINGS_MODULE=portal.settings DJANGO_SECRET_KEY=$SECRET_KEY DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,*"

# ── 6. Registrar servicos ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "Registrando servicos..." -ForegroundColor Yellow

# PortalWeb
& $nssmExe install PortalWeb $pythonVenv
& $nssmExe set PortalWeb AppParameters "$BACKEND_DIR\manage.py runserver 0.0.0.0:$PORT"
& $nssmExe set PortalWeb AppDirectory $BACKEND_DIR
& $nssmExe set PortalWeb AppEnvironmentExtra $envVars
& $nssmExe set PortalWeb AppStdout "$LOGS_DIR\django.log"
& $nssmExe set PortalWeb AppStderr "$LOGS_DIR\django_error.log"
& $nssmExe set PortalWeb Start SERVICE_AUTO_START
& $nssmExe set PortalWeb AppRestartDelay 3000

# PortalHuey
& $nssmExe install PortalHuey $pythonVenv
& $nssmExe set PortalHuey AppParameters "$BACKEND_DIR\manage.py run_huey"
& $nssmExe set PortalHuey AppDirectory $BACKEND_DIR
& $nssmExe set PortalHuey AppEnvironmentExtra $envVars
& $nssmExe set PortalHuey AppStdout "$LOGS_DIR\huey.log"
& $nssmExe set PortalHuey AppStderr "$LOGS_DIR\huey_error.log"
& $nssmExe set PortalHuey Start SERVICE_AUTO_START
& $nssmExe set PortalHuey AppRestartDelay 5000

Write-Host "  Servicos registrados." -ForegroundColor Green

# ── 7. Iniciar servicos ───────────────────────────────────────────────────────

Write-Host "Iniciando servicos..." -ForegroundColor Yellow
Start-Service PortalHuey
Start-Sleep -Seconds 2
Start-Service PortalWeb

Start-Sleep -Seconds 3
$web  = Get-Service PortalWeb
$huey = Get-Service PortalHuey

if ($web.Status -eq 'Running' -and $huey.Status -eq 'Running') {
    Write-Host "  Ambos os servicos estao rodando." -ForegroundColor Green
} else {
    Write-Host "  Atencao: verifique o status dos servicos." -ForegroundColor Yellow
    Write-Host "  PortalWeb:  $($web.Status)" -ForegroundColor White
    Write-Host "  PortalHuey: $($huey.Status)" -ForegroundColor White
    Write-Host "  Logs: $LOGS_DIR\" -ForegroundColor Gray
}

# ── 8. Regra de Firewall ──────────────────────────────────────────────────────

Write-Host "Configurando firewall (porta $PORT)..." -ForegroundColor Yellow
New-NetFirewallRule `
    -DisplayName "Portal Frieren" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $PORT `
    -Action Allow `
    -ErrorAction SilentlyContinue | Out-Null
Write-Host "  Regra de firewall criada." -ForegroundColor Green

# ── Resumo ────────────────────────────────────────────────────────────────────

$localIP = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169' } |
    Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Servicos instalados com sucesso!      " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Acesse: http://localhost:$PORT" -ForegroundColor Cyan
if ($localIP) {
    Write-Host "  Rede local: http://${localIP}:$PORT" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "  Logs em: $LOGS_DIR\" -ForegroundColor Gray
Write-Host "  Para desinstalar: .\service_uninstall.ps1 (como Administrador)" -ForegroundColor Gray
Write-Host ""
