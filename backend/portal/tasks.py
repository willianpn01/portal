# Central import point for all Huey tasks.
# `python manage.py run_huey` auto-discovers tasks.py in each installed app,
# so this file serves as a convenience import for explicit consumer invocation.
from downloads.tasks import run_download  # noqa: F401
from pdf_tools.tasks import run_pdf_job  # noqa: F401
from rom_library.tasks import run_scan  # noqa: F401
