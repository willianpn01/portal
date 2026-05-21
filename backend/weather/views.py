import datetime
import json
import urllib.parse
import urllib.request
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import WeatherCache

_CACHE_TTL = timedelta(minutes=60)
_OWM_ICON  = 'https://openweathermap.org/img/wn/{}@2x.png'


def _fmt_time(ts: int | None) -> str | None:
    if ts is None:
        return None
    return datetime.datetime.fromtimestamp(ts).strftime('%H:%M')


def _read_config() -> dict:
    try:
        with open(settings.EXECUTABLES_CONFIG, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


# ── OpenWeatherMap geocoding ───────────────────────────────────────────────────

def _geocode(city: str, country: str, key: str) -> tuple[float, float]:
    qs = urllib.parse.urlencode({'q': f'{city},{country}', 'limit': 1, 'appid': key})
    req = urllib.request.Request(
        f'https://api.openweathermap.org/geo/1.0/direct?{qs}',
        headers={'User-Agent': 'Portal/1.0'},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        results = json.loads(resp.read().decode('utf-8'))
    if not results:
        raise ValueError(f'Cidade não encontrada para geocoding: {city}, {country}')
    return float(results[0]['lat']), float(results[0]['lon'])


# ── One Call API 3.0 ──────────────────────────────────────────────────────────

def _fetch_openweather(city: str, country: str, key: str,
                       lat: float | None, lon: float | None) -> dict:
    if lat is None or lon is None:
        lat, lon = _geocode(city, country, key)

    qs = urllib.parse.urlencode({
        'lat':     lat,
        'lon':     lon,
        'appid':   key,
        'units':   'metric',
        'lang':    'pt_br',
        'exclude': 'minutely,alerts',
    })
    req = urllib.request.Request(
        f'https://api.openweathermap.org/data/3.0/onecall?{qs}',
        headers={'User-Agent': 'Portal/1.0'},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        d = json.loads(resp.read().decode('utf-8'))

    cur  = d.get('current', {})
    w    = cur.get('weather', [{}])[0]
    icon = w.get('icon', '01d')

    forecast = []
    for day in d.get('daily', [])[1:5]:
        dw   = day.get('weather', [{}])[0]
        temp = day.get('temp', {})
        forecast.append({
            'date':           datetime.date.fromtimestamp(day['dt']).isoformat(),
            'temp_min':       round(temp.get('min', 0), 1),
            'temp_max':       round(temp.get('max', 0), 1),
            'condition':      dw.get('description', '').capitalize(),
            'condition_icon': _OWM_ICON.format(dw.get('icon', '01d')),
        })

    gust = cur.get('wind_gust')
    vis  = cur.get('visibility')
    dp   = cur.get('dew_point')

    return {
        'city':           city,
        'country':        country,
        'temperature':    round(cur.get('temp', 0), 1),
        'feels_like':     round(cur.get('feels_like', 0), 1),
        'condition':      w.get('description', '').capitalize(),
        'condition_icon': _OWM_ICON.format(icon),
        'humidity':       cur.get('humidity', 0),
        'wind_kph':       round(cur.get('wind_speed', 0) * 3.6, 1),
        'uvi':            round(cur.get('uvi', 0), 1),
        'pressure':       cur.get('pressure'),
        'dew_point':      round(dp, 1) if dp is not None else None,
        'clouds':         cur.get('clouds'),
        'visibility':     round(vis / 1000, 1) if vis is not None else None,
        'wind_gust':      round(gust * 3.6, 1) if gust is not None else None,
        'sunrise':        _fmt_time(cur.get('sunrise')),
        'sunset':         _fmt_time(cur.get('sunset')),
        'forecast':       forecast,
        'provider':       'openweather_onecall3',
    }


# ── WeatherAPI (unchanged) ────────────────────────────────────────────────────

def _fetch_weatherapi(city: str, country: str, key: str) -> dict:
    qs = urllib.parse.urlencode({'key': key, 'q': f'{city},{country}', 'lang': 'pt'})
    req = urllib.request.Request(
        f'https://api.weatherapi.com/v1/current.json?{qs}',
        headers={'User-Agent': 'Portal/1.0'},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        d = json.loads(resp.read().decode('utf-8'))

    loc  = d.get('location', {})
    cur  = d.get('current', {})
    cond = cur.get('condition', {})

    vis = cur.get('vis_km')

    return {
        'city':           loc.get('name', city),
        'country':        loc.get('country', country),
        'temperature':    round(cur.get('temp_c', 0), 1),
        'feels_like':     round(cur.get('feelslike_c', 0), 1),
        'condition':      cond.get('text', '').capitalize(),
        'condition_icon': cond.get('icon', ''),
        'humidity':       cur.get('humidity', 0),
        'wind_kph':       round(cur.get('wind_kph', 0), 1),
        'uvi':            round(cur.get('uv', 0), 1),
        'pressure':       cur.get('pressure_mb'),
        'dew_point':      None,
        'clouds':         cur.get('cloud'),
        'visibility':     round(vis, 1) if vis is not None else None,
        'wind_gust':      round(cur.get('gust_kph', 0), 1) if cur.get('gust_kph') else None,
        'sunrise':        None,
        'sunset':         None,
        'forecast':       [],
        'provider':       'weatherapi',
    }


# ── view ──────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def weather(request):
    config   = _read_config()
    key      = config.get('weather_api_key')
    city     = (config.get('weather_city') or '').strip()
    country  = (config.get('weather_country') or '').strip()
    provider = (config.get('weather_provider') or 'openweathermap').strip()
    lat      = config.get('weather_lat')
    lon      = config.get('weather_lon')

    if not key or not city:
        return Response({'error': 'Weather não configurado'})

    # Serve fresh cache when available
    stale = None
    try:
        cache = WeatherCache.objects.get(city__iexact=city, country__iexact=country)
        if timezone.now() - cache.fetched_at < _CACHE_TTL:
            return Response(cache.data)
        stale = cache
    except WeatherCache.DoesNotExist:
        pass

    try:
        if provider == 'weatherapi':
            data = _fetch_weatherapi(city, country, key)
        else:
            data = _fetch_openweather(city, country, key, lat, lon)
    except Exception as exc:
        if stale:
            return Response(stale.data)
        return Response({'error': f'Erro ao buscar clima: {exc}'})

    # Upsert cache — filter by iexact then save to avoid duplicate with diff case
    try:
        obj = WeatherCache.objects.get(city__iexact=city, country__iexact=country)
        obj.data = data
        obj.save()
    except WeatherCache.DoesNotExist:
        WeatherCache.objects.create(city=city, country=country, data=data)

    return Response(data)
