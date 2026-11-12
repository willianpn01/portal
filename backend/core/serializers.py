from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'avatar', 'theme', 'is_staff']
        # Campos privilegiados nunca graváveis pelo próprio usuário (C1).
        read_only_fields = ['id', 'is_staff']
