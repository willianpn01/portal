import json
import threading
import urllib.parse
import urllib.request

from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import FavoriteStation
from .serializers import FavoriteStationSerializer

_RADIO = 'https://de1.api.radio-browser.info/json'

# ── helpers ───────────────────────────────────────────────────────────────────

def _fetch(url: str, cache_key: str, ttl: int) -> list:
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Portal/1.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        if not isinstance(data, list):
            data = []
    except Exception:
        return []   # don't cache failures
    cache.set(cache_key, data, ttl)
    return data


def _click_async(station_uuid: str) -> None:
    try:
        req = urllib.request.Request(
            f'{_RADIO}/url/{station_uuid}',
            headers={'User-Agent': 'Portal/1.0'},
        )
        urllib.request.urlopen(req, timeout=3)
    except Exception:
        pass

# ── search / top ──────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search(request):
    params = {
        'name':       request.query_params.get('name', ''),
        'limit':      request.query_params.get('limit', '20'),
        'offset':     request.query_params.get('offset', '0'),
        'hidebroken': 'true',
        'order':      'votes',
        'reverse':    'true',
    }
    for key in ('countrycode', 'language', 'tagList'):
        val = request.query_params.get(key, '').strip()
        if val:
            params[key] = val

    url = f'{_RADIO}/stations/search?' + urllib.parse.urlencode(params)
    cache_key = ('radio_search_'
                 + urllib.parse.quote(params['name'])[:40]
                 + '_' + params['limit']
                 + '_' + params['offset'])
    return Response(_fetch(url, cache_key, 300))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def top_stations(request):
    limit = request.query_params.get('limit', '20')
    url   = f'{_RADIO}/stations/topvote?limit={limit}&hidebroken=true'
    return Response(_fetch(url, f'radio_top_{limit}', 900))

# ── favorites ─────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def favorites(request):
    if request.method == 'GET':
        qs = FavoriteStation.objects.filter(user=request.user)
        return Response(FavoriteStationSerializer(qs, many=True).data)

    station_uuid = request.data.get('station_uuid', '').strip()
    if not station_uuid:
        return Response({'detail': 'station_uuid é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)

    station, created = FavoriteStation.objects.get_or_create(
        user=request.user,
        station_uuid=station_uuid,
        defaults={
            'name':     request.data.get('name', ''),
            'url':      request.data.get('url', ''),
            'favicon':  request.data.get('favicon', ''),
            'country':  request.data.get('country', ''),
            'language': request.data.get('language', ''),
            'tags':     request.data.get('tags', ''),
        },
    )
    code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return Response(FavoriteStationSerializer(station).data, status=code)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def favorite_delete(request, station_uuid):
    FavoriteStation.objects.filter(user=request.user, station_uuid=station_uuid).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

# ── click ─────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def click(request, station_uuid):
    threading.Thread(target=_click_async, args=(station_uuid,), daemon=True).start()
    return Response({'status': 'ok'})
