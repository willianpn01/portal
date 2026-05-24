from django.urls import path
from . import views

# Order matters: fixed paths before <int:pk>
urlpatterns = [
    path('scan/',           views.scan_start),
    path('scan/<int:pk>/',  views.scan_detail),
    path('rescrape/',       views.rescrape),
    path('platforms/',      views.platform_list),
    path('',                views.rom_list),
    path('<int:pk>/',           views.rom_detail),
    path('<int:pk>/play/',      views.rom_play),
    path('<int:pk>/file/',      views.rom_file),
    path('<int:pk>/cover/',     views.rom_cover),
    path('<int:pk>/savestates/',                        views.savestate_list),
    path('<int:pk>/savestates/<int:slot>/',             views.savestate_detail),
    path('<int:pk>/savestates/<int:slot>/download/',    views.savestate_download),
    path('<int:pk>/savestates/<int:slot>/screenshot/',  views.savestate_screenshot),
]
