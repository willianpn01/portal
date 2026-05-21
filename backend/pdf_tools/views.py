from datetime import datetime
from pathlib import Path

import fitz
from django.conf import settings
from django.http import FileResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.executables import safe_path
from .image_operations import SUPPORTED_INPUT as IMG_EXTENSIONS, get_image_info
from .models import PDFJob
from .operations import execute_job
from .serializers import PDFJobSerializer
from .tasks import run_pdf_job

# ── constants ─────────────────────────────────────────────────────────────────

ALWAYS_ASYNC = {
    'ocr_image', 'ocr_pdf', 'compress', 'pdf_to_docx', 'pdf_to_docx_ocr', 'docx_to_pdf',
    'img_convert', 'img_crop', 'img_resize',
}
SIZE_THRESHOLD = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS = {
    '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif',
    '.docx', '.doc',
}

# ── helpers ───────────────────────────────────────────────────────────────────

def get_workspace(user_id: int) -> Path:
    d = Path(settings.MEDIA_ROOT) / 'pdf_workspace' / str(user_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _page_count(path: Path) -> int | None:
    if path.suffix.lower() != '.pdf':
        return None
    try:
        with fitz.open(path) as doc:
            return len(doc)
    except Exception:
        return None


def _file_info(path: Path) -> dict:
    stat = path.stat()
    ext  = path.suffix.lower()
    dimensions = None
    if ext in IMG_EXTENSIONS:
        try:
            info = get_image_info(path)
            dimensions = f"{info['width']}x{info['height']}"
        except Exception:
            pass
    return {
        'filename':   path.name,
        'size_bytes': stat.st_size,
        'pages':      _page_count(path),
        'dimensions': dimensions,
        'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat(timespec='seconds'),
        'extension':  ext.lstrip('.'),
    }


def _total_size(workspace: Path, filenames: list) -> int:
    total = 0
    for fn in filenames:
        try:
            p = safe_path(workspace, fn)
            total += p.stat().st_size
        except (PermissionError, FileNotFoundError, OSError):
            pass
    return total


def _should_run_async(operation: str, workspace: Path, input_files: list) -> bool:
    if operation in ALWAYS_ASYNC:
        return True
    return _total_size(workspace, input_files) >= SIZE_THRESHOLD

# ── workspace endpoints ───────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_file(request):
    uploaded = request.FILES.get('file')
    if not uploaded:
        return Response({'detail': 'Nenhum arquivo enviado.'}, status=status.HTTP_400_BAD_REQUEST)

    ext = Path(uploaded.name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return Response(
            {'detail': f'Extensão não permitida: {ext}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    workspace = get_workspace(request.user.id)
    dest = workspace / uploaded.name

    with open(dest, 'wb') as f:
        for chunk in uploaded.chunks():
            f.write(chunk)

    return Response(_file_info(dest), status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_workspace(request):
    workspace = get_workspace(request.user.id)
    files = []
    for p in sorted(workspace.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if p.is_file() and p.suffix.lower() in ALLOWED_EXTENSIONS:
            files.append(_file_info(p))
    return Response(files)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_workspace_file(request, filename):
    workspace = get_workspace(request.user.id)
    try:
        target = safe_path(workspace, filename)
    except PermissionError:
        return Response({'detail': 'Acesso negado.'}, status=status.HTTP_403_FORBIDDEN)

    if not target.exists():
        return Response({'detail': 'Arquivo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    target.unlink()
    return Response(status=status.HTTP_204_NO_CONTENT)

# ── job endpoints ─────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def job_list_create(request):
    if request.method == 'GET':
        jobs = PDFJob.objects.filter(user=request.user)
        return Response(PDFJobSerializer(jobs, many=True).data)

    # POST — create job
    operation   = request.data.get('operation', '')
    input_files = request.data.get('input_files', [])
    params      = request.data.get('params', {})

    valid_ops = {c[0] for c in PDFJob.Operation.choices}
    if operation not in valid_ops:
        return Response({'detail': f'Operação inválida: {operation}'}, status=status.HTTP_400_BAD_REQUEST)

    if not input_files:
        return Response({'detail': 'input_files é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)

    workspace = get_workspace(request.user.id)

    # Validate all input files are within the user's workspace
    for fn in input_files:
        try:
            p = safe_path(workspace, fn)
        except PermissionError:
            return Response({'detail': f'Path inválido: {fn}'}, status=status.HTTP_403_FORBIDDEN)
        if not p.exists():
            return Response({'detail': f'Arquivo não encontrado: {fn}'}, status=status.HTTP_400_BAD_REQUEST)

    job = PDFJob.objects.create(
        user=request.user,
        operation=operation,
        input_files=input_files,
        params=params,
    )

    use_async = _should_run_async(operation, workspace, input_files)

    if use_async:
        run_pdf_job(job.id)
        return Response(PDFJobSerializer(job).data, status=status.HTTP_201_CREATED)

    # Synchronous execution
    job.status = PDFJob.Status.RUNNING
    job.save(update_fields=['status', 'updated_at'])
    try:
        output_filename = execute_job(job, workspace)
        job.status = PDFJob.Status.DONE
        job.output_file = output_filename
        job.save()
    except Exception as exc:
        job.status = PDFJob.Status.ERROR
        job.error_msg = str(exc)[:1000]
        job.save()

    return Response(PDFJobSerializer(job).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def job_detail(request, pk):
    try:
        job = PDFJob.objects.get(pk=pk, user=request.user)
    except PDFJob.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(PDFJobSerializer(job).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_output(request, pk):
    try:
        job = PDFJob.objects.get(pk=pk, user=request.user)
    except PDFJob.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    if job.status != PDFJob.Status.DONE or not job.output_file:
        return Response({'detail': 'Output não disponível.'}, status=status.HTTP_400_BAD_REQUEST)

    workspace = get_workspace(request.user.id)
    try:
        out_path = safe_path(workspace, job.output_file)
    except PermissionError:
        return Response({'detail': 'Acesso negado.'}, status=status.HTTP_403_FORBIDDEN)

    if not out_path.is_file():
        return Response({'detail': 'Arquivo de output não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    return FileResponse(open(out_path, 'rb'), as_attachment=True, filename=out_path.name)
