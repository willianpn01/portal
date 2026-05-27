from django.urls import path

from . import views

urlpatterns = [
    path('projects/',                                      views.project_list),
    path('projects/<int:pk>/',                             views.project_detail),
    path('projects/<int:pk>/chapters/',                    views.chapter_list),
    path('chapters/<int:pk>/',                             views.chapter_detail),
    path('chapters/<int:pk>/autosave/',                    views.chapter_autosave),
    path('chapters/<int:pk>/save-version/',                views.chapter_save_version),
    path('chapters/<int:pk>/versions/',                    views.chapter_versions),
    path('chapters/<int:pk>/versions/<int:version_pk>/',   views.chapter_version_detail),
    path('chapters/<int:pk>/export/',                      views.chapter_export),
    path('chapters/<int:pk>/export/status/<str:task_id>/', views.chapter_export_status),
]
