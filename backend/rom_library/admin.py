from django.contrib import admin
from .models import Platform, ROM, ScanJob


@admin.register(Platform)
class PlatformAdmin(admin.ModelAdmin):
    list_display = ['slug', 'name', 'emulatorjs_core']


@admin.register(ROM)
class ROMAdmin(admin.ModelAdmin):
    list_display  = ['title', 'platform', 'year', 'region', 'is_favorite', 'play_count', 'last_played']
    list_filter   = ['platform', 'is_favorite', 'genre']
    search_fields = ['title']
    ordering      = ['title']
    readonly_fields = ['created_at', 'file_hash', 'file_size', 'thegamesdb_id']


@admin.register(ScanJob)
class ScanJobAdmin(admin.ModelAdmin):
    list_display  = ['id', 'status', 'roms_path', 'total_found', 'total_new', 'created_at']
    list_filter   = ['status']
    readonly_fields = ['created_at', 'updated_at', 'total_found', 'total_new', 'current_file', 'error_msg']
