import json
import re
import urllib.request
from pathlib import Path

from django.conf import settings
from huey.contrib.djhuey import task

from .models import PLATFORM_EXTENSIONS, Platform, ROM, ScanJob
from .thegamesdb import fetch_rom_metadata


@task()
def run_rescrape() -> None:
    try:
        with open(settings.EXECUTABLES_CONFIG, encoding='utf-8') as f:
            config = json.load(f)
    except Exception:
        config = {}

    api_key = config.get('thegamesdb_api_key')
    if not api_key:
        return

    roms = ROM.objects.filter(thegamesdb_id__isnull=True).select_related('platform')
    for rom in roms:
        slug  = rom.platform.slug
        clean = re.sub(r'\s*[\(\[][^\)\]]*[\)\]]', '', Path(rom.file_path).stem).strip()
        metadata = fetch_rom_metadata(rom_title=clean, platform_slug=slug, api_key=api_key)
        if not metadata:
            continue
        update_fields = []
        for field in ('title', 'description', 'genre', 'year', 'players', 'region'):
            val = metadata.get(field)
            if val is not None:
                setattr(rom, field, val)
                update_fields.append(field)
        rom.thegamesdb_id = metadata['thegamesdb_id']
        update_fields.append('thegamesdb_id')
        cover_url = metadata.get('cover_url')
        if cover_url and not rom.cover_path:
            local = _download_cover(cover_url, slug, Path(rom.file_path).stem)
            if local:
                rom.cover_path = str(local)
                update_fields.append('cover_path')
        if update_fields:
            rom.save(update_fields=update_fields)


def _load_config() -> dict:
    try:
        with open(settings.EXECUTABLES_CONFIG, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def _download_cover(cover_url: str, platform_slug: str, stem: str) -> Path | None:
    try:
        covers_dir = Path(settings.MEDIA_ROOT) / 'covers' / platform_slug
        covers_dir.mkdir(parents=True, exist_ok=True)
        ext  = Path(cover_url.split('?')[0]).suffix or '.jpg'
        dest = covers_dir / f'{stem}{ext}'
        req  = urllib.request.Request(cover_url, headers={'User-Agent': 'Portal/1.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            dest.write_bytes(resp.read())
        return dest
    except Exception:
        return None


def _clean_title(stem: str) -> str:
    """Remove region tags like (USA), (E), [!] from ROM filename stem."""
    return re.sub(r'\s*[\(\[][^\)\]]*[\)\]]', '', stem).strip()


@task()
def run_scan(job_id: int) -> None:
    try:
        job = ScanJob.objects.get(pk=job_id)
    except ScanJob.DoesNotExist:
        return

    job.status = ScanJob.Status.RUNNING
    job.save(update_fields=['status', 'updated_at'])

    # Ensure all default platforms exist
    for slug, name, core in Platform.PLATFORMS:
        Platform.objects.get_or_create(slug=slug, defaults={'name': name, 'emulatorjs_core': core})

    # Build extension → slug lookup
    ext_to_slug: dict[str, str] = {}
    for slug, exts in PLATFORM_EXTENSIONS.items():
        for ext in exts:
            ext_to_slug[ext] = slug

    config  = _load_config()
    api_key = config.get('thegamesdb_api_key')

    roms_path   = Path(job.roms_path)
    total_found = 0
    total_new   = 0

    try:
        for file_path in roms_path.rglob('*'):
            if not file_path.is_file():
                continue
            ext = file_path.suffix.lower()
            if ext not in ext_to_slug:
                continue

            total_found += 1
            job.current_file = file_path.name
            job.total_found  = total_found
            job.save(update_fields=['current_file', 'total_found', 'updated_at'])

            if ROM.objects.filter(file_path=str(file_path)).exists():
                continue

            slug     = ext_to_slug[ext]
            platform = Platform.objects.get(slug=slug)

            rom_kwargs: dict = {
                'platform':  platform,
                'title':     file_path.stem,
                'file_path': str(file_path),
                'file_size': file_path.stat().st_size,
            }

            if api_key:
                clean = _clean_title(file_path.stem)
                metadata = fetch_rom_metadata(
                    rom_title=clean,
                    platform_slug=slug,
                    api_key=api_key,
                )
                if metadata:
                    rom_kwargs.update({
                        'title':         metadata.get('title') or file_path.stem,
                        'description':   metadata.get('description', ''),
                        'genre':         metadata.get('genre', ''),
                        'year':          metadata.get('year'),
                        'players':       metadata.get('players', 1),
                        'region':        metadata.get('region', ''),
                        'thegamesdb_id': metadata.get('thegamesdb_id'),
                    })
                    cover_url = metadata.get('cover_url')
                    if cover_url:
                        local = _download_cover(cover_url, slug, file_path.stem)
                        if local:
                            rom_kwargs['cover_path'] = str(local)

            ROM.objects.create(**rom_kwargs)
            total_new += 1
            job.total_new = total_new
            job.save(update_fields=['total_new', 'updated_at'])

        job.status      = ScanJob.Status.DONE
        job.total_found = total_found
        job.total_new   = total_new
        job.save()

    except Exception as exc:
        job.status    = ScanJob.Status.ERROR
        job.error_msg = str(exc)[:2000]
        job.save()
