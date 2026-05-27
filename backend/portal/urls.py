from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.generic import TemplateView
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('core.urls')),
    path('api/', include('api.urls')),
    # Serve media files regardless of DEBUG — static() only works when DEBUG=True
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    # Catch-all: entrega o index.html do React para qualquer rota não-API/media,
    # permitindo que o React Router gerencie a navegação do lado do cliente.
    re_path(r'^(?!api/|media/).*$', TemplateView.as_view(template_name='index.html')),
]
