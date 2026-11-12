# Portal Frieren — Contexto do Projeto

Leia este arquivo antes de qualquer tarefa em nova sessão.

---

## O que é este projeto

Portal web self-hosted para rede local. Monolito modular. Sem Docker, sem Redis, sem microserviços.

- **Dev:** Ubuntu Linux — `http://localhost:5173` (Vite) → proxy → `http://localhost:8000` (Django)
- **Deploy (produção):** Windows 10 Pro via NSSM — porta **8070**
- **Acesso:** exclusivamente rede local

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3.12+, Django 6, DRF, Huey (SQLite broker) |
| Frontend | React + Vite, Zustand, TailwindCSS, shadcn/ui, Axios |
| Banco | SQLite único |
| Ferramentas | ffmpeg, Tesseract OCR, yt-dlp, LibreOffice headless, EmulatorJS |

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

# Huey — reiniciar após qualquer edição em tasks.py:
find . -name "*.pyc" -delete && find . -name "__pycache__" -type d -exec rm -rf {} +
# Depois reiniciar o processo huey_consumer
```

---

## Estrutura do projeto

```
portal/
├── backend/
│   ├── core/          # auth, usuário
│   ├── dashboard/     # widgets, stats
│   ├── weather/       # OpenWeatherMap One Call 3.0
│   ├── news/          # RSS parser + cache
│   ├── pdf_tools/     # PyMuPDF, Tesseract, OCRmyPDF
│   ├── downloads/     # yt-dlp, fila Huey
│   ├── file_manager/  # navegação, upload, operações
│   ├── retro/         # launcher EmulatorJS
│   ├── rom_library/   # scan, TheGamesDB API, save states
│   ├── radio/         # Radio Browser API
│   ├── writer/        # módulo Escritor (ver abaixo)
│   ├── common/        # utilitários compartilhados
│   └── api/           # roteamento DRF
├── frontend/
│   ├── components/
│   ├── pages/
│   ├── layouts/
│   ├── services/      # Axios wrappers
│   ├── stores/        # Zustand stores
│   └── utils/
├── media/             # uploads, ROMs, capas, save states
└── CLAUDE.md
```

---

## Módulos e status

| Módulo | Status | Detalhe |
|--------|--------|---------|
| Dashboard | ✅ | widgets: sistema, clima, notícias, ROMs recentes, atalhos |
| Clima | ✅ | OpenWeatherMap One Call 3.0, cache 60min |
| Notícias | ✅ | RSS multi-fonte, cache 30min |
| PDF/OCR | ✅ | merge, split, compress, rotate, OCR, conversões via LibreOffice |
| Downloads | ✅ | yt-dlp, fila Huey, progresso em tempo real |
| File Manager | ✅ | raízes configuráveis, upload, preview, zip/unzip |
| Imagens | ✅ | conversão, crop, resize via Pillow |
| Retro Gaming | ✅ | EmulatorJS via iframe, blob URL para ROMs |
| ROM Library | ✅ | scan, TheGamesDB, capas, favoritos, save states, revalidação |
| Rádio Online | ✅ | Radio Browser API, player persistente |
| Configurações | ✅ | todos os settings via UI |
| **Escritor** | ✅ F1+F2 | ver seção abaixo |

**Dois temas:** Frieren (light) e Arcane (dark).

---

## Módulo Escritor

### Fase 1 — ✅ Completa

**Modelos** (`backend/writer/models.py`):
- `BookProject` — projeto de livro
- `Chapter` — capítulo com `html_content`, `meta` (JSONField), `last_autosave`
- `ChapterVersion` — snapshot; `Chapter.prune_versions()` mantém máximo 20 por capítulo
- `AITask` — auditoria de chamadas IA (tokens, custo estimado, snippets de 200 chars)

**Endpoints** em `/api/writer/`:
- CRUD projetos e capítulos
- `POST /chapters/<id>/autosave/` — salva html_content com sanitização bleach
- `POST /chapters/<id>/save-version/` — versão manual com label
- `GET /chapters/<id>/versions/` e `/versions/<vid>/` — histórico
- `POST /chapters/<id>/export/` — dispara task Huey, retorna `task_id`
- `GET /chapters/<id>/export/status/<task_id>/` — polling de status

**Export DOCX** via LibreOffice headless (task Huey):
- BeautifulSoup pipeline antes do export: strip `.author-note` → rename `<mark>` → `<span>` → `text-align:justify` inline em cada `<p>`
- Resultado gravado em `Chapter.meta['last_export_task']`

**Sanitização HTML** (bleach + CSSSanitizer / tinycss2):
- Tags: `p h1 h2 h3 h4 strong em u ul ol li blockquote br span mark hr div`
- Atributos: `{'*': ['class', 'style', 'data-color']}`
- CSS permitido: `color background-color font-family font-size text-align font-weight font-style text-decoration`

**Frontend:**
- Rotas: `/writer` → `WriterProjectsPage` · `/writer/project/:id` → `WriterProjectPage` · `/writer/project/:id/edit/:chapterId` → `WriterEditorPage`
- `WriterEditorPage` usa layout próprio (tela inteira, fora do `MainLayout`)
- Zustand store: `useWriterStore`
- Item "Escritor" na sidebar

**Toolbar expandida:**
- Google Fonts carregadas no `index.html`: Merriweather, Lora, Playfair Display, EB Garamond, Inter, Courier Prime
- Extensões TipTap: `StarterKit`, `Underline`, `TextAlign`, `TextStyle`, `FontFamily`, `FontSize`, `Color`, `Highlight` (multicolor), `Typography`, `AuthorNote` (custom Node), `SearchHighlightExtension` (ProseMirror plugin custom)
- `BulletListNoMinus`: input rule só `* ` ativa lista; `- ` (traço simples) é reservado para travessão
- Seletor de fonte e tamanho com persistência em `localStorage`
- Cor do texto e destaque via `<input type="color">` nativo
- Separador de cena (`<hr>` estilizado)
- Nota do autor: bloco `AuthorNote`, removido no export, não conta palavras
- Busca e substituição: barra retrátil no topbar, ProseMirror Decorations para highlight
- Contagem de palavras por seleção em tempo real
- Modo foco: fundo `#1a1a1a`, texto centralizado 680px, Esc para sair
- Índice automático: gerado por H1/H2/H3, clique faz scroll, aba "Índice" no painel lateral
- Travessão: extensão Typography converte `--` em `—`

> **Por que não usar `@sereneinserenade/tiptap-search-and-replace`:** requer `@tiptap/pm@^2.7.0`, incompatível com TipTap v3. Implementar busca com `Plugin`/`PluginKey` de `@tiptap/pm/state` e `Decoration`/`DecorationSet` de `@tiptap/pm/view`.

> **TipTap v3:** todos os imports são named exports — nunca default. `DOMSerializer` vem de `@tiptap/pm/model`.

### Fase 2 — ✅ Completa

**Backend:**
- `backend/writer/ai_client.py` — cliente OpenAI com retry exponencial (3 tentativas, backoff 2×), logging de tokens
- `backend/writer/services.py` — `correct_spelling()` com chunking por parágrafo (limite 12.000 chars)
- Modelo: `gpt-5.4-nano`
- Variável de ambiente: **`Ciel`** (chave da API OpenAI). **Nunca `OPENAI_API_KEY`, nunca hardcoded.**
- Se `Ciel` não definida → endpoint retorna 503
- `POST /api/writer/chapters/<id>/correct/` — corpo: `{scope: 'selection'|'chapter', text?: string}`

**Frontend:**
- Seleção ativa → corrige só a seleção (usa `DOMSerializer` para extrair HTML)
- Sem seleção → modal de confirmação antes de corrigir o capítulo inteiro
- Loading: editor não-editável + botão "Corrigindo..." durante a chamada
- Timeout: `AbortController` de 65s
- Erros: 503 → "Serviço de IA não configurado", 502 → "Erro na API de IA", timeout → "A correção demorou muito"
- `changed: false` → toast verde "Nenhum erro encontrado!"
- `changed: true` → abre `SpellingDiffModal` com diff palavra-a-palavra (`diffWords` da lib `diff`)
- Aceitar → `insertContentAt` (seleção) ou `setContent` + autosave (capítulo) → toast "Correções aplicadas!"
- Rejeitar → fecha modal sem alterar → toast "Correções descartadas"

### Fase 3 — ⏳ Não iniciada

- Personagens (`Character`), alertas de inconsistência (`ConsistencyAlert`)
- Extração de atributos via IA

---

## ROM Library — detalhe adicional

- **Revalidação:** `POST /api/roms/revalidate/` — varre banco, checa `Path(rom.file_path).is_file()`, remove ROMs sem arquivo físico, retorna `{checked, removed, kept}`
- **Save States:** 9 slots por ROM/usuário, screenshots, auto-load via `EJS_loadStateURL` no EmulatorJS
- **Scan:** TheGamesDB API, match por hash, capas salvas em media/

---

## Regras de desenvolvimento — OBRIGATÓRIAS

### Cross-platform (crítico para deploy Windows)

**Nunca usar:**
- Paths hardcoded com `/` ou `\`
- Comandos shell Linux-only sem abstração
- Suposições sobre `systemd`

**Sempre usar:** `pathlib.Path`, `subprocess`, `os`, `platform`

**Resolução de executáveis externos:**
```python
import shutil, platform
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

Usar `@huey.task()` para: OCR, yt-dlp, scan de ROMs, exportações pesadas.
Nunca bloquear a thread da requisição com operações longas.

### Padrões gerais

1. Verificar padrão dos módulos existentes antes de implementar qualquer coisa nova
2. `makemigrations` + `migrate` após qualquer alteração de modelo
3. Sem dependências novas sem avisar — perguntar antes se não listado na stack

---

## Decisões técnicas críticas — nunca reverter

- **LibreOffice HTML→DOCX:** `--convert-to 'docx:MS Word 2007 XML'` **sem nenhum `--infilter`**. O filtro `writer_web_html_import` não existe e causa falha silenciosa. Testado no Ubuntu em 25/05/2026.

- **LibreOffice DOCX/DOC→PDF:** `--convert-to pdf` sem `--infilter`. Usar diretório de perfil separado (`-env:UserInstallation`) para evitar conflito de lock (0xc10) no Huey.

- **LibreOffice subprocess:** `env=os.environ.copy()` obrigatório; timeout mínimo 120s.

- **LibreOffice estilos inline vs CSS:** aplicar `text-align:justify` como estilo inline em cada `<p>` via BeautifulSoup — o LibreOffice ignora o bloco `<style>` quando há atributos inline no mesmo elemento.

- **LibreOffice tag `<mark>`:** converter para `<span style="background-color:...">` antes do export — LibreOffice não reconhece `<mark>` nativamente.

- **Servir media/ em Django:** não usar `static()` — depende de `DEBUG=True`. Usar `re_path` com `django.views.static.serve` diretamente em `urls.py`.

- **Catch-all do React Router:** `re_path(r'^(?!api/|media/).*$')` deve excluir `/media/` além de `/api/` — senão o `index.html` intercepta arquivos de media.

- **bleach no autosave:** `ALLOWED_ATTRIBUTES = {'*': ['class', 'style', 'data-color']}` — sem isso cores e destaques são removidos antes de salvar.

- **TipTap travessão de diálogo:** extensão `Typography` converte `--` em `—`. Desabilitar input rule de `- ` (traço + espaço) como ativador de lista; manter apenas `* `.

- **OpenAI gpt-5.4-nano:** usar `max_completion_tokens` em vez de `max_tokens` — o modelo rejeita `max_tokens` com erro 400.

- **EmulatorJS (módulo Retro — não mexer):**
  - Roda dentro de iframe (`RetroPage` → iframe → `RetroPlayerPage`)
  - `EJS_onSaveState` não funciona no CDN stable — save states usam `postMessage`
  - `StrictMode` removido do `main.jsx` (incompatível com EmulatorJS)
  - `/retro` e `/retro/play/:id` ficam **fora** do `MainLayout`
  - Cores corretas dos cores: `snes9x`, `gambatte`, `mgba`, `segaMD`, `nes`

---

## Paleta visual — tema Frieren

```css
--frieren-bg:        #f5f0e8   /* fundo geral */
--frieren-surface:   #faf7f2   /* cards, sidebar, topbar */
--frieren-border:    #e0d8cc   /* bordas suaves */
--frieren-text:      #3d3028   /* texto principal */
--frieren-muted:     #b0a090   /* texto secundário */
--frieren-accent:    #4a7a4a   /* verde — ações primárias */
--frieren-accent-bg: #e8ede8   /* verde claro — itens ativos */
```

---

## Deploy Windows — fluxo de atualização

1. `npm run build` no Ubuntu
2. Copiar `frontend/dist/` para `C:\Portal\frontend\dist\`
3. `python manage.py collectstatic --noinput`
4. Reiniciar serviços NSSM (`PortalWeb` e `PortalHuey`)

Variável de ambiente obrigatória no serviço `PortalWeb` (via NSSM → AppEnvironmentExtra):
```
Ciel=sk-...   # chave OpenAI para módulo Escritor
```

---

## Configurações de paths

`backend/config/executables.json`:
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
