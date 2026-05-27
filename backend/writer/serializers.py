from rest_framework import serializers
from .models import BookProject, Chapter, ChapterVersion


class BookProjectSerializer(serializers.ModelSerializer):
    chapter_count = serializers.SerializerMethodField()

    class Meta:
        model = BookProject
        fields = ['id', 'title', 'description', 'settings', 'chapter_count', 'created_at', 'updated_at']

    def get_chapter_count(self, obj):
        return obj.chapters.count()


class ChapterListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chapter
        fields = ['id', 'project_id', 'title', 'order', 'meta', 'last_autosave', 'last_export', 'created_at', 'updated_at']


class ChapterDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chapter
        fields = ['id', 'project_id', 'title', 'order', 'html_content', 'meta', 'last_autosave', 'last_export', 'created_at', 'updated_at']


class ChapterVersionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChapterVersion
        fields = ['id', 'label', 'saved_at']


class ChapterVersionDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChapterVersion
        fields = ['id', 'label', 'saved_at', 'html_content']
