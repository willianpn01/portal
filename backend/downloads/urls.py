from django.urls import path
from . import views

urlpatterns = [
    path('', views.job_list_create),
    path('info/', views.url_info),
    path('<int:pk>/', views.job_detail),
    path('<int:pk>/info/', views.job_info),
]
