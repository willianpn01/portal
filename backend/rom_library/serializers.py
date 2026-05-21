from rest_framework import serializers
from .models import Platform, ROM, ScanJob


class PlatformSerializer(serializers.ModelSerializer):
    rom_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Platform
        fields = ['id', 'slug', 'name', 'emulatorjs_core', 'rom_count']


class ROMSerializer(serializers.ModelSerializer):
    platform  = PlatformSerializer(read_only=True)
    cover_url = serializers.SerializerMethodField()

    class Meta:
        model = ROM
        fields = [
            'id', 'platform', 'title', 'file_size', 'file_hash',
            'description', 'genre', 'year', 'players', 'region',
            'thegamesdb_id', 'is_favorite', 'tags',
            'last_played', 'play_count', 'created_at', 'cover_url',
        ]

    def get_cover_url(self, obj):
        if not obj.cover_path:
            return None
        request = self.context.get('request')
        url = f'/api/roms/{obj.pk}/cover/'
        return request.build_absolute_uri(url) if request else url


class ScanJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScanJob
        fields = [
            'id', 'status', 'roms_path', 'total_found', 'total_new',
            'current_file', 'error_msg', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'status', 'total_found', 'total_new',
            'current_file', 'error_msg', 'created_at', 'updated_at',
        ]
