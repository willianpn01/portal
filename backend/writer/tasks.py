import os
import subprocess
import uuid
from pathlib import Path

from bs4 import BeautifulSoup
from django.conf import settings
from django.utils import timezone
from huey.contrib.djhuey import task

from common.executables import resolve_executable

_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
body {{ font-family: Georgia, serif; margin: 3cm; font-size: 12pt; line-height: 1.6; }}
h1,h2,h3 {{ font-family: Arial, sans-serif; }}
p {{ margin-bottom: 0.8em; text-align: justify; }}
</style></head><body>
<h1>{title}</h1>
{content}
</body></html>"""


@task()
def export_chapter_to_docx(chapter_id: int, task_id: str) -> None:
    # Import inside task body to avoid circular imports at module load time
    from .models import Chapter

    try:
        chapter = Chapter.objects.get(pk=chapter_id)
    except Chapter.DoesNotExist:
        return

    # Mark as running
    chapter.meta['last_export_task'] = {
        'task_id': task_id,
        'status': 'running',
        'url': None,
        'error': None,
    }
    chapter.save(update_fields=['meta'])

    export_dir = Path(settings.MEDIA_ROOT) / 'exports' / 'writer'
    export_dir.mkdir(parents=True, exist_ok=True)

    # Write temp HTML file
    temp_name = f'chapter_{chapter_id}_{uuid.uuid4().hex}.html'
    temp_html = export_dir / temp_name

    # Strip author-notes before export — they are editor-only annotations
    soup = BeautifulSoup(chapter.html_content, 'html.parser')
    for nota in soup.find_all(class_='author-note'):
        nota.decompose()

    # <mark> → <span>: LibreOffice doesn't recognise <mark> natively; renaming
    # preserves all child nodes and inline styles (unlike get_text()).
    for mark in soup.find_all('mark'):
        mark.name = 'span'

    # Promote text-align to inline on every <p>.
    # LibreOffice ignores the <style> block rule when the same element contains
    # inline-styled children, causing paragraphs to revert to left/center.
    for p in soup.find_all('p'):
        existing = p.get('style', '')
        if 'text-align' not in existing:
            p['style'] = (existing.rstrip(';') + ';text-align:justify').lstrip(';')

    content_sem_notas = str(soup)

    html_content = _HTML_TEMPLATE.format(
        title=chapter.title,
        content=content_sem_notas,
    )

    try:
        temp_html.write_text(html_content, encoding="utf-8")

        soffice = str(resolve_executable('soffice'))

        env = os.environ.copy()
        env['HOME'] = str(Path.home())
        env.setdefault('DISPLAY', ':0')

        result = subprocess.run(
            [
                soffice,
                '--headless',
                '--convert-to', 'docx:MS Word 2007 XML',
                '--outdir', str(export_dir),
                str(temp_html),
            ],
            capture_output=True,
            text=True,
            timeout=120,
            env=env,
        )

        # Delete temp HTML after conversion attempt
        temp_html.unlink(missing_ok=True)

        if result.returncode != 0:
            raise RuntimeError(
                f'soffice saiu com código {result.returncode}: {result.stderr[:500]}'
            )

        # LibreOffice names the output after the input stem
        stem = Path(temp_name).stem
        docx_path = export_dir / f'{stem}.docx'

        if not docx_path.is_file():
            raise FileNotFoundError(f'Arquivo .docx não encontrado após conversão: {docx_path}')

        url = f'/media/exports/writer/{docx_path.name}'

        chapter.last_export = timezone.now()
        chapter.meta['last_export_task'] = {
            'task_id': task_id,
            'status': 'done',
            'url': url,
            'error': None,
        }
        chapter.save(update_fields=['last_export', 'meta'])

    except Exception as exc:
        # Cleanup temp file if still present
        if temp_html.exists():
            temp_html.unlink(missing_ok=True)

        chapter.meta['last_export_task'] = {
            'task_id': task_id,
            'status': 'error',
            'url': None,
            'error': str(exc)[:500],
        }
        chapter.save(update_fields=['meta'])
