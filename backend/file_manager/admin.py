from django.contrib import admin
from .models import FileManagerRoot, OperationLog


@admin.register(FileManagerRoot)
class FileManagerRootAdmin(admin.ModelAdmin):
    list_display = ['label', 'path', 'is_active', 'created_at']
    list_editable = ['is_active']


@admin.register(OperationLog)
class OperationLogAdmin(admin.ModelAdmin):
    list_display = ['operation', 'path', 'destination', 'user', 'timestamp']
    readonly_fields = ['user', 'operation', 'path', 'destination', 'timestamp']
    list_filter = ['operation']
    ordering = ['-timestamp']
