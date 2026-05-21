import json
import re
import subprocess
from pathlib import Path

from django.conf import settings
from huey.contrib.djhuey import task

from common.executables import resolve_executable

# ── regexes para parsear output do yt-dlp ────────────────────────────────────

_PCT_RE   = re.compile(r'\[download\]\s+([\d.]+)%')
_SPEED_RE = re.compile(r'at\s+([\d.]+\s*\S+/s)')
_ETA_RE   = re.compile(r'ETA\s+([\d:]+)')
_DEST_RE  = re.compile(r'(?:Destination|Resuming download):\s+(.+)')
_MERGE_RE = re.compile(r'Merging formats into "(.+)"')

# ── helpers ───────────────────────────────────────────────────────────────────

def _load_config() -> dict:
    p = Path(settings.EXECUTABLES_CONFIG)
    if p.exists():
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    return {}


def _get_downloads_dir() -> Path:
    cfg = _load_config()
    dp = cfg.get('downloads_path')
    d = Path(dp) if dp else Path(settings.MEDIA_ROOT) / 'downloads'
    d.mkdir(parents=True, exist_ok=True)
    return d


def _build_cmd(yt_dlp: str, job) -> list[str]:
    dl_dir = _get_downloads_dir()
    output_tpl = str(dl_dir / '%(title)s [%(id)s].%(ext)s')

    cmd = [
        yt_dlp,
        job.url,
        '-o', output_tpl,
        '--progress',
        '--newline',
        '--no-playlist',
    ]

    if job.download_type == 'audio':
        cmd += ['--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0']
    else:
        res = job.resolution
        if res and res not in ('best', ''):
            height = res.replace('p', '')
            cmd += ['--format', f'bestvideo[height<={height}]+bestaudio/best[ext=mp4]/best']
        else:
            cmd += ['--format', 'bestvideo+bestaudio/best[ext=mp4]/best']

    if job.subtitles:
        cmd += ['--write-sub', '--write-auto-sub', '--sub-lang', 'pt,en']

    return cmd

# ── task ──────────────────────────────────────────────────────────────────────

@task()
def run_download(job_id: int) -> None:
    # Import here to avoid circular imports at module load time
    from .models import DownloadJob

    try:
        job = DownloadJob.objects.get(pk=job_id)
    except DownloadJob.DoesNotExist:
        return

    job.status = DownloadJob.Status.RUNNING
    job.save(update_fields=['status', 'updated_at'])

    try:
        yt_dlp = str(resolve_executable('yt-dlp'))
        cmd = _build_cmd(yt_dlp, job)

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        last_file_path = ''
        dirty = False  # batch small field updates

        for raw_line in iter(proc.stdout.readline, ''):
            line = raw_line.rstrip()

            # --- cancellation check (per line, low overhead) ---
            job.refresh_from_db(fields=['status'])
            if job.status == DownloadJob.Status.CANCELLED:
                proc.terminate()
                proc.wait()
                return

            # --- progress ---
            m_pct = _PCT_RE.search(line)
            if m_pct:
                job.progress = float(m_pct.group(1))
                m_spd = _SPEED_RE.search(line)
                m_eta = _ETA_RE.search(line)
                if m_spd:
                    job.speed = m_spd.group(1).strip()
                if m_eta:
                    job.eta = m_eta.group(1)
                job.save(update_fields=['progress', 'speed', 'eta', 'updated_at'])
                dirty = False
                continue

            # --- destination file ---
            m_dest = _DEST_RE.search(line)
            if m_dest:
                last_file_path = m_dest.group(1).strip().strip('"')
                dirty = True

            m_merge = _MERGE_RE.search(line)
            if m_merge:
                last_file_path = m_merge.group(1).strip()
                dirty = True

            # --- title from info line ---
            if not job.title and line.startswith('[info]') and ': Downloading' not in line:
                # e.g. "[info] <id>: Title of the video"
                pass  # title captured from destination filename below

        proc.wait()

        if proc.returncode == 0:
            # Extract title from filename if not set
            if last_file_path and not job.title:
                stem = Path(last_file_path).stem
                # Remove the " [id]" suffix yt-dlp appends
                job.title = re.sub(r'\s*\[[A-Za-z0-9_-]+\]$', '', stem)[:500]

            job.status   = DownloadJob.Status.DONE
            job.progress = 100.0
            job.speed    = ''
            job.eta      = ''
            job.file_path = last_file_path
            if last_file_path:
                p = Path(last_file_path)
                job.file_size = p.stat().st_size if p.exists() else None
            job.save()
        else:
            job.status    = DownloadJob.Status.ERROR
            job.error_msg = f'yt-dlp saiu com código {proc.returncode}'
            job.save()

    except FileNotFoundError as exc:
        job.status    = DownloadJob.Status.ERROR
        job.error_msg = str(exc)
        job.save()
    except Exception as exc:
        job.status    = DownloadJob.Status.ERROR
        job.error_msg = str(exc)[:1000]
        job.save()
