from rest_framework import serializers
from .models import FileManagerRoot


class FileManagerRootSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileManagerRoot
        fields = ['id', 'label', 'path', 'is_active']
