from django.urls import path
from .settings_views import settings_view, file_roots_list, file_root_detail

urlpatterns = [
    path('', settings_view),
    path('file-roots/', file_roots_list),
    path('file-roots/<int:pk>/', file_root_detail),
]
