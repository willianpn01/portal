import json
from pathlib import Path

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

_CONFIG_PATH = Path(__file__).resolve().parent.parent / 'config' / 'executables.json'

_SENSITIVE = {
    'thegamesdb_api_key',
    'weather_api_key',
}


def _read_config() -> dict:
    try:
        return json.loads(_CONFIG_PATH.read_text(encoding='utf-8'))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _write_config(data: dict) -> None:
    _CONFIG_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding='utf-8',
    )


def _mask(config: dict) -> dict:
    out = {}
    for k, v in config.items():
        if k in _SENSITIVE and v:
            out[k] = '********'
        else:
            out[k] = v
    return out


@api_view(['GET', 'PUT'])
@permission_classes([IsAdminUser])
def settings_view(request):
    if request.method == 'GET':
        return Response(_mask(_read_config()))

    config = _read_config()
    for key, value in request.data.items():
        if key not in config and key not in _SENSITIVE:
            continue
        if key in _SENSITIVE and value == '********':
            continue
        config[key] = value if value != '' else None

    _write_config(config)
    return Response(_mask(config))


# ── File Manager roots (alias under /api/settings/file-roots/) ────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def file_roots_list(request):
    from file_manager.models import FileManagerRoot
    from file_manager.serializers import FileManagerRootSerializer

    if request.method == 'POST':
        label = request.data.get('label', '').strip()
        path  = request.data.get('path', '').strip()
        p = Path(path)
        if not p.exists():
            return Response({'detail': f'Caminho não encontrado: {path}'}, status=status.HTTP_400_BAD_REQUEST)
        if not p.is_dir():
            return Response({'detail': 'O caminho deve ser um diretório.'}, status=status.HTTP_400_BAD_REQUEST)
        root = FileManagerRoot.objects.create(label=label, path=str(p.resolve()))
        return Response(FileManagerRootSerializer(root).data, status=status.HTTP_201_CREATED)

    roots = FileManagerRoot.objects.all()
    from file_manager.serializers import FileManagerRootSerializer
    return Response(FileManagerRootSerializer(roots, many=True).data)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def file_root_detail(request, pk):
    from file_manager.models import FileManagerRoot
    from file_manager.serializers import FileManagerRootSerializer

    root = get_object_or_404(FileManagerRoot, pk=pk)
    if request.method == 'DELETE':
        root.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if 'is_active' in request.data:
        root.is_active = bool(request.data['is_active'])
        root.save(update_fields=['is_active'])
    return Response(FileManagerRootSerializer(root).data)
