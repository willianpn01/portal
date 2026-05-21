import shutil
import zipfile
from datetime import datetime
from pathlib import Path

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.executables import safe_path
from .models import FileManagerRoot, OperationLog
from .serializers import FileManagerRootSerializer

# ── constants ─────────────────────────────────────────────────────────────────

TEXT_EXTENSIONS = {
    '.txt', '.md', '.json', '.csv', '.log', '.xml', '.html', '.css',
    '.js', '.ts', '.py', '.yaml', '.yml', '.ini', '.cfg', '.toml',
    '.sh', '.bat', '.sql', '.env',
}
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'}
PREVIEW_MAX_BYTES = 100 * 1024  # 100 KB

# ── helpers ───────────────────────────────────────────────────────────────────

def _get_root(root_id) -> FileManagerRoot:
    return get_object_or_404(FileManagerRoot, pk=root_id, is_active=True)


def _resolve(root: FileManagerRoot, relative_path: str) -> Path:
    try:
        return safe_path(Path(root.path), relative_path or '')
    except PermissionError:
        return None


def _item_dict(p: Path) -> dict:
    try:
        stat = p.stat()
    except OSError:
        return None
    item = {
        'name': p.name,
        'type': 'directory' if p.is_dir() else 'file',
        'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat(timespec='seconds'),
    }
    if p.is_file():
        item['size_bytes'] = stat.st_size
        item['extension'] = p.suffix.lstrip('.').lower()
    return item


def _parent_path(relative_path: str) -> str | None:
    if not relative_path:
        return None
    parent = Path(relative_path).parent
    return '' if str(parent) == '.' else str(parent)


def _log(user, operation: str, path: str, destination: str = '') -> None:
    OperationLog.objects.create(
        user=user,
        operation=operation,
        path=path,
        destination=destination,
    )

# ── views ─────────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def list_roots(request):
    if request.method == 'POST':
        label = request.data.get('label', '').strip()
        path  = request.data.get('path', '').strip()
        if not label or not path:
            return Response({'detail': 'label e path são obrigatórios.'}, status=status.HTTP_400_BAD_REQUEST)
        p = Path(path)
        if not p.exists():
            return Response({'detail': f'Caminho não encontrado: {path}'}, status=status.HTTP_400_BAD_REQUEST)
        if not p.is_dir():
            return Response({'detail': 'O caminho deve ser um diretório.'}, status=status.HTTP_400_BAD_REQUEST)
        root = FileManagerRoot.objects.create(label=label, path=str(p.resolve()))
        return Response(FileManagerRootSerializer(root).data, status=status.HTTP_201_CREATED)

    roots = FileManagerRoot.objects.all()
    return Response(FileManagerRootSerializer(roots, many=True).data)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_root(request, pk):
    root = get_object_or_404(FileManagerRoot, pk=pk)

    if request.method == 'DELETE':
        root.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if 'is_active' in request.data:
        root.is_active = bool(request.data['is_active'])
        root.save(update_fields=['is_active'])
    return Response(FileManagerRootSerializer(root).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_directory(request):
    root_id = request.query_params.get('root')
    relative_path = request.query_params.get('path', '')

    root = _get_root(root_id)
    target = _resolve(root, relative_path)
    if target is None:
        return Response({'detail': 'Acesso negado.'}, status=status.HTTP_403_FORBIDDEN)

    if not target.exists():
        return Response({'detail': 'Diretório não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    if not target.is_dir():
        return Response({'detail': 'Não é um diretório.'}, status=status.HTTP_400_BAD_REQUEST)

    items = []
    try:
        entries = sorted(target.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
        for p in entries:
            d = _item_dict(p)
            if d is not None:
                items.append(d)
    except PermissionError:
        return Response({'detail': 'Permissão negada.'}, status=status.HTTP_403_FORBIDDEN)

    return Response({
        'current_path': relative_path,
        'parent_path': _parent_path(relative_path),
        'items': items,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_file(request):
    root_id = request.query_params.get('root')
    relative_path = request.query_params.get('path', '')

    root = _get_root(root_id)
    target = _resolve(root, relative_path)
    if target is None:
        return Response({'detail': 'Acesso negado.'}, status=status.HTTP_403_FORBIDDEN)

    if not target.is_file():
        return Response({'detail': 'Não é um arquivo.'}, status=status.HTTP_400_BAD_REQUEST)

    return FileResponse(
        open(target, 'rb'),
        as_attachment=True,
        filename=target.name,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_file(request):
    root_id = request.data.get('root')
    relative_path = request.data.get('path', '')
    uploaded = request.FILES.get('file')

    if not uploaded:
        return Response({'detail': 'Nenhum arquivo enviado.'}, status=status.HTTP_400_BAD_REQUEST)

    root = _get_root(root_id)
    dest_dir = _resolve(root, relative_path)
    if dest_dir is None:
        return Response({'detail': 'Acesso negado.'}, status=status.HTTP_403_FORBIDDEN)

    if not dest_dir.is_dir():
        return Response({'detail': 'Destino não é um diretório.'}, status=status.HTTP_400_BAD_REQUEST)

    dest_file = dest_dir / uploaded.name
    with open(dest_file, 'wb') as f:
        for chunk in uploaded.chunks():
            f.write(chunk)

    return Response({'saved': uploaded.name}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def file_operation(request):
    operation = request.data.get('operation')
    root_id = request.data.get('root')
    rel_path = request.data.get('path', '')
    new_rel_path = request.data.get('new_path', '')

    VALID_OPS = {'rename', 'move', 'copy', 'delete', 'mkdir'}
    if operation not in VALID_OPS:
        return Response({'detail': f'Operação inválida: {operation}'}, status=status.HTTP_400_BAD_REQUEST)

    root = _get_root(root_id)
    source = _resolve(root, rel_path)
    if source is None:
        return Response({'detail': 'Acesso negado (origem).'}, status=status.HTTP_403_FORBIDDEN)

    if operation == 'mkdir':
        try:
            source.mkdir(parents=False, exist_ok=False)
        except FileExistsError:
            return Response({'detail': 'Diretório já existe.'}, status=status.HTTP_409_CONFLICT)
        return Response({'created': rel_path}, status=status.HTTP_201_CREATED)

    if operation == 'delete':
        if not source.exists():
            return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        _log(request.user, 'delete', rel_path)
        if source.is_dir():
            shutil.rmtree(source)
        else:
            source.unlink()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # rename / move / copy — need destination
    dest = _resolve(root, new_rel_path)
    if dest is None:
        return Response({'detail': 'Acesso negado (destino).'}, status=status.HTTP_403_FORBIDDEN)

    if not source.exists():
        return Response({'detail': 'Origem não encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    if operation == 'rename':
        source.rename(dest)
        return Response({'renamed_to': new_rel_path})

    if operation == 'move':
        _log(request.user, 'move', rel_path, new_rel_path)
        shutil.move(str(source), str(dest))
        return Response({'moved_to': new_rel_path})

    if operation == 'copy':
        if source.is_dir():
            shutil.copytree(source, dest)
        else:
            shutil.copy2(source, dest)
        return Response({'copied_to': new_rel_path})

    return Response({'detail': 'Operação não implementada.'}, status=status.HTTP_501_NOT_IMPLEMENTED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def zip_files(request):
    root_id = request.data.get('root')
    paths = request.data.get('paths', [])
    destination = request.data.get('destination', '')

    if not paths or not destination:
        return Response({'detail': 'paths e destination são obrigatórios.'}, status=status.HTTP_400_BAD_REQUEST)

    root = _get_root(root_id)
    zip_path = _resolve(root, destination)
    if zip_path is None:
        return Response({'detail': 'Acesso negado (destino).'}, status=status.HTTP_403_FORBIDDEN)

    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for rel in paths:
                p = _resolve(root, rel)
                if p is None:
                    continue
                if p.is_file():
                    zf.write(p, p.name)
                elif p.is_dir():
                    for fp in p.rglob('*'):
                        if fp.is_file():
                            zf.write(fp, fp.relative_to(p.parent))
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'created': destination}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unzip_file(request):
    root_id = request.data.get('root')
    rel_path = request.data.get('path', '')
    destination = request.data.get('destination', '')

    root = _get_root(root_id)
    zip_path = _resolve(root, rel_path)
    if zip_path is None:
        return Response({'detail': 'Acesso negado (origem).'}, status=status.HTTP_403_FORBIDDEN)

    dest_path = _resolve(root, destination) if destination else zip_path.parent
    if dest_path is None:
        return Response({'detail': 'Acesso negado (destino).'}, status=status.HTTP_403_FORBIDDEN)

    if not zip_path.is_file():
        return Response({'detail': 'Arquivo zip não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        dest_path.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(dest_path)
    except zipfile.BadZipFile:
        return Response({'detail': 'Arquivo zip inválido.'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'extracted_to': destination or str(zip_path.parent.relative_to(Path(root.path)))})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def preview_file(request):
    root_id = request.query_params.get('root')
    relative_path = request.query_params.get('path', '')

    root = _get_root(root_id)
    target = _resolve(root, relative_path)
    if target is None:
        return Response({'detail': 'Acesso negado.'}, status=status.HTTP_403_FORBIDDEN)

    if not target.is_file():
        return Response({'detail': 'Não é um arquivo.'}, status=status.HTTP_400_BAD_REQUEST)

    ext = target.suffix.lower()
    download_url = f'/api/files/download/?root={root_id}&path={relative_path}'

    if ext in TEXT_EXTENSIONS:
        if target.stat().st_size > PREVIEW_MAX_BYTES:
            return Response({'preview': None, 'reason': 'file_too_large', 'type': 'text'})
        content = target.read_text(encoding='utf-8', errors='replace')
        return Response({'preview': content, 'type': 'text'})

    if ext in IMAGE_EXTENSIONS:
        return Response({'preview': None, 'type': 'image', 'download_url': download_url})

    if ext == '.pdf':
        return Response({'preview': None, 'type': 'pdf', 'download_url': download_url})

    return Response({'preview': None, 'reason': 'unsupported', 'type': 'other'})
