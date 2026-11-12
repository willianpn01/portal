from pathlib import Path

from django.conf import settings

COVER_EXTS = (".png", ".jpg", ".jpeg", ".webp")


def local_cover(rom):
    """Capa local (ROM_COVERS_DIR/<slug>/<stem>.<ext>) ou None."""
    base = Path(settings.ROM_COVERS_DIR) / rom.platform.slug
    stem = Path(rom.file_path).stem
    for ext in COVER_EXTS:
        p = base / (stem + ext)
        if p.is_file():
            return p
    return None


def resolve_cover(rom):
    """Capa local tem prioridade; fallback para a do TheGamesDB (cover_path)."""
    local = local_cover(rom)
    if local:
        return local
    if rom.cover_path:
        p = Path(rom.cover_path)
        if p.is_file():
            return p
    return None
