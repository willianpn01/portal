from django.conf import settings
from django.db import models


class FileManagerRoot(models.Model):
    label = models.CharField(max_length=100)
    path = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Raiz'
        verbose_name_plural = 'Raízes'
        ordering = ['label']

    def __str__(self):
        return f'{self.label} ({self.path})'


class OperationLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='file_operations',
    )
    operation = models.CharField(max_length=20)
    path = models.TextField()
    destination = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Log de operação'
        verbose_name_plural = 'Logs de operações'
        ordering = ['-timestamp']

    def __str__(self):
        return f'{self.operation} {self.path} ({self.timestamp:%Y-%m-%d %H:%M})'
