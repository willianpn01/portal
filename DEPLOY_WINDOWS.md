# Deploy no Windows 10

## Pré-requisitos

Baixar e instalar antes de começar:

| Ferramenta | Onde obter | Observação |
|---|---|---|
| Python 3.12+ | python.org/downloads | Marcar "Add to PATH" |
| LibreOffice | libreoffice.org | Instalar completo |
| Tesseract | github.com/UB-Mannheim/tesseract/wiki | Selecionar `por` e `eng` no installer |
| NSSM | nssm.cc/download | Extrair `nssm.exe` para `C:\Portal\tools\` |
| yt-dlp.exe | github.com/yt-dlp/yt-dlp/releases | Copiar para `C:\Portal\tools\` |
| ffmpeg.exe | ffmpeg.org/download.html | Copiar ffmpeg.exe para `C:\Portal\tools\` |
| Node.js 20+ | nodejs.org | Só necessário para gerar o build |

## Estrutura de diretórios

```
C:\Portal\
├── backend\
├── frontend_build\
├── venv\
├── tools\
│   ├── nssm.exe
│   ├── yt-dlp.exe
│   └── ffmpeg.exe
├── media\
│   ├── downloads\
│   ├── covers\
│   └── pdf_workspace\
├── logs\
└── db.sqlite3
```

Criar as pastas antes de começar:

```powershell
New-Item -ItemType Directory -Force C:\Portal\tools, C:\Portal\media\downloads,
  C:\Portal\media\covers, C:\Portal\media\pdf_workspace, C:\Portal\logs
```

## Passo a passo

### 1. Gerar build do frontend (no Ubuntu)

```bash
cd frontend
npm run build
# Copiar frontend/dist/ inteiro para C:\Portal\frontend_build\ na máquina Windows
```

Copiar também as imagens de fundo:

```
frontend/public/assets/frieren-hero.jpg  →  C:\Portal\frontend_build\assets\
frontend/public/assets/arcane-hero.jpg   →  C:\Portal\frontend_build\assets\
```

### 2. Copiar o backend

Copiar o diretório `backend/` para `C:\Portal\backend\`.

### 3. Criar venv e instalar dependências

```powershell
python -m venv C:\Portal\venv
C:\Portal\venv\Scripts\pip install -r C:\Portal\backend\requirements.txt
```

### 4. Configurar executables.json

Editar `C:\Portal\backend\config\executables.json`:

```json
{
  "ffmpeg_path": "C:/Portal/tools/ffmpeg.exe",
  "yt_dlp_path": "C:/Portal/tools/yt-dlp.exe",
  "tesseract_path": "C:/Program Files/Tesseract-OCR/tesseract.exe",
  "soffice_path": "C:/Program Files/LibreOffice/program/soffice.exe",
  "downloads_path": "C:/Portal/media/downloads",
  "roms_path": null,
  "weather_provider": "openweathermap",
  "weather_api_key": "SUA_KEY",
  "weather_city": "Sua Cidade",
  "weather_country": "BR",
  "weather_lat": null,
  "weather_lon": null,
  "thegamesdb_api_key": "SUA_KEY"
}
```

> **Paths no Windows:** usar barras normais (`/`) ou duplas (`\\`). Nunca barra invertida simples (`\`) — causa erros de escape no JSON.

### 5. Preparar banco e arquivos estáticos

```powershell
cd C:\Portal\backend
C:\Portal\venv\Scripts\python manage.py migrate
C:\Portal\venv\Scripts\python manage.py createsuperuser
C:\Portal\venv\Scripts\python manage.py collectstatic --noinput
```

### 6. Registrar serviços via NSSM

Abrir **PowerShell como Administrador**:

```powershell
# ── Serviço Django ────────────────────────────────────────────────────────────
C:\Portal\tools\nssm.exe install PortalWeb C:\Portal\venv\Scripts\python.exe
C:\Portal\tools\nssm.exe set PortalWeb AppParameters "C:\Portal\backend\manage.py runserver 0.0.0.0:8000"
C:\Portal\tools\nssm.exe set PortalWeb AppDirectory C:\Portal\backend
C:\Portal\tools\nssm.exe set PortalWeb AppEnvironmentExtra "DJANGO_SETTINGS_MODULE=portal.settings" "DJANGO_SECRET_KEY=troque-por-chave-longa-e-aleatoria"
C:\Portal\tools\nssm.exe set PortalWeb AppStdout C:\Portal\logs\django.log
C:\Portal\tools\nssm.exe set PortalWeb AppStderr C:\Portal\logs\django_error.log
C:\Portal\tools\nssm.exe set PortalWeb Start SERVICE_AUTO_START
C:\Portal\tools\nssm.exe set PortalWeb AppRestartDelay 3000

# ── Serviço Huey (worker de background) ──────────────────────────────────────
C:\Portal\tools\nssm.exe install PortalHuey C:\Portal\venv\Scripts\python.exe
C:\Portal\tools\nssm.exe set PortalHuey AppParameters "C:\Portal\backend\manage.py run_huey"
C:\Portal\tools\nssm.exe set PortalHuey AppDirectory C:\Portal\backend
C:\Portal\tools\nssm.exe set PortalHuey AppEnvironmentExtra "DJANGO_SETTINGS_MODULE=portal.settings" "DJANGO_SECRET_KEY=troque-por-chave-longa-e-aleatoria"
C:\Portal\tools\nssm.exe set PortalHuey AppStdout C:\Portal\logs\huey.log
C:\Portal\tools\nssm.exe set PortalHuey AppStderr C:\Portal\logs\huey_error.log
C:\Portal\tools\nssm.exe set PortalHuey Start SERVICE_AUTO_START
C:\Portal\tools\nssm.exe set PortalHuey AppRestartDelay 5000

# ── Iniciar ───────────────────────────────────────────────────────────────────
Start-Service PortalHuey
Start-Service PortalWeb
```

### 7. Liberar porta no Firewall

```powershell
New-NetFirewallRule -DisplayName "Portal Frieren" `
  -Direction Inbound -Protocol TCP `
  -LocalPort 8000 -Action Allow
```

### 8. Acessar

- Local: http://localhost:8000
- Rede local: http://\<ip-da-maquina\>:8000

---

## Pontos de atenção críticos

### LibreOffice headless

- Configurar `soffice_path` em `executables.json`
- PDF→DOCX pode demorar vários minutos para PDFs grandes (>200 páginas)
- O serviço Huey precisa ter permissão de acesso ao diretório do LibreOffice
- Em caso de travamento, reiniciar o serviço PortalHuey é suficiente

### Tesseract

- Instalar via UB Mannheim com language packs `por` e `eng` selecionados
- Verificar: `tesseract --list-langs` deve mostrar `por` e `eng`
- Configurar `tesseract_path` apontando para `tesseract.exe`

### yt-dlp

- Usar o `.exe` standalone (não `pip install yt-dlp`) para facilitar atualizações
- Atualizar periodicamente: `C:\Portal\tools\yt-dlp.exe -U` — YouTube muda com frequência e versões antigas param de funcionar

### NSSM e ambiente

- O serviço roda como `SYSTEM` — sem acesso a variáveis de ambiente do usuário
- `DJANGO_SECRET_KEY` deve ser configurada via `AppEnvironmentExtra` no NSSM
- O banco SQLite fica em `C:\Portal\backend\` por padrão — verificar permissão de escrita do usuário `SYSTEM`

### EmulatorJS

- ROMs servidas via `FileResponse` com `Content-Length` obrigatório
- Frontend usa blob URL para contornar limitações do proxy
- Cores dos emuladores: `nes`, `snes9x`, `gambatte`, `mgba`, `segaMD`

### Temas

- Imagens de fundo devem estar em `frontend_build\assets\`:
  - `frieren-hero.jpg` (tema Frieren)
  - `arcane-hero.jpg` (tema Arcane)
- Copiar as imagens junto com o build do frontend

---

## Comandos úteis

```powershell
# Status dos serviços
Get-Service PortalWeb, PortalHuey

# Ver logs em tempo real
Get-Content C:\Portal\logs\django.log -Wait -Tail 50
Get-Content C:\Portal\logs\huey.log -Wait -Tail 50

# Reiniciar serviços
Restart-Service PortalWeb
Restart-Service PortalHuey

# Remover serviços (reinstalação limpa)
C:\Portal\tools\nssm.exe remove PortalWeb confirm
C:\Portal\tools\nssm.exe remove PortalHuey confirm
```

## Atualização após mudanças no código

```powershell
Stop-Service PortalWeb, PortalHuey

# Copiar novos arquivos para C:\Portal\backend\
# Se mudou o frontend: gerar novo build no Ubuntu e copiar dist\ para C:\Portal\frontend_build\

C:\Portal\venv\Scripts\pip install -r C:\Portal\backend\requirements.txt
C:\Portal\venv\Scripts\python C:\Portal\backend\manage.py migrate --noinput
C:\Portal\venv\Scripts\python C:\Portal\backend\manage.py collectstatic --noinput

Start-Service PortalHuey
Start-Service PortalWeb
```
