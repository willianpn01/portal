import re
import requests
from pathlib import Path

TGDB_BASE     = "https://api.thegamesdb.net/v1"
TGDB_IMG_BASE = "https://cdn.thegamesdb.net/images/original/"

PLATFORM_IDS = {
    "nes":       7,    # Nintendo Entertainment System
    "snes":      6,    # Super Nintendo
    "gb":        4,    # Game Boy
    "gbc":       41,   # Game Boy Color
    "gba":       5,    # Game Boy Advance
    "megadrive": 36,   # Sega Mega Drive
}


def fetch_rom_metadata(
    rom_title: str,
    platform_slug: str,
    api_key: str,
) -> dict | None:
    """
    Busca metadata de uma ROM pelo nome e plataforma.
    Retorna dict com os campos do modelo ROM, ou None se não encontrar.
    """
    platform_id = PLATFORM_IDS.get(platform_slug)
    if not platform_id or not api_key:
        return None

    try:
        resp = requests.get(
            f"{TGDB_BASE}/Games/ByGameName",
            params={
                "apikey":            api_key,
                "name":              rom_title,
                "filter[platform]":  platform_id,
                "fields":            "overview,genres,players,rating",
                "include":           "boxart",
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        games = data.get("data", {}).get("games", [])
        if not games:
            return None

        game    = games[0]
        game_id = game.get("id")

        # Extract cover art from include
        cover_url = None
        boxart    = data.get("include", {}).get("boxart", {})
        base_url  = boxart.get("base_url", {}).get("original", TGDB_IMG_BASE)
        images    = boxart.get("data", {}).get(str(game_id), [])

        for img in images:
            if img.get("type") == "boxart" and img.get("side") == "front":
                cover_url = base_url + img.get("filename", "")
                break

        # Extract genre names from include
        genre       = ""
        genre_ids   = game.get("genres") or []
        genres_map  = data.get("include", {}).get("genres", {}).get("data", {})
        genre_names = [
            genres_map[str(gid)].get("genre", "")
            for gid in genre_ids[:2]
            if genres_map.get(str(gid))
        ]
        genre = ", ".join(filter(None, genre_names))

        return {
            "title":         game.get("game_title", rom_title),
            "description":   game.get("overview", ""),
            "genre":         genre,
            "year":          _parse_year(game.get("release_date", "")),
            "players":       game.get("players") or 1,
            "region":        game.get("region", ""),
            "thegamesdb_id": game_id,
            "cover_url":     cover_url,
        }

    except Exception:
        return None


def _parse_year(date_str: str) -> int | None:
    """Extrai o ano de strings como '1996-03-21' ou '1996'."""
    if not date_str:
        return None
    try:
        return int(str(date_str)[:4])
    except (ValueError, TypeError):
        return None
