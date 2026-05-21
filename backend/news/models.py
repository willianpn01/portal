from django.db import models


class RSSFeed(models.Model):
    label     = models.CharField(max_length=100)
    url       = models.TextField()
    category  = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)
    order     = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'label']

    def __str__(self):
        return self.label


class NewsCache(models.Model):
    feed       = models.OneToOneField(RSSFeed, on_delete=models.CASCADE, related_name='newscache')
    items      = models.JSONField(default=list)
    fetched_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Cache: {self.feed.label}'
