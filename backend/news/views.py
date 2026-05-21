from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from .models import NewsCache, RSSFeed
from .rss import fetch_feed
from .serializers import RSSFeedSerializer

CACHE_TTL_MINUTES = 30


def _refresh_feed(feed: RSSFeed) -> list:
    items = fetch_feed(feed.url)
    if items:
        NewsCache.objects.update_or_create(
            feed=feed,
            defaults={'items': items},
        )
    else:
        cache = getattr(feed, 'newscache', None)
        items = cache.items if cache else []
    return items


@api_view(['GET'])
def news_list(request):
    feeds = RSSFeed.objects.filter(is_active=True).prefetch_related('newscache')
    cutoff = timezone.now() - timedelta(minutes=CACHE_TTL_MINUTES)

    result = []
    for feed in feeds:
        cache = getattr(feed, 'newscache', None)
        if cache is None or cache.fetched_at < cutoff:
            items = _refresh_feed(feed)
        else:
            items = cache.items

        result.append({
            'id':       feed.id,
            'label':    feed.label,
            'category': feed.category,
            'items':    items,
        })

    return Response(result)


@api_view(['GET', 'POST'])
def feed_list_create(request):
    if request.method == 'GET':
        feeds = RSSFeed.objects.all()
        return Response(RSSFeedSerializer(feeds, many=True).data)

    if not request.user.is_staff:
        return Response({'detail': 'Permissão negada.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = RSSFeedSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
def feed_detail(request, pk):
    try:
        feed = RSSFeed.objects.get(pk=pk)
    except RSSFeed.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(RSSFeedSerializer(feed).data)

    if not request.user.is_staff:
        return Response({'detail': 'Permissão negada.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PATCH':
        serializer = RSSFeedSerializer(feed, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    feed.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def feed_refresh(request, pk):
    try:
        feed = RSSFeed.objects.get(pk=pk)
    except RSSFeed.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    items = fetch_feed(feed.url)
    if items:
        NewsCache.objects.update_or_create(feed=feed, defaults={'items': items})
    return Response({'count': len(items)})
