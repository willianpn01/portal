from rest_framework import serializers
from .models import DownloadJob


class DownloadJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = DownloadJob
        fields = [
            'id', 'url', 'title', 'status', 'progress', 'speed', 'eta',
            'file_path', 'file_size', 'error_msg', 'download_type',
            'resolution', 'subtitles', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'status', 'progress', 'speed', 'eta',
            'file_path', 'file_size', 'error_msg', 'created_at', 'updated_at',
        ]
