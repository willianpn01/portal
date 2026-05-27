# Contexto do Projeto — Portal Frieren

Use este arquivo sempre que iniciar uma nova sessão. Leia antes de qualquer ação.

---

## O que é este projeto

**Portal Frieren** — portal web self-hosted para rede local. Monolito modular.
Sem Docker, sem Redis, sem microserviços. Tudo simples e direto.

- **Repositório:** https://github.com/willianpn01/portal
- **Dev:** Ubuntu Linux
- **Deploy:** Windows 10 Pro via NSSM (dois serviços: `PortalWeb` e `PortalHuey`)
- **Porta:** 8070 (8000 e 8080 ocupadas no Windows)

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3.12, Django, DRF, Huey (SQLite broker) |
| Frontend | React + Vite + Zustand + TailwindCSS + shadcn/ui |
| Banco | SQLite único |
| Ferramentas | ffmpeg, Tesseract, yt-dlp, LibreOffice headless |

---

## Módulos existentes e funcionando

| Módulo | Status |
|--------|--------|
| Dashboard | ✅ widgets: sistema, clima, notícias, ROMs recentes, atalhos |
| Clima | ✅ OpenWeatherMap One Call 3.0, cache 60min |
| Notícias | ✅ RSS multi-fonte, cache 30min |
| PDF/OCR | ✅ merge, split, compress, rotate, OCR, PDF→DOCX, DOCX→PDF via LibreOffice |
| Downloads | ✅ yt-dlp, fila Huey, progresso em tempo real |
| File Manager | ✅ raízes configuráveis, upload, preview, zip/unzip |
| Imagens | ✅ conversão, crop, resize via Pillow |
| Retro Gaming | ✅ EmulatorJS via iframe, blob URL para ROMs |
| ROM Library | ✅ scan automático, TheGamesDB API, capas, favoritos |
| Save States | ✅ 9 slots por ROM/usuário, screenshots, auto-load via EJS_loadStateURL |
| Rádio Online | ✅ Radio Browser API, player persistente |
| Configurações | ✅ todos os settings via UI |
| **Escritor** | 🆕 Fase 1 recém-implementada — em teste |

**Dois temas:** Frieren (light) e Arcane (dark).

---

## Módulo Escritor — estado atual

### O que foi implementado (Fase 1)
- **Modelos:** `BookProject`, `Chapter`, `ChapterVersion`
- **Retenção de versões:** máximo 20 por capítulo via `Chapter.prune_versions()`
- **Endpoints DRF** em `/api/writer/`:
  - CRUD de projetos e capítulos
  - `/chapters/<id>/autosave/` — salva html_content com sanitização bleach
  - `/chapters/<id>/save-version/` — versão manual
  - `/chapters/<id>/versions/` e `/versions/<vid>/` — histórico
  - `/chapters/<id>/export/` — dispara task Huey, retorna `task_id`
  - `/chapters/<id>/export/status/<task_id>/` — polling de status
- **Export DOCX:** task Huey via LibreOffice headless, resultado em `Chapter.meta['last_export_task']`
- **Sanitização HTML:** bleach, tags permitidas: p, h1-h4, strong, em, u, ul, ol, li, blockquote, br
- **Frontend:**
  - `/writer` → `WriterProjectsPage`
  - `/writer/project/:id` → `WriterProjectPage`
  - `/writer/project/:id/edit/:chapterId` → `WriterEditorPage` (layout próprio, tela inteira)
  - Editor TipTap com extensões: StarterKit, Underline, TextAlign
  - Autosave a cada 30s e no onBlur
  - Painel lateral com aba Versões (restauração com confirmação)
  - Zustand store: `useWriterStore`
  - Item "Escritor" adicionado à sidebar

### O que ainda NÃO existe (não implementar sem instrução explícita)
- **Fase 2:** Correção ortográfica via OpenAI (`gpt-5.4-nano`)
- **Fase 3:** Personagens (`Character`), alertas de inconsistência (`ConsistencyAlert`), extração de atributos via IA
- Modo escuro específico do editor
- Autenticação adicional

---

## Decisões técnicas críticas — nunca reverter

### Gerais
- **LibreOffice:** sempre usar `--infilter=writer_pdf_import` para PDF→DOCX; `env=os.environ.copy()` obrigatório no subprocess; timeout mínimo de 120s
- **Huey:** SQLite broker; resultado de tasks pesadas salvo em JSONField do modelo (sem banco de tasks externo)
- **safe_path():** usa `Path.relative_to()`, nunca `startswith()` — evita falso positivo
- **ALLOWED_HOSTS:** via `os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')`

### EmulatorJS (módulo Retro — não mexer)
- Roda dentro de iframe (`RetroPage` → iframe → `RetroPlayerPage`)
- `EJS_onSaveState` não funciona no CDN stable — save states usam `postMessage`
- `StrictMode` removido do `main.jsx` (incompatível com EmulatorJS)
- `/retro` e `/retro/play/:id` ficam **fora** do `MainLayout`
- Cores corretas dos cores: `snes9x`, `gambatte`, `mgba`, `segaMD`, `nes`

### Deploy Windows
- PowerShell 7+ obrigatório
- Scripts na raiz: `setup.ps1`, `service_install.ps1`, `service_uninstall.ps1`
- Whitenoise serve o frontend build (`frontend/dist/`)

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

## Como rodar em desenvolvimento (Ubuntu)

```bash
cd ~/Projetos/Claude/Portal
source venv/bin/activate
cd backend && python manage.py runserver     # terminal 1
python manage.py run_huey                    # terminal 2
cd ../frontend && npm run dev                # terminal 3
# Acessar http://localhost:5173
```

---

## Fluxo de atualização no Windows (deploy manual)

1. `npm run build` no Ubuntu
2. Copiar `frontend/dist/` para `C:\Portal\frontend\dist\`
3. `python manage.py collectstatic --noinput`
4. Reiniciar serviços NSSM (`PortalWeb` e `PortalHuey`)

---

## Arquivos a ignorar / limpar

- `backend/os` — arquivo PostScript perdido, remover com `git rm backend/os`
- `backend/test.py` — script de debug temporário, remover com `git rm backend/test.py`

---

## Padrões que DEVEM ser seguidos

1. **Nunca criar do zero** o que já existe — verificar padrão dos módulos existentes antes de implementar qualquer coisa nova (serializers, permissões, registro de URL, estrutura de pastas no frontend)
2. **Migrations sempre** — `makemigrations` + `migrate` após qualquer alteração de modelo
3. **Huey para tasks pesadas** — nunca bloquear uma request Django com processamento longo
4. **Sem dependências novas** sem avisar — se precisar instalar algo não listado na stack, perguntar antes