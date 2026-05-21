from rest_framework import serializers
from .models import PDFJob


class PDFJobSerializer(serializers.ModelSerializer):
    operation_label = serializers.CharField(source='get_operation_display', read_only=True)

    class Meta:
        model = PDFJob
        fields = [
            'id', 'operation', 'operation_label', 'status',
            'input_files', 'output_file', 'params', 'error_msg',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'status', 'output_file', 'error_msg', 'created_at', 'updated_at']
