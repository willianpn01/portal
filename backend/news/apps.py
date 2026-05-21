from django.apps import AppConfig


class NewsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'news'

    def ready(self):
        from django.db.models.signals import post_migrate
        post_migrate.connect(_seed_feeds, sender=self)


def _seed_feeds(sender, **kwargs):
    from .models import RSSFeed
    seeds = [
        ('Hacker News', 'https://news.ycombinator.com/rss',            'tech',  0),
        ('TechCrunch',  'https://techcrunch.com/feed/',                 'tech',  1),
        ('G1 - Geral',  'https://g1.globo.com/rss/g1/',                'geral', 2),
        ('BBC Brasil',  'https://feeds.bbci.co.uk/portuguese/rss.xml', 'geral', 3),
    ]
    for label, url, category, order in seeds:
        RSSFeed.objects.get_or_create(url=url, defaults={
            'label':    label,
            'category': category,
            'order':    order,
        })
