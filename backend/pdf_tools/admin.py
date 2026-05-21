from django.contrib import admin
from .models import PDFJob


@admin.register(PDFJob)
class PDFJobAdmin(admin.ModelAdmin):
    list_display = ['id', 'operation', 'status', 'user', 'created_at']
    list_filter = ['operation', 'status']
    readonly_fields = ['created_at', 'updated_at', 'output_file', 'error_msg']
    ordering = ['-created_at']
