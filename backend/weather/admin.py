from django.contrib import admin
from .models import WeatherCache


@admin.register(WeatherCache)
class WeatherCacheAdmin(admin.ModelAdmin):
    list_display    = ['city', 'country', 'fetched_at']
    readonly_fields = ['fetched_at', 'data']
