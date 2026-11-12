import logging
import os
import time

from openai import OpenAI

logger = logging.getLogger(__name__)


def get_client():
    key = os.environ.get('Ciel')
    if not key:
        raise EnvironmentError("Variável de ambiente 'Ciel' não definida.")
    return OpenAI(api_key=key)


def call_with_retry(
    messages: list,
    max_tokens: int = 2000,
    retries: int = 3,
    backoff: float = 2.0,
) -> tuple[str, int, int]:
    """
    Chama a API com retry exponencial.
    Retorna (content, tokens_in, tokens_out).
    """
    client = get_client()
    last_exc: Exception | None = None

    for attempt in range(retries):
        try:
            response = client.chat.completions.create(
                model='gpt-5.4-nano',
                messages=messages,
                max_completion_tokens=max_tokens,
                temperature=0.2,
            )
            usage = response.usage
            tokens_in = usage.prompt_tokens
            tokens_out = usage.completion_tokens
            logger.info(
                'OpenAI call: tokens_in=%d tokens_out=%d',
                tokens_in,
                tokens_out,
            )
            return response.choices[0].message.content, tokens_in, tokens_out

        except Exception as exc:
            last_exc = exc
            if attempt < retries - 1:
                time.sleep(backoff ** attempt)

    raise last_exc
