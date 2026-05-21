import shutil
import platform
import json
from pathlib import Path

from django.conf import settings


def _load_config() -> dict:
    config_path: Path = settings.EXECUTABLES_CONFIG
    if config_path.exists():
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def resolve_executable(name: str, config_path: str | None = None) -> Path:
    if config_path:
        return Path(config_path)
    config = _load_config()
    key = f'{name}_path'
    if config.get(key):
        return Path(config[key])
    found = shutil.which(name)
    if found:
        return Path(found)
    if platform.system() == 'Windows':
        local = Path('C:/Portal/tools') / f'{name}.exe'
        if local.exists():
            return local
        if name == 'soffice':
            lo = Path('C:/Program Files/LibreOffice/program/soffice.exe')
            if lo.exists():
                return lo
    raise FileNotFoundError(f'{name} não encontrado. Configure em Configurações.')


def safe_path(base: Path, user_input: str) -> Path:
    base_resolved = base.resolve()
    resolved = (base_resolved / user_input).resolve()
    # Use relative_to instead of startswith to avoid false positives with
    # paths that share a common prefix (e.g. /home/user_ext vs /home/user).
    try:
        resolved.relative_to(base_resolved)
    except ValueError:
        raise PermissionError('Acesso negado.')
    return resolved
