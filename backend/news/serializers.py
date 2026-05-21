from rest_framework import serializers
from .models import RSSFeed


class RSSFeedSerializer(serializers.ModelSerializer):
    class Meta:
        model = RSSFeed
        fields = ['id', 'label', 'url', 'category', 'is_active', 'order']
