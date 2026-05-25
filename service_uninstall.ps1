#Requires -Version 7.0
<#
.SYNOPSIS
    Para e remove os servicos Windows do Portal Frieren.
    Execute como Administrador.

.EXEMPLO
    cd C:\Portal
    .\service_uninstall.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$PORTAL_DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition
$TOOLS_DIR  = "$PORTAL_DIR\tools"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Portal Frieren — Remover Servicos    " -ForegroundColor Cyan
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

# ── 2. Localizar NSSM ─────────────────────────────────────────────────────────

$nssmExe = $null
if (Test-Path "$TOOLS_DIR\nssm.exe") {
    $nssmExe = "$TOOLS_DIR\nssm.exe"
} else {
    $found = Get-Command nssm.exe -ErrorAction SilentlyContinue
    if ($found) { $nssmExe = $found.Source }
}

if (-not $nssmExe) {
    Write-Host "ERRO: nssm.exe nao encontrado em $TOOLS_DIR\" -ForegroundColor Red
    exit 1
}

# ── 3. Parar e remover servicos ───────────────────────────────────────────────

foreach ($svc in @('PortalWeb', 'PortalHuey')) {
    $existing = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "Parando $svc..." -ForegroundColor Yellow
        if ($existing.Status -eq 'Running') {
            Stop-Service $svc -Force
            Start-Sleep -Seconds 2
        }
        Write-Host "Removendo $svc..." -ForegroundColor Yellow
        & $nssmExe remove $svc confirm 2>$null
        Write-Host "  $svc removido." -ForegroundColor Green
    } else {
        Write-Host "  $svc nao encontrado (ja removido ou nunca instalado)." -ForegroundColor Gray
    }
}

# ── 4. Remover regra de firewall ──────────────────────────────────────────────

Write-Host "Removendo regra de firewall..." -ForegroundColor Yellow
Remove-NetFirewallRule -DisplayName "Portal Frieren" -ErrorAction SilentlyContinue
Write-Host "  Regra removida." -ForegroundColor Green

# ── Resumo ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Servicos removidos com sucesso!       " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Os arquivos do portal em $PORTAL_DIR foram mantidos." -ForegroundColor Gray
Write-Host "  Para reinstalar como servico: .\service_install.ps1 (como Administrador)" -ForegroundColor Gray
Write-Host ""
