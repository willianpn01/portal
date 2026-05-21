#Requires -Version 5.1
<#
.SYNOPSIS
    Remove os servicos e a regra de firewall do Portal Frieren.
    Execute como Administrador.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

$PORTAL_DIR = 'C:\Portal'
$TOOLS_DIR  = "$PORTAL_DIR\tools"

# ── Verificar privilégios ─────────────────────────────────────────────────────

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
    Write-Host "ERRO: Execute este script como Administrador." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  Portal Frieren — Desinstalacao        " -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# ── Detectar NSSM ────────────────────────────────────────────────────────────

$nssmExe = $null
if (Test-Path "$TOOLS_DIR\nssm.exe") {
    $nssmExe = "$TOOLS_DIR\nssm.exe"
} else {
    $nssmExe = (Get-Command nssm.exe -ErrorAction SilentlyContinue)?.Source
}

# ── Parar e remover serviços ──────────────────────────────────────────────────

Write-Host "Parando servicos..." -ForegroundColor Yellow

foreach ($svc in @('PortalWeb', 'PortalHuey')) {
    $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($s) {
        Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue
        if ($nssmExe) {
            & $nssmExe remove $svc confirm 2>$null
            Write-Host "  $svc removido via NSSM." -ForegroundColor Green
        } else {
            sc.exe delete $svc | Out-Null
            Write-Host "  $svc removido via sc.exe." -ForegroundColor Green
        }
    } else {
        Write-Host "  $svc nao encontrado (ja removido ou nunca instalado)." -ForegroundColor Gray
    }
}

# ── Remover regra de firewall ─────────────────────────────────────────────────

Write-Host "Removendo regra de firewall..." -ForegroundColor Yellow
Remove-NetFirewallRule -DisplayName "Portal Frieren" -ErrorAction SilentlyContinue
Write-Host "  Regra removida." -ForegroundColor Green

# ── Remover arquivos (opcional) ───────────────────────────────────────────────

Write-Host ""
$removeFiles = Read-Host "Remover todos os arquivos em $PORTAL_DIR\? (S/N)"

if ($removeFiles -match '^[Ss]') {
    Write-Host "Removendo $PORTAL_DIR\..." -ForegroundColor Yellow

    # Aguardar servicos pararem completamente
    Start-Sleep -Seconds 3

    try {
        Remove-Item -Recurse -Force $PORTAL_DIR -ErrorAction Stop
        Write-Host "  Arquivos removidos." -ForegroundColor Green
    } catch {
        Write-Host "  Aviso: alguns arquivos nao puderam ser removidos (podem estar em uso)." -ForegroundColor Yellow
        Write-Host "  Remova manualmente: $PORTAL_DIR" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Arquivos mantidos em $PORTAL_DIR\" -ForegroundColor Gray
}

# ── Resumo ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Portal Frieren desinstalado.          " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
