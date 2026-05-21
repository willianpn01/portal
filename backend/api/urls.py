from django.urls import path, include

urlpatterns = [
    path('dashboard/', include('dashboard.urls')),
    path('weather/', include('weather.urls')),
    path('news/', include('news.urls')),
    path('pdf/', include('pdf_tools.urls')),
    path('downloads/', include('downloads.urls')),
    path('files/', include('file_manager.urls')),
    path('retro/', include('retro.urls')),
    path('roms/', include('rom_library.urls')),
    path('radio/', include('radio.urls')),
    path('settings/', include('core.settings_urls')),
]
