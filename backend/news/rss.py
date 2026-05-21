import re
from datetime import datetime, timezone
from html import unescape

import feedparser

_IMG_RE   = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)
_TAGS_RE  = re.compile(r'<[^>]+>')
MAX_ITEMS = 20


def _extract_image(entry) -> str:
    # 1. media:content
    for m in getattr(entry, 'media_content', []):
        url = m.get('url', '')
        if url:
            return url
    # 2. enclosures
    for enc in getattr(entry, 'enclosures', []):
        if enc.get('type', '').startswith('image/'):
            return enc.get('href', '')
    # 3. first <img> in summary
    summary = getattr(entry, 'summary', '') or ''
    m = _IMG_RE.search(summary)
    return m.group(1) if m else ''


def _published(entry) -> str:
    t = getattr(entry, 'published_parsed', None)
    if t:
        try:
            return datetime(*t[:6], tzinfo=timezone.utc).isoformat()
        except (ValueError, TypeError):
            pass
    return datetime.now(timezone.utc).isoformat()


def fetch_feed(url: str) -> list[dict]:
    try:
        feed = feedparser.parse(url)
    except Exception:
        return []

    items = []
    for entry in feed.entries[:MAX_ITEMS]:
        raw_summary = getattr(entry, 'summary', '') or ''
        clean = _TAGS_RE.sub(' ', unescape(raw_summary)).strip()
        clean = re.sub(r'\s+', ' ', clean)[:400]

        items.append({
            'title':     getattr(entry, 'title', ''),
            'link':      getattr(entry, 'link', ''),
            'summary':   clean,
            'published': _published(entry),
            'image':     _extract_image(entry),
        })

    return items
