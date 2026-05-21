from django.urls import path
from . import views

urlpatterns = [
    path('search/',                       views.search),
    path('top/',                          views.top_stations),
    path('favorites/',                    views.favorites),
    path('favorites/<str:station_uuid>/', views.favorite_delete),
    path('click/<str:station_uuid>/',     views.click),
]
