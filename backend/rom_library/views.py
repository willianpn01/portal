import mimetypes
from pathlib import Path

from django.conf import settings
from django.db.models import Count
from django.http import FileResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Platform, ROM, SaveState, ScanJob
from .serializers import PlatformSerializer, ROMSerializer, ScanJobSerializer
from .tasks import run_rescrape, run_scan

PAGE_SIZE = 50

# ── scan ──────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def scan_start(request):
    roms_path = request.data.get('roms_path', '').strip()
    if not roms_path:
        return Response({'detail': 'roms_path é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)
    path = Path(roms_path)
    if not path.is_dir():
        return Response({'detail': 'Diretório não encontrado.'}, status=status.HTTP_400_BAD_REQUEST)

    job = ScanJob.objects.create(roms_path=str(path))
    run_scan(job.id)
    return Response(ScanJobSerializer(job).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rescrape(request):
    total = ROM.objects.filter(thegamesdb_id__isnull=True).count()
    run_rescrape()
    return Response({'status': 'started', 'total': total}, status=status.HTTP_202_ACCEPTED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def scan_detail(request, pk):
    try:
        job = ScanJob.objects.get(pk=pk)
    except ScanJob.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(ScanJobSerializer(job).data)

# ── platforms ─────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def platform_list(request):
    platforms = Platform.objects.annotate(rom_count=Count('roms'))
    return Response(PlatformSerializer(platforms, many=True).data)

# ── roms ──────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def rom_list(request):
    qs = ROM.objects.select_related('platform').all()

    platform = request.query_params.get('platform', '').strip()
    if platform:
        qs = qs.filter(platform__slug=platform)

    search = request.query_params.get('search', '').strip()
    if search:
        qs = qs.filter(title__icontains=search)

    if request.query_params.get('favorites') in ('1', 'true'):
        qs = qs.filter(is_favorite=True)

    tag = request.query_params.get('tag', '').strip()
    if tag:
        qs = qs.filter(tags__contains=[tag])

    ordering = request.query_params.get('ordering', 'title')
    if ordering not in ('title', '-title', '-last_played', '-play_count', '-created_at'):
        ordering = 'title'
    qs = qs.order_by(ordering)

    try:
        page = max(1, int(request.query_params.get('page', 1)))
    except (ValueError, TypeError):
        page = 1

    start = (page - 1) * PAGE_SIZE
    end = start + PAGE_SIZE
    total = qs.count()

    return Response({
        'count':     total,
        'page':      page,
        'page_size': PAGE_SIZE,
        'has_next':  end < total,
        'results':   ROMSerializer(qs[start:end], many=True, context={'request': request}).data,
    })


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def rom_detail(request, pk):
    try:
        rom = ROM.objects.select_related('platform').get(pk=pk)
    except ROM.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'PATCH':
        fields_updated = []
        for field in ('is_favorite', 'tags'):
            if field in request.data:
                setattr(rom, field, request.data[field])
                fields_updated.append(field)
        if fields_updated:
            rom.save(update_fields=fields_updated)
        return Response(ROMSerializer(rom, context={'request': request}).data)

    return Response(ROMSerializer(rom, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rom_play(request, pk):
    try:
        rom = ROM.objects.select_related('platform').get(pk=pk)
    except ROM.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    rom.last_played = timezone.now()
    rom.play_count += 1
    rom.save(update_fields=['last_played', 'play_count'])
    return Response(ROMSerializer(rom, context={'request': request}).data)


@api_view(['GET', 'HEAD'])
@permission_classes([AllowAny])
def rom_file(request, pk):
    try:
        rom = ROM.objects.get(pk=pk)
    except ROM.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    path = Path(rom.file_path)
    if not path.is_file():
        return Response({'detail': 'Arquivo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    file_size = path.stat().st_size

    if request.method == 'HEAD':
        from django.http import HttpResponse
        resp = HttpResponse()
        resp['Content-Length'] = file_size
        resp['Content-Type']   = 'application/octet-stream'
        resp['Accept-Ranges']  = 'bytes'
        return resp

    resp = FileResponse(open(path, 'rb'), content_type='application/octet-stream')
    resp['Content-Length']      = file_size
    resp['Content-Disposition'] = f'inline; filename="{path.name}"'
    resp['Accept-Ranges']       = 'bytes'
    resp['Content-Encoding']    = 'identity'
    return resp


@api_view(['GET'])
@permission_classes([AllowAny])
def rom_cover(request, pk):
    try:
        rom = ROM.objects.get(pk=pk)
    except ROM.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    if not rom.cover_path:
        return Response({'detail': 'Sem capa.'}, status=status.HTTP_404_NOT_FOUND)
    path = Path(rom.cover_path)
    if not path.is_file():
        return Response({'detail': 'Arquivo de capa não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    mime, _ = mimetypes.guess_type(str(path))
    return FileResponse(open(path, 'rb'), content_type=mime or 'image/jpeg')


# ── save states ───────────────────────────────────────────────────────────────

def _savestate_dir(rom_id: int, slot: int) -> Path:
    return Path(settings.MEDIA_ROOT) / 'savestates' / str(rom_id) / f'slot_{slot}'


def _slot_data(ss: 'SaveState | None', slot: int, request) -> dict:
    if ss is None:
        return {'slot': slot, 'has_state': False, 'screenshot_url': None, 'updated_at': None}
    screenshot_url = None
    if ss.screenshot_path and Path(ss.screenshot_path).is_file():
        rom_id = ss.rom_id
        screenshot_url = request.build_absolute_uri(
            f'/api/roms/{rom_id}/savestates/{slot}/screenshot/'
        )
    return {
        'slot':           slot,
        'has_state':      True,
        'screenshot_url': screenshot_url,
        'updated_at':     ss.updated_at.isoformat(),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def savestate_list(request, pk):
    try:
        ROM.objects.get(pk=pk)
    except ROM.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    states = {
        ss.slot: ss
        for ss in SaveState.objects.filter(rom_id=pk, user=request.user)
    }
    return Response([_slot_data(states.get(slot), slot, request) for slot in range(1, 10)])


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def savestate_detail(request, pk, slot):
    if slot < 1 or slot > 9:
        return Response({'detail': 'Slot deve ser entre 1 e 9.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        ROM.objects.get(pk=pk)
    except ROM.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        try:
            ss = SaveState.objects.get(rom_id=pk, slot=slot, user=request.user)
        except SaveState.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)
        for attr in ('state_path', 'screenshot_path'):
            p = Path(getattr(ss, attr))
            if p.is_file():
                p.unlink(missing_ok=True)
        ss.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # POST — save / overwrite slot
    state_file = request.FILES.get('state')
    if not state_file:
        return Response({'detail': 'Campo "state" é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)

    slot_dir = _savestate_dir(pk, slot)
    slot_dir.mkdir(parents=True, exist_ok=True)

    state_path = slot_dir / 'state.bin'
    with open(state_path, 'wb') as f:
        for chunk in state_file.chunks():
            f.write(chunk)

    screenshot_path = ''
    screenshot_file = request.FILES.get('screenshot')
    if screenshot_file:
        ss_path = slot_dir / 'screenshot.png'
        with open(ss_path, 'wb') as f:
            for chunk in screenshot_file.chunks():
                f.write(chunk)
        screenshot_path = str(ss_path)

    ss, _ = SaveState.objects.update_or_create(
        rom_id=pk, slot=slot, user=request.user,
        defaults={'state_path': str(state_path), 'screenshot_path': screenshot_path},
    )
    return Response(_slot_data(ss, slot, request), status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def savestate_download(request, pk, slot):
    try:
        ss = SaveState.objects.get(rom_id=pk, slot=slot)
    except SaveState.DoesNotExist:
        return Response({'detail': 'Save state não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    path = Path(ss.state_path)
    if not path.is_file():
        return Response({'detail': 'Arquivo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    resp = FileResponse(open(path, 'rb'), content_type='application/octet-stream')
    resp['Content-Length'] = path.stat().st_size
    resp['Content-Disposition'] = 'attachment; filename="state.bin"'
    return resp


@api_view(['GET'])
@permission_classes([AllowAny])
def savestate_screenshot(request, pk, slot):
    try:
        ss = SaveState.objects.get(rom_id=pk, slot=slot)
    except SaveState.DoesNotExist:
        return Response({'detail': 'Save state não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    if not ss.screenshot_path:
        return Response({'detail': 'Sem screenshot.'}, status=status.HTTP_404_NOT_FOUND)
    path = Path(ss.screenshot_path)
    if not path.is_file():
        return Response({'detail': 'Arquivo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    return FileResponse(open(path, 'rb'), content_type='image/png')
