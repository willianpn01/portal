from django.urls import path
from . import views

urlpatterns = [
    path('upload/', views.upload_file),
    path('workspace/', views.list_workspace),
    path('workspace/<str:filename>/', views.delete_workspace_file),
    path('jobs/', views.job_list_create),
    path('jobs/<int:pk>/', views.job_detail),
    path('jobs/<int:pk>/download/', views.download_output),
]
