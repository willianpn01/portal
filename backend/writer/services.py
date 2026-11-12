from .ai_client import call_with_retry

CORRECTION_PROMPT = """Você é um revisor literário especializado em português brasileiro.

Sua tarefa é corrigir APENAS erros ortográficos e gramaticais inequívocos no texto abaixo.

CORRIJA obrigatoriamente:
- Palavras com grafia errada (ex: "noza" → "nossa", "voce" → "você", "tbm" → "também")
- Erros de concordância verbal e nominal
- Acentuação incorreta
- Uso errado de maiúsculas/minúsculas

NÃO ALTERE:
- Marcação HTML (tags, atributos, estilos)
- Estilo literário e voz do autor
- Pontuação intencional e ritmo das frases
- Travessões de diálogo (—)
- Gírias e expressões coloquiais CORRETAS (ex: "cara", "mano", "tá")
- Fragmentos de frase intencionais
- Palavras inventadas que sejam claramente nomes próprios ou termos do universo fictício

Retorne APENAS o texto corrigido, sem explicações, sem comentários, sem markdown.
Se não houver erros, retorne o texto original sem alterações.

Texto:
{text}"""

_CHUNK_CHARS = 12000  # ~3000 tokens


def _split_paragraphs(html: str) -> list[str]:
    return [p + '</p>' for p in html.split('</p>') if p.strip()]


def _correct_chunk(chunk: str) -> tuple[str, int, int]:
    prompt = CORRECTION_PROMPT.format(text=chunk)
    return call_with_retry(
        [{'role': 'user', 'content': prompt}],
        max_tokens=4000,
    )


def correct_spelling(text: str) -> tuple[str, int, int]:
    """
    Recebe HTML sanitizado, retorna (html_corrigido, total_tokens_in, total_tokens_out).
    Textos > _CHUNK_CHARS são divididos em lotes por parágrafo.
    """
    if len(text) <= _CHUNK_CHARS:
        return _correct_chunk(text)

    paragraphs = _split_paragraphs(text)
    corrected_parts: list[str] = []
    total_in = total_out = 0

    current_batch: list[str] = []
    current_len = 0

    def flush():
        nonlocal total_in, total_out
        if not current_batch:
            return
        chunk = ''.join(current_batch)
        result, tin, tout = _correct_chunk(chunk)
        corrected_parts.append(result)
        total_in += tin
        total_out += tout

    for para in paragraphs:
        if current_len + len(para) > _CHUNK_CHARS and current_batch:
            flush()
            current_batch = []
            current_len = 0
        current_batch.append(para)
        current_len += len(para)

    flush()

    return ''.join(corrected_parts), total_in, total_out
