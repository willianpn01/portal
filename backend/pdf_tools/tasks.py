from pathlib import Path

from django.conf import settings
from huey.contrib.djhuey import task

from .operations import execute_job


@task()
def run_pdf_job(job_id: int) -> None:
    from .models import PDFJob

    try:
        job = PDFJob.objects.select_related('user').get(pk=job_id)
    except PDFJob.DoesNotExist:
        return

    job.status = PDFJob.Status.RUNNING
    job.save(update_fields=['status', 'updated_at'])

    workspace = Path(settings.MEDIA_ROOT) / 'pdf_workspace' / str(job.user_id)
    workspace.mkdir(parents=True, exist_ok=True)

    try:
        output_filename = execute_job(job, workspace)
        job.status = PDFJob.Status.DONE
        job.output_file = output_filename
        job.save()
    except Exception as exc:
        job.status = PDFJob.Status.ERROR
        job.error_msg = str(exc)[:1000]
        job.save()
