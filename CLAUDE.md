# Portal Web Pessoal — Contexto do Projeto

## O que é este projeto

Portal web self-hosted para rede local, rodando como estação de trabalho e entretenimento centralizada. Monolito modular. Sem microserviços. Sem Docker. Sem Redis.

- **Dev:** Ubuntu Linux
- **Deploy (produção):** Windows 10 Pro via NSSM
- **Acesso:** exclusivamente rede local

---

## Stack

**Backend:** Python 3.12+, Django, Django REST Framework, Huey (fila de tarefas com SQLite broker)

**Frontend:** React + Vite, React Router, Axios, TailwindCSS, shadcn/ui, Zustand (state global)

**Banco:** SQLite (único banco — settings, ROMs, histórico, playlists, jobs, preferências)

**Ferramentas externas:** ffmpeg, Tesseract OCR, yt-dlp, EmulatorJS

---

## Comandos essenciais

```bash
# Backend
cd backend
source venv/bin/activate          # Linux
# venv\Scripts\activate           # Windows
python manage.py runserver
python manage.py migrate
python manage.py huey_consumer portal.tasks  # worker de background

# Frontend
cd frontend
npm run dev       # desenvolvimento
npm run build     # build estático para produção

# Testes
cd backend && python manage.py test
cd frontend && npm run test
```

---

## Estrutura do projeto

```
portal/
├── backend/
│   ├── core/          # settings, auth, usuário
│   ├── dashboard/     # widgets, sistema stats
│   ├── weather/       # integração OpenWeather/WeatherAPI
│   ├── news/          # RSS parser + cache
│   ├── pdf_tools/     # PyMuPDF, Tesseract, OCRmyPDF
│   ├── downloads/     # yt-dlp, fila de downloads
│   ├── file_manager/  # navegação, upload, operações
│   ├── retro/         # launcher EmulatorJS
│   ├── rom_library/   # scan, metadata ScreenScraper, favoritos
│   ├── radio/         # Radio Browser API, favoritos
│   ├── common/        # utilitários compartilhados
│   └── api/           # roteamento DRF
├── frontend/
│   ├── components/
│   ├── pages/
│   ├── layouts/
│   ├── services/      # Axios wrappers
│   ├── hooks/
│   ├── stores/        # Zustand stores
│   └── utils/
├── media/             # uploads, ROMs, música, capas
└── CLAUDE.md
```

---

## Regras de desenvolvimento — OBRIGATÓRIAS

### Cross-platform (crítico para deploy Windows)

**Nunca usar:**
- Paths hardcoded com `/` ou `\`
- Comandos shell Linux-only (`grep`, `find`, `ls`, etc.) sem abstração
- Suposições sobre `systemd`

**Sempre usar:**
```python
from pathlib import Path
import subprocess
import os
import platform
```

**Resolução de executáveis externos** — sempre via este padrão:
```python
import shutil
from pathlib import Path

def resolve_executable(name: str, config_path: str | None = None) -> Path:
    if config_path:
        return Path(config_path)
    found = shutil.which(name)
    if found:
        return Path(found)
    if platform.system() == "Windows":
        local = Path("C:/Portal/tools") / f"{name}.exe"
        if local.exists():
            return local
    raise FileNotFoundError(f"{name} não encontrado. Configure em Configurações.")
```

### Segurança no File Manager

Todo endpoint que acessa o filesystem **deve** validar path traversal:
```python
def safe_path(base: Path, user_input: str) -> Path:
    resolved = (base / user_input).resolve()
    if not str(resolved).startswith(str(base.resolve())):
        raise PermissionError("Acesso negado.")
    return resolved
```

Operações destrutivas (delete, move) exigem confirmação explícita no frontend.

### Filas de background (Huey)

Usar `@huey.task()` para: OCR, yt-dlp, scan de ROMs, scan de música, compressões.  
Nunca bloquear a thread da requisição com operações longas.

---

## Módulos e decisões de design

| Módulo | Decisão | Detalhe |
|---|---|---|
| Background jobs | Huey + SQLite broker | Sem Redis, fila sequencial é suficiente |
| State global frontend | Zustand | Sem Redux — menos boilerplate |
| Player de áudio | Apenas Rádio | Jukebox removido do escopo inicial |
| ROM metadata | ScreenScraper API V2 | `jeuInfos.php` (match por hash), cache local no SQLite |
| Emulador | EmulatorJS | NES, SNES, GB, GBC, GBA, Mega Drive |
| PDF/OCR | PyMuPDF + Tesseract + OCRmyPDF | |
| Downloads | yt-dlp | YouTube + URL direta |

---

## Configurações de paths (settings.json)

O arquivo `backend/config/executables.json` guarda os paths manuais:
```json
{
  "ffmpeg_path": null,
  "yt_dlp_path": null,
  "tesseract_path": null,
  "roms_path": null,
  "music_path": null,
  "allowed_file_manager_roots": []
}
```
`null` = detectar automaticamente via PATH do sistema.

---

## Fora de escopo (não implementar)

- AI local
- Plex ou media server
- Password vault
- Docker / containers
- PostgreSQL
- Exposição pública / HTTPS externo
- Jukebox (removido — pode virar v2)
- Compartilhamento entre PCs
