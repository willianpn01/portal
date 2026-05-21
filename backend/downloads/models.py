from django.conf import settings
from django.db import models


class DownloadJob(models.Model):
    class Status(models.TextChoices):
        PENDING   = 'pending',   'Aguardando'
        RUNNING   = 'running',   'Baixando'
        DONE      = 'done',      'Concluído'
        ERROR     = 'error',     'Erro'
        CANCELLED = 'cancelled', 'Cancelado'

    url           = models.TextField()
    title         = models.CharField(max_length=500, blank=True)
    status        = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    progress      = models.FloatField(default=0.0)
    speed         = models.CharField(max_length=50, blank=True)
    eta           = models.CharField(max_length=50, blank=True)
    file_path     = models.TextField(blank=True)
    file_size     = models.BigIntegerField(null=True, blank=True)
    error_msg     = models.TextField(blank=True)
    download_type = models.CharField(max_length=10, default='video')
    resolution    = models.CharField(max_length=20, blank=True)
    subtitles     = models.BooleanField(default=False)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)
    user          = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='download_jobs',
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Download'
        verbose_name_plural = 'Downloads'

    def __str__(self):
        return f'{self.title or self.url[:60]} [{self.status}]'
