from django.db import models


class WeatherCache(models.Model):
    city       = models.CharField(max_length=100)
    country    = models.CharField(max_length=10)
    data       = models.JSONField()
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('city', 'country')

    def __str__(self):
        return f'{self.city}, {self.country}'
