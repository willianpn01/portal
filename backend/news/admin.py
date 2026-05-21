from django.contrib import admin
from .models import RSSFeed, NewsCache


@admin.register(RSSFeed)
class RSSFeedAdmin(admin.ModelAdmin):
    list_display  = ['label', 'category', 'is_active', 'order', 'url']
    list_filter   = ['category', 'is_active']
    list_editable = ['is_active', 'order']


@admin.register(NewsCache)
class NewsCacheAdmin(admin.ModelAdmin):
    list_display    = ['feed', 'fetched_at']
    readonly_fields = ['feed', 'fetched_at', 'items']
