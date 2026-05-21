from django.urls import path
from . import views

urlpatterns = [
    path('roots/', views.list_roots),
    path('roots/<int:pk>/', views.manage_root),
    path('list/', views.list_directory),
    path('download/', views.download_file),
    path('upload/', views.upload_file),
    path('operation/', views.file_operation),
    path('zip/', views.zip_files),
    path('unzip/', views.unzip_file),
    path('preview/', views.preview_file),
]
