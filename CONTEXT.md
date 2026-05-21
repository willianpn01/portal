# Portal Frieren — Contexto para nova sessão do Claude Code

> Leia este arquivo antes de qualquer tarefa. Ele documenta o estado real do projeto,
> decisões não óbvias e bugs já resolvidos para evitar regressões.

---

## Estado atual do projeto

- **Versão:** v0.1.0-beta
- **Status:** funcionando em produção no Windows 10 e em desenvolvimento no Ubuntu
- **Repositório:** https://github.com/willianpn01/portal
- **Acesso dev:** http://localhost:5173 (Vite) → proxy → http://localhost:8000 (Django)
- **Acesso produção:** http://\<ip-da-maquina\>:8070 (Django serve tudo via Whitenoise)

---

## O que está implementado e funcionando

### Dashboard
- Widgets: relógio, uptime do sistema, uso de CPU/RAM/disco, previsão do tempo resumida, notícias recentes, ROMs favoritadas, atalhos rápidos
- Fundo customizável por tema via classe CSS `.dashboard-bg` (não inline style)
- Overlay de legibilidade via `.dashboard-overlay` com variável `--dash-overlay`
- Cards com diamond corners no tema Arcane via wrapper `.card-corner`

### Clima
- Provider: OpenWeatherMap One Call 3.0 (exige cartão, gratuito até 1.000 calls/dia)
- Suporte também a WeatherAPI (fallback configurável)
- Cache de 60min no banco SQLite
- Previsão de 4 dias, ícones dinâmicos, umidade, vento

### Notícias
- RSS multi-fonte com cache de 30min
- Feeds padrão: Hacker News, TechCrunch, G1, BBC Brasil
- Feeds gerenciados via UI em Configurações → Feeds RSS
- Toggle ativo/inativo por feed, refresh individual

### PDF / OCR
- **merge, split, compress, rotate** — PyMuPDF (fitz)
- **pdf_to_images** — PyMuPDF, exporta ZIP de PNGs
- **images_to_pdf** — Pillow + PyMuPDF
- **pdf_to_text** — PyMuPDF extração nativa
- **ocr_image** — Tesseract via subprocess
- **ocr_pdf** — OCRmyPDF
- **pdf_to_docx** — pdfminer.six + python-docx (extração estrutural, sem layout visual)
- **pdf_to_docx_ocr** — OCRmyPDF primeiro, depois pdfminer.six + python-docx
- **docx_to_pdf** — LibreOffice headless (`soffice --headless --convert-to pdf`)
- **img_convert, img_crop, img_resize** — Pillow (módulo Imagens, não PDF)
- Jobs assíncronos via Huey; operações leves rodam síncronas se arquivo < 50MB
- Workspace por usuário em `media/pdf_workspace/<user_id>/`

### Downloads
- yt-dlp com fila Huey
- Formatos: vídeo (mp4), áudio (mp3/m4a), legendas
- Progresso em tempo real via polling do frontend
- Suporte a URL direta além de YouTube

### Arquivos (File Manager)
- Raízes configuráveis via modelo `FileManagerRoot` (banco SQLite)
- Toggle ativo/inativo por raiz, sem reiniciar servidor
- Upload, preview de imagens, zip/unzip
- Proteção contra path traversal via `safe_path()` usando `Path.relative_to()`
  (não `str.startswith()` — ver seção de bugs)

### Imagens
- Rota: `/images` (substituiu `/music` que nunca foi implementado)
- Operações: conversão de formato, crop com preview interativo, resize com proporção
- Backend: reutiliza endpoints do módulo PDF (`/api/pdf/`)
- Pillow já estava no requirements.txt — sem dependências novas

### Retro Gaming
- EmulatorJS via CDN (não bundled)
- ROMs servidas via FileResponse com `Content-Length` obrigatório
- Frontend converte a resposta em blob URL antes de passar ao EmulatorJS
  (solução para `ErrnoError errno 44` — ver seção de bugs)
- Endpoint de ROM com `AllowAny` pois EmulatorJS não envia cookies de sessão

### ROM Library
- Scan automático de diretório configurado em `roms_path`
- Metadata via TheGamesDB API (gratuita com chave)
- Capas salvas em `media/covers/<platform>/`
- Endpoint de cover com `AllowAny` (browser `<img src>` cross-origin não envia cookies)
- Rescrape sob demanda: `POST /api/roms/rescrape/` (Huey task)
- Campo: `thegamesdb_id` (foi renomeado de `screenscraper_id` na migration 0002)

### Rádio
- Radio Browser API (sem chave, pública)
- Player persistente na barra inferior (componente `RadioPlayer`)
- Estado global via Zustand (`radioStore`)
- Evento `canplay` como fallback a `playing` (resolve loading infinito em alguns streams)
- Favoritos salvos no banco

### Configurações
- `GET/PUT /api/settings/` — lê/escreve `backend/config/executables.json`
- Campos sensíveis (`weather_api_key`, `thegamesdb_api_key`) mascarados como `********` no GET
- Seções: Aparência, Clima, Executáveis, Diretórios, TheGamesDB, File Manager, Feeds RSS
- `GET/POST /api/settings/file-roots/` e `PATCH/DELETE /api/settings/file-roots/<id>/`
  — gerenciamento de raízes do File Manager (também disponível em `/api/files/roots/`)

### Temas
- **Frieren** (padrão): light mode, paleta creme/verde/dourado
  - Imagem de fundo: `frontend/public/assets/frieren-hero.jpg`
- **Arcane**: dark mode, paleta dourado envelhecido sobre fundo quase preto
  - Imagem de fundo: `frontend/public/assets/arcane-hero.jpg`
  - Decorações extras: linhas douradas em cards, diamantes nos cantos, sidebar com textura
- Seleção em Configurações → Aparência
- Persistência via Zustand persist (`localStorage` key: `portal-theme`)
- Aplicação imediata: `document.documentElement.setAttribute('data-theme', theme)`
- Pre-aplicação no `main.jsx` antes do render React (evita flash de tema errado)
- CSS: `[data-theme="frieren"]` em `theme.css`, `[data-theme="arcane"]` em `theme-arcane.css`
- Sidebar: nome muda com o tema — Frieren → "Frieren", Arcane → "Potter"

---

## Decisões técnicas importantes

| Decisão | Alternativa rejeitada | Motivo |
|---|---|---|
| Huey + SQLite broker | Celery + Redis | Sem Redis no servidor; fila sequencial é suficiente para uso pessoal |
| Zustand | Redux | Menos boilerplate; stores simples sem actions/reducers |
| Monolito modular | Microserviços | Complexidade desnecessária; deploy único via NSSM |
| TheGamesDB | ScreenScraper | ScreenScraper requer contribuição de scrapes; TheGamesDB é gratuito com chave |
| pdfminer.six + python-docx | python-pdfplumber, PyMuPDF DOCX | Melhor extração de estrutura de texto; python-docx gera .docx nativamente |
| LibreOffice headless | Pandoc, PyODConverter | Fidelidade visual superior para DOCX→PDF; já instalado |
| EmulatorJS via CDN | RetroArch Web, JNES | EmulatorJS é plug-and-play, suporta múltiplos cores sem configuração |
| blob URL para ROMs | Servir via URL direta | Contorna `ErrnoError errno 44` do EmulatorJS com paths de rede |
| AllowAny em covers/ROMs | Tokens de autenticação | Requests de `<img src>` e EmulatorJS não enviam cookies cross-origin |

**Removidos do escopo:**
- **Jukebox** — removido do escopo inicial; pode virar v2
- **iLovePDF** — integrado e depois removido; a API não suporta PDF→DOCX (só Office→PDF)
- **ScreenScraper** — substituído por TheGamesDB

---

## Arquitetura

```
Browser (React) ←→ Vite dev server (dev) / Whitenoise (prod)
                         ↓
                  Django (DRF) + Huey worker
                         ↓
                  SQLite (único banco: dados + fila Huey)
                         ↓
             Ferramentas externas: Tesseract, LibreOffice, yt-dlp, ffmpeg
```

**Servir frontend em produção:**
- `whitenoise.middleware.WhiteNoiseMiddleware` após `SecurityMiddleware` no `MIDDLEWARE`
- `WHITENOISE_ROOT = BASE_DIR.parent / 'frontend' / 'dist'` — serve `index.html` e assets
- `STATICFILES_DIRS = [FRONTEND_BUILD_DIR / 'assets']` — assets do React sob `/static/`
- `re_path(r'^(?!api/).*$', TemplateView...)` no `urls.py` — catch-all para React Router

**Dois serviços Windows (NSSM):**
- `PortalWeb` — `python manage.py runserver 0.0.0.0:<porta>`
- `PortalHuey` — `python manage.py run_huey`

---

## Estrutura de diretórios crítica

```
portal/                          ← raiz do projeto / raiz do git
├── backend/
│   ├── config/
│   │   ├── executables.json     ← NÃO está no git (chaves e paths reais)
│   │   └── executables.json.example  ← está no git (template seguro)
│   ├── portal/
│   │   ├── settings.py          ← import os, whitenoise, FRONTEND_BUILD_DIR
│   │   └── urls.py              ← catch-all re_path para React Router
│   └── db.sqlite3               ← NÃO está no git
├── frontend/
│   ├── dist/                    ← NÃO está no git (gerar: npm run build)
│   └── public/
│       └── assets/
│           ├── .gitkeep         ← está no git (mantém o diretório)
│           ├── frieren-hero.jpg ← NÃO está no git (imagem pessoal)
│           └── arcane-hero.jpg  ← NÃO está no git (imagem pessoal)
├── media/                       ← NÃO está no git
│   ├── downloads/
│   ├── covers/
│   └── pdf_workspace/
├── venv/                        ← NÃO está no git
├── CLAUDE.md                    ← regras de desenvolvimento obrigatórias
├── CONTEXT.md                   ← este arquivo
├── README.md                    ← documentação geral
├── DEPLOY_WINDOWS.md            ← guia de deploy detalhado
├── install.ps1                  ← instalação automática Windows
└── uninstall.ps1                ← remoção limpa Windows
```

---

## Deploy Windows — pontos críticos

- **Porta:** 8070 (8000 e 8080 estavam ocupadas na máquina de produção)
- **Python:** instalado via `uv` em caminho não convencional:
  `C:\Users\willi\AppData\Roaming\uv\python\cpython-3.12.13-windows-x86_64-none\python.exe`
  O `install.ps1` detecta via `py -0p | findstr 3.12` automaticamente
- **ALLOWED_HOSTS:** deve incluir o IP fixo da máquina além de `localhost`
  Configurar via variável de ambiente `DJANGO_ALLOWED_HOSTS` no NSSM
- **SECRET_KEY:** gerada aleatoriamente pelo `install.ps1` e injetada via `AppEnvironmentExtra`
- **LibreOffice:** `soffice_path` deve apontar para `soffice.exe` dentro de `program\`
- **Tesseract:** instalar via UB Mannheim com language packs `por` e `eng`
- **yt-dlp:** usar `.exe` standalone em `C:\Portal\tools\`, não via pip
  (facilita atualização: `yt-dlp.exe -U`)
- **Serviço SYSTEM:** não tem acesso a variáveis de usuário — tudo via `AppEnvironmentExtra`
- **SQLite:** permissão de escrita do usuário SYSTEM em `C:\Portal\backend\`

---

## Bugs conhecidos e resoluções

### EmulatorJS: `ErrnoError errno 44` ao carregar ROM
**Causa:** EmulatorJS tenta fazer fetch de uma URL de rede como se fosse sistema de arquivos local.
**Solução:** Endpoint `rom_file` retorna o arquivo; frontend faz `fetch()` → `blob()` → `URL.createObjectURL()` e passa o blob URL ao EmulatorJS. Ver `RetroPlayerPage.jsx`.

### EmulatorJS: cores (emuladores) errados
**Causa:** Os IDs de core do EmulatorJS não seguem o nome do console.
**Mapeamento correto:**
- NES → `nes`
- SNES → `snes9x`
- Game Boy / GBC → `gambatte`
- GBA → `mgba`
- Mega Drive / Genesis → `segaMD`

### LibreOffice: abre PDF como Draw em vez de Writer
**Causa:** `soffice --convert-to docx` sem `--infilter` usa o Draw (editor de PDFs visuais).
**Solução:** Passar `--infilter=writer_pdf_import` para forçar abertura no Writer com extração de texto.
*(Nota: esta flag foi usada em implementação anterior; a versão atual usa pdfminer.six + python-docx localmente para PDF→DOCX, sem LibreOffice nessa direção.)*

### LibreOffice: timeout no Huey worker
**Causa:** Worker Huey herda ambiente mínimo; LibreOffice não encontra `HOME` ou `DISPLAY`.
**Solução:** `env = os.environ.copy(); env['HOME'] = str(Path.home()); env['DISPLAY'] = ':0'` passado para `subprocess.run()`. Timeout de 600s.

### `safe_path()`: falso positivo em path traversal
**Causa:** `str(resolved).startswith(str(base))` falha quando um diretório é prefixo de outro (ex: `/media/downloads` é prefixo de `/media/downloads-backup`).
**Solução:** Usar `resolved.relative_to(base)` que lança `ValueError` se não for subpath. Ver `common/executables.py`.

### ROM cover e arquivo: 403 Forbidden
**Causa:** `<img src="http://localhost:8000/api/roms/1/cover/">` e EmulatorJS não enviam cookies de sessão cross-origin (5173→8000 em dev).
**Solução:** `@permission_classes([AllowAny])` nos endpoints `rom_cover` e `rom_file`. Endpoints de mutação (`rescrape`, etc.) continuam com `IsAuthenticated`.

### Radio player: sempre em estado de loading
**Causa:** Streams de rádio ao vivo às vezes não disparam o evento `playing` em todos os browsers.
**Solução:** Escutar também `canplay` como fallback para `clearLoading`. Ver `RadioPlayer.jsx`.

### shadcn/ui: componentes não encontrados
**Causa:** shadcn/ui não vem pré-instalado; cada componente é gerado individualmente.
**Solução:** `npx shadcn@latest add <componente>` (ex: `card`, `button`, `input`, `label`, `progress`).
Os componentes ficam em `frontend/src/components/ui/`.

### iLovePDF: removido após integração
**Causa:** A API iLovePDF não tem endpoint para PDF→DOCX (só faz Office→PDF via `officepdf`). A operação inversa (`pdftoffice`) não existia conforme documentado.
**Solução:** Integração removida completamente. Todas as operações usam infra local.

### ScreenScraper → TheGamesDB
**Causa:** ScreenScraper exige contribuição de scrapes para acesso à API gratuita; não viável.
**Solução:** Migrado para TheGamesDB (gratuito com chave). Campo renomeado de `screenscraper_id` para `thegamesdb_id` (migration `0002`).

### Migration bloqueada por admin.py
**Causa:** `admin.py` referenciava `screenscraper_id` em `readonly_fields` antes da migration de rename, causando `SystemCheckError`.
**Solução:** Atualizar `admin.py` antes de rodar `makemigrations`.

---

## Como retomar o desenvolvimento (Ubuntu)

```bash
# 1. Entrar no projeto e ativar venv
cd ~/Projetos/Claude/Portal
source venv/bin/activate

# 2. Terminal 1 — Django
cd backend && python manage.py runserver

# 3. Terminal 2 — Huey worker (obrigatório para downloads, OCR, ROM scan)
cd backend && python manage.py run_huey

# 4. Terminal 3 — Vite dev server
cd frontend && npm run dev

# Acesse: http://localhost:5173
```

---

## Como atualizar o Windows após mudanças

```powershell
# No Windows, como Administrador
Stop-Service PortalWeb, PortalHuey

# Copiar arquivos backend modificados para C:\Portal\backend\
# Se o frontend mudou: rodar npm run build no Ubuntu e copiar dist\

C:\Portal\venv\Scripts\pip install -r C:\Portal\backend\requirements.txt
C:\Portal\venv\Scripts\python C:\Portal\backend\manage.py migrate --noinput
C:\Portal\venv\Scripts\python C:\Portal\backend\manage.py collectstatic --noinput

Start-Service PortalHuey
Start-Service PortalWeb
```

---

## Próximos passos sugeridos

- **Jukebox** — player de música local (estava no escopo original, removido para v2)
- **Galeria de imagens** — visualizador de fotos com thumbnails
- **Leitor de eBooks** — suporte a EPUB/PDF inline
- **Notificações internas** — alertas de conclusão de jobs (downloads, OCR)
- **Wake on LAN** — ligar outros PCs da rede pelo portal
