from django.contrib import admin
from .models import FavoriteStation


@admin.register(FavoriteStation)
class FavoriteStationAdmin(admin.ModelAdmin):
    list_display  = ['name', 'user', 'country', 'language', 'added_at']
    list_filter   = ['country']
    search_fields = ['name', 'station_uuid']
    ordering      = ['-added_at']
