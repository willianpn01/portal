import json
import re
import subprocess
from pathlib import Path

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.executables import resolve_executable
from .models import DownloadJob
from .serializers import DownloadJobSerializer
from .tasks import run_download

_URL_RE = re.compile(r'^https?://', re.IGNORECASE)


def _load_config() -> dict:
    p = Path(settings.EXECUTABLES_CONFIG)
    if p.exists():
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    return {}


# ── list / create ─────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def job_list_create(request):
    if request.method == 'GET':
        jobs = DownloadJob.objects.filter(user=request.user)
        return Response(DownloadJobSerializer(jobs, many=True).data)

    # POST — create
    url = (request.data.get('url') or '').strip()
    if not _URL_RE.match(url):
        return Response(
            {'detail': 'URL inválida. Use http:// ou https://'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    job = DownloadJob.objects.create(
        user          = request.user,
        url           = url,
        title         = (request.data.get('title') or '').strip(),
        download_type = request.data.get('download_type', 'video'),
        resolution    = request.data.get('resolution', 'best'),
        subtitles     = bool(request.data.get('subtitles', False)),
    )

    run_download(job.id)   # enqueue — retorna imediatamente
    return Response(DownloadJobSerializer(job).data, status=status.HTTP_201_CREATED)


# ── detail / cancel ───────────────────────────────────────────────────────────

@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def job_detail(request, pk):
    try:
        job = DownloadJob.objects.get(pk=pk, user=request.user)
    except DownloadJob.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(DownloadJobSerializer(job).data)

    # DELETE
    if job.status == DownloadJob.Status.RUNNING:
        job.status = DownloadJob.Status.CANCELLED
        job.save(update_fields=['status', 'updated_at'])
        return Response({'detail': 'Cancelamento solicitado.'})

    job.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── info helpers ──────────────────────────────────────────────────────────────

def _fetch_info(url: str) -> dict:
    yt_dlp = str(resolve_executable('yt-dlp'))
    result = subprocess.run(
        [yt_dlp, '--dump-json', '--no-playlist', url],
        capture_output=True,
        text=True,
        timeout=20,
    )
    if result.returncode != 0:
        raise ValueError(result.stderr.strip() or 'yt-dlp retornou erro.')

    info = json.loads(result.stdout)

    formats = info.get('formats', [])
    heights = sorted(
        {f['height'] for f in formats if f.get('height') and f.get('vcodec') not in (None, 'none')},
        reverse=True,
    )
    resolutions = [f'{h}p' for h in heights]

    duration_s = int(info.get('duration') or 0)
    m, s = divmod(duration_s, 60)
    h, m = divmod(m, 60)
    duration_fmt = f'{h}:{m:02d}:{s:02d}' if h else f'{m}:{s:02d}'

    return {
        'title':        info.get('title', ''),
        'thumbnail':    info.get('thumbnail', ''),
        'duration':     duration_s,
        'duration_fmt': duration_fmt,
        'uploader':     info.get('uploader', ''),
        'resolutions':  resolutions,
        'webpage_url':  info.get('webpage_url', url),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def url_info(request):
    """GET /api/downloads/info/?url=<url>"""
    url = (request.query_params.get('url') or '').strip()
    if not _URL_RE.match(url):
        return Response({'detail': 'URL inválida.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        return Response(_fetch_info(url))
    except subprocess.TimeoutExpired:
        return Response(
            {'detail': 'Tempo esgotado ao buscar informações (>20s).'},
            status=status.HTTP_408_REQUEST_TIMEOUT,
        )
    except (ValueError, json.JSONDecodeError) as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except FileNotFoundError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def job_info(request, pk):
    """GET /api/downloads/<id>/info/"""
    try:
        job = DownloadJob.objects.get(pk=pk, user=request.user)
    except DownloadJob.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    try:
        return Response(_fetch_info(job.url))
    except subprocess.TimeoutExpired:
        return Response({'detail': 'Tempo esgotado.'}, status=status.HTTP_408_REQUEST_TIMEOUT)
    except (ValueError, json.JSONDecodeError) as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except FileNotFoundError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
