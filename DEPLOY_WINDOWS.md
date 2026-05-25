# Deploy no Windows 10

## Pré-requisitos

Baixar e instalar antes de começar:

| Ferramenta | Onde obter | Observação |
|---|---|---|
| Python 3.12+ | python.org/downloads | Marcar "Add to PATH" |
| PowerShell 7+ | github.com/PowerShell/PowerShell/releases | Obrigatório para os scripts |
| LibreOffice | libreoffice.org | Instalar completo |
| Tesseract | github.com/UB-Mannheim/tesseract/wiki | Selecionar `por` e `eng` no installer |
| NSSM | nssm.cc/download | Extrair `nssm.exe` para `C:\Portal\tools\` |
| yt-dlp.exe | github.com/yt-dlp/yt-dlp/releases | Copiar para `C:\Portal\tools\` |
| ffmpeg.exe | ffmpeg.org/download.html | Copiar para `C:\Portal\tools\` |

## Estrutura de diretórios

Após a instalação:

```
C:\Portal\                   ← repositório clonado aqui
├── backend\
├── frontend\
│   └── dist\                ← build do React (gerado antes do setup)
├── venv\                    ← criado pelo setup.ps1
├── tools\
│   ├── nssm.exe
│   ├── yt-dlp.exe
│   └── ffmpeg.exe
├── media\
│   ├── downloads\
│   ├── covers\
│   ├── pdf_workspace\
│   └── savestates\
└── logs\
```

## Instalação — passo a passo

### 1. Clonar o repositório

```powershell
git clone <url-do-repositorio> C:\Portal
```

### 2. Gerar o build do frontend

Se o `frontend\dist\` não estiver presente (não é commitado no git), gerar o build. No Ubuntu:

```bash
cd frontend
npm install
npm run build
# Copiar a pasta frontend/dist/ para C:\Portal\frontend\dist\
```

Ou, se Node.js estiver instalado no Windows:

```powershell
cd C:\Portal\frontend
npm install
npm run build
```

### 3. Colocar as ferramentas em C:\Portal\tools\

Antes de rodar o setup, colocar em `C:\Portal\tools\`:

- `nssm.exe` — necessário para instalar como serviço
- `yt-dlp.exe`
- `ffmpeg.exe`

### 4. Rodar setup.ps1

Abrir o **PowerShell 7** (sem Administrador) e executar:

```powershell
cd C:\Portal
.\setup.ps1
```

O script realiza automaticamente:
- Verificação do Python 3.12
- Criação do `venv` e instalação das dependências Python
- Criação dos diretórios `media\`, `logs\`, `tools\`
- Cópia de `executables.json.example` → `executables.json` (se ainda não existir)
- `migrate` e `collectstatic`
- Criação do superusuário (opcional, com prompt)

### 5. Preencher executables.json

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

### 6. Testar manualmente

Antes de instalar como serviço, verificar que tudo funciona. Abrir **dois terminais PowerShell**:

```powershell
# Terminal 1 — Django
cd C:\Portal\backend
C:\Portal\venv\Scripts\python manage.py runserver 0.0.0.0:8070
```

```powershell
# Terminal 2 — Huey worker
cd C:\Portal\backend
C:\Portal\venv\Scripts\python manage.py run_huey
```

Acessar http://localhost:8070 e verificar o funcionamento completo antes de continuar.

### 7. Instalar como serviço Windows

Se o teste manual estiver OK, abrir o **PowerShell 7 como Administrador**:

```powershell
cd C:\Portal
.\service_install.ps1
```

O script registra os serviços `PortalWeb` e `PortalHuey` via NSSM, pergunta a porta (padrão: 8070), gera a `SECRET_KEY` automaticamente, configura as variáveis de ambiente, abre a porta no Firewall e inicia os serviços.

Para remover os serviços:

```powershell
cd C:\Portal
.\service_uninstall.ps1   # requer Administrador
```

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
- `DJANGO_SECRET_KEY` é gerada automaticamente pelo `service_install.ps1` e injetada via `AppEnvironmentExtra`
- O banco SQLite fica em `C:\Portal\backend\` — verificar permissão de escrita do usuário `SYSTEM`

### EmulatorJS

- ROMs servidas via `FileResponse` com `Content-Length` obrigatório
- Frontend usa blob URL para contornar limitações do proxy
- Cores dos emuladores: `nes`, `snes9x`, `gambatte`, `mgba`, `segaMD`

### Temas

- Imagens de fundo devem estar em `C:\Portal\frontend\public\assets\`:
  - `frieren-hero.jpg` (tema Frieren)
  - `arcane-hero.jpg` (tema Arcane)
- Essas imagens não são commitadas no git — copiar manualmente após o clone

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
```

## Atualização após mudanças no código

```powershell
cd C:\Portal
git pull

# Se o frontend mudou: gerar novo build
cd C:\Portal\frontend && npm run build && cd C:\Portal

Stop-Service PortalWeb, PortalHuey

cd C:\Portal\backend
C:\Portal\venv\Scripts\pip install -r requirements.txt
C:\Portal\venv\Scripts\python manage.py migrate --noinput
C:\Portal\venv\Scripts\python manage.py collectstatic --noinput

Start-Service PortalHuey
Start-Service PortalWeb
```
