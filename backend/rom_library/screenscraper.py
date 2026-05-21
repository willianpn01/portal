"""
ScreenScraper API V2 client.
Returns None on any error — never raises.
"""
import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path

SYSTEM_IDS = {
    'nes':       3,
    'snes':      4,
    'gb':        9,
    'gbc':       10,
    'gba':       12,
    'megadrive': 1,
}

_BASE = 'https://www.screenscraper.fr/api2/jeuInfos.php'


def sha1_file(path: Path) -> str:
    h = hashlib.sha1()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()


def fetch_rom_metadata(
    file_path: Path,
    platform_slug: str,
    devid: str,
    devpassword: str,
    ssid: str,
    sspassword: str,
) -> dict | None:
    try:
        sha1 = sha1_file(file_path)
        stat = file_path.stat()

        qs = urllib.parse.urlencode({
            'devid':       devid,
            'devpassword': devpassword,
            'ssid':        ssid,
            'sspassword':  sspassword,
            'softname':    'portal',
            'output':      'json',
            'sha1':        sha1,
            'romtype':     'rom',
            'romnom':      file_path.name,
            'romsize':     str(stat.st_size),
            'systemeid':   str(SYSTEM_IDS.get(platform_slug, 3)),
        })
        req = urllib.request.Request(f'{_BASE}?{qs}', headers={'User-Agent': 'Portal/1.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        jeu = data.get('response', {}).get('jeu', {})
        if not jeu:
            return None

        # title — prefer world/ss region
        title = file_path.stem
        noms = jeu.get('noms', [])
        for nom in noms:
            if nom.get('region') in ('wor', 'ss', 'us', 'eu'):
                title = nom.get('text', title)
                break
        else:
            if noms:
                title = noms[0].get('text', title)

        # description — prefer fr/en
        description = ''
        for syn in jeu.get('synopsis', []):
            if syn.get('langue') in ('fr', 'en'):
                description = syn.get('text', '')
                break

        # genre
        genre = ''
        genres = jeu.get('genres', [])
        if genres:
            noms_g = genres[0].get('noms', [])
            if noms_g:
                genre = noms_g[0].get('text', '')

        # year
        year = None
        dates = jeu.get('dates', [])
        if dates:
            try:
                year = int(str(dates[0].get('text', ''))[:4])
            except (ValueError, TypeError):
                pass

        # players
        joueurs = jeu.get('joueurs', {})
        joueurs_text = joueurs.get('text', '1') if isinstance(joueurs, dict) else str(joueurs)
        try:
            players = int(str(joueurs_text).split('-')[-1])
        except (ValueError, AttributeError):
            players = 1

        # region
        region = ''
        regions_raw = jeu.get('regions', {})
        if isinstance(regions_raw, dict):
            region_list = regions_raw.get('regions', [])
        elif isinstance(regions_raw, list):
            region_list = regions_raw
        else:
            region_list = []
        if region_list:
            region = region_list[0].get('shortname', '')

        # cover — prefer box-2D
        cover_url = None
        for preferred in ('box-2D', 'sstitle', 'box-texture', 'fanart-hd', 'fanart'):
            for media in jeu.get('medias', []):
                if media.get('type') == preferred:
                    cover_url = media.get('url')
                    break
            if cover_url:
                break

        return {
            'sha1':             sha1,
            'title':            title,
            'description':      description,
            'genre':            genre,
            'year':             year,
            'players':          players,
            'region':           region,
            'screenscraper_id': jeu.get('id'),
            'cover_url':        cover_url,
        }

    except Exception:
        return None
