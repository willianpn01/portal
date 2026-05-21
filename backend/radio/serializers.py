from rest_framework import serializers
from .models import FavoriteStation


class FavoriteStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = FavoriteStation
        fields = [
            'id', 'station_uuid', 'name', 'url',
            'favicon', 'country', 'language', 'tags', 'added_at',
        ]
        read_only_fields = ['id', 'added_at']
