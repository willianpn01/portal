import time
from datetime import datetime

import psutil
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


def _disk_stats():
    import platform
    from pathlib import Path

    path = Path(settings.BASE_DIR).anchor
    usage = psutil.disk_usage(path)
    return {
        'disk_percent': usage.percent,
        'disk_used_gb': round(usage.used / (1024 ** 3), 1),
        'disk_total_gb': round(usage.total / (1024 ** 3), 1),
    }


def _system_stats():
    vm = psutil.virtual_memory()
    boot_time = psutil.boot_time()
    uptime_seconds = int(time.time() - boot_time)

    stats = {
        'cpu_percent': psutil.cpu_percent(interval=0.1),
        'ram_percent': vm.percent,
        'ram_used_gb': round(vm.used / (1024 ** 3), 1),
        'ram_total_gb': round(vm.total / (1024 ** 3), 1),
        'uptime_seconds': uptime_seconds,
    }
    stats.update(_disk_stats())
    return stats


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    tz_name = settings.TIME_ZONE
    now = datetime.now()

    return Response({
        'system': _system_stats(),
        'datetime': {
            'iso': now.isoformat(timespec='seconds'),
            'timezone': tz_name,
        },
    })
