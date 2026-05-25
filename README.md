# Portal Frieren — Documentação

## Visão geral

Portal web self-hosted para rede local, funcionando como estação de trabalho e entretenimento centralizada. Monolito modular sem microserviços, Docker ou Redis.

- **Dev:** Ubuntu Linux
- **Deploy:** Windows 10 Pro via NSSM
- **Acesso:** exclusivamente rede local

## Módulos implementados

| Módulo | Descrição |
|---|---|
| Dashboard | Widgets de horário, sistema, clima, notícias, atalhos, ROMs recentes |
| Clima | OpenWeatherMap One Call 3.0, previsão 4 dias, cache 60min |
| Notícias | RSS multi-fonte com cache 30min (HN, TechCrunch, G1, BBC Brasil) |
| PDF / OCR | merge, split, compress, rotate, PDF↔imagens, PDF→texto, OCR, PDF→DOCX, DOCX→PDF |
| Downloads | yt-dlp com fila Huey, progresso em tempo real, vídeo/áudio/legendas |
| Arquivos | File Manager com raízes configuráveis, upload, preview, zip/unzip |
| Imagens | Conversão de formato, crop e resize via Pillow |
| Retro | EmulatorJS com NES/SNES/GB/GBC/GBA/Mega Drive, blob URL para ROMs |
| ROMs | Scan automático, metadata via TheGamesDB, capas, favoritos, rescrape |
| Rádio | Radio Browser API, player persistente, favoritos |
| Configurações | Todos os settings via UI, dois temas (Frieren/Arcane) |

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Python 3.12, Django, DRF, Huey (SQLite broker) |
| Frontend | React + Vite, React Router, Axios, TailwindCSS, Zustand |
| Banco | SQLite |
| Ferramentas externas | ffmpeg, Tesseract OCR, yt-dlp, LibreOffice, EmulatorJS |

## Requisitos do sistema

### Ubuntu (desenvolvimento)

```bash
sudo apt install libreoffice --no-install-recommends
sudo apt install tesseract-ocr tesseract-ocr-por tesseract-ocr-eng
sudo apt install ffmpeg
# yt-dlp via pip no venv — não usar versão do apt (desatualizada)
```

- Python 3.12+
- Node.js 20+

### Windows 10 (produção)

- Python 3.12+ no PATH
- PowerShell 7+ (obrigatório para os scripts de instalação)
- Node.js 20+ (apenas para gerar o build do frontend — não necessário em produção)
- LibreOffice instalado em `C:\Program Files\LibreOffice\`
- Tesseract instalado via UB Mannheim com language packs `por` e `eng`
- `yt-dlp.exe` em `C:\Portal\tools\`
- `ffmpeg.exe` em `C:\Portal\tools\`
- `nssm.exe` em `C:\Portal\tools\`

Veja [DEPLOY_WINDOWS.md](DEPLOY_WINDOWS.md) para o passo a passo completo.

## Setup desenvolvimento (Ubuntu)

```bash
# 1. Backend
cd backend
python -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt

# 2. Configurar
cp config/executables.json.example config/executables.json
# Editar executables.json com suas chaves e paths

# 3. Banco
python manage.py migrate
python manage.py createsuperuser

# 4. Frontend
cd ../frontend
npm install

# 5. Rodar (3 terminais)
# Terminal 1 — Django
cd backend && python manage.py runserver

# Terminal 2 — Huey worker
cd backend && python manage.py run_huey

# Terminal 3 — Vite dev server
cd frontend && npm run dev
```

Acesse: http://localhost:5173

## config/executables.json — referência completa

```json
{
  "ffmpeg_path": null,
  "yt_dlp_path": null,
  "tesseract_path": null,
  "soffice_path": null,
  "downloads_path": null,
  "roms_path": null,
  "weather_provider": "openweathermap",
  "weather_api_key": null,
  "weather_city": "Sua Cidade",
  "weather_country": "BR",
  "weather_lat": null,
  "weather_lon": null,
  "thegamesdb_api_key": null
}
```

- `null` = detectar automaticamente via PATH do sistema
- `weather_lat`/`lon` null = geocoding automático pela cidade
- `thegamesdb_api_key`: solicitar em [forums.thegamesdb.net](https://forums.thegamesdb.net) (seção API Key Requests)
- OpenWeatherMap One Call 3.0 exige cadastro de cartão (gratuito até 1.000 calls/dia)

## Temas

| Tema | Estilo | Imagem de fundo |
|---|---|---|
| Frieren (padrão) | Light mode, paleta creme/verde/dourado | `public/assets/frieren-hero.jpg` |
| Arcane | Dark mode, paleta dourado envelhecido sobre preto | `public/assets/arcane-hero.jpg` |

Seleção em **Configurações → Aparência**, persiste via `localStorage`.

## Variáveis de ambiente

| Variável | Default | Descrição |
|---|---|---|
| `DJANGO_DEBUG` | `False` | Ativar modo debug |
| `DJANGO_SECRET_KEY` | — | Obrigatória em produção |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Hosts permitidos |

## Avisos do deploy check

Os seguintes warnings de `python manage.py check --deploy` são ignorados intencionalmente para uso em rede local sem HTTPS:

- HSTS não configurado
- SSL redirect desabilitado
- Session/CSRF cookies sem flag `Secure`
- `DEBUG` controlado por variável de ambiente

## Estrutura do projeto

```
portal/
├── backend/
│   ├── core/           # auth, modelo de usuário, settings API
│   ├── dashboard/      # widgets, stats do sistema
│   ├── weather/        # integração OpenWeather/WeatherAPI
│   ├── news/           # RSS parser + cache
│   ├── pdf_tools/      # PyMuPDF, Tesseract, OCRmyPDF, LibreOffice
│   ├── downloads/      # yt-dlp, fila de downloads
│   ├── file_manager/   # navegação, upload, operações
│   ├── retro/          # launcher EmulatorJS
│   ├── rom_library/    # scan, metadata TheGamesDB, favoritos
│   ├── radio/          # Radio Browser API, favoritos
│   ├── common/         # utilitários (executables, safe_path)
│   ├── api/            # roteamento DRF central
│   ├── config/         # executables.json
│   └── portal/         # settings, urls, wsgi
├── frontend/
│   ├── src/
│   │   ├── components/ # UI, layout, player
│   │   ├── pages/      # uma por rota
│   │   ├── services/   # Axios wrappers
│   │   ├── stores/     # Zustand (auth, theme, pdf, radio…)
│   │   └── styles/     # tema Frieren, tema Arcane, global
│   └── public/
│       └── assets/     # imagens de fundo dos temas
└── media/              # uploads, ROMs, capas, pdf_workspace
```
