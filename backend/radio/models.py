from django.conf import settings
from django.db import models


class FavoriteStation(models.Model):
    user         = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='favorite_stations')
    station_uuid = models.CharField(max_length=100)
    name         = models.CharField(max_length=300)
    url          = models.TextField()
    favicon      = models.TextField(blank=True)
    country      = models.CharField(max_length=100, blank=True)
    language     = models.CharField(max_length=100, blank=True)
    tags         = models.CharField(max_length=500, blank=True)
    added_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'station_uuid')
        ordering = ['-added_at']

    def __str__(self):
        return self.name
