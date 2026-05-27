from django.contrib import admin

from .models import BookProject, Chapter, ChapterVersion


@admin.register(BookProject)
class BookProjectAdmin(admin.ModelAdmin):
    list_display = ['title', 'created_at', 'updated_at']
    search_fields = ['title']


@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'order', 'last_autosave', 'updated_at']
    list_filter = ['project']
    search_fields = ['title', 'project__title']


@admin.register(ChapterVersion)
class ChapterVersionAdmin(admin.ModelAdmin):
    list_display = ['chapter', 'label', 'saved_at']
    list_filter = ['label', 'chapter__project']
