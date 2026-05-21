from django.contrib import admin
from .models import DownloadJob


@admin.register(DownloadJob)
class DownloadJobAdmin(admin.ModelAdmin):
    list_display = ['title', 'url_short', 'download_type', 'status', 'progress', 'created_at', 'user']
    list_filter = ['status', 'download_type']
    readonly_fields = ['created_at', 'updated_at', 'file_path', 'file_size', 'error_msg', 'progress', 'speed', 'eta']
    ordering = ['-created_at']

    def url_short(self, obj):
        return obj.url[:60]
    url_short.short_description = 'URL'
