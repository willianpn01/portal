from django.urls import path
from . import views

urlpatterns = [
    path('',                     views.news_list),
    path('feeds/',               views.feed_list_create),
    path('feeds/<int:pk>/',      views.feed_detail),
    path('feeds/<int:pk>/refresh/', views.feed_refresh),
]
