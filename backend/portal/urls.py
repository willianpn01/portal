from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('core.urls')),
    path('api/', include('api.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) + [
    # Catch-all: entrega o index.html do React para qualquer rota não-API,
    # permitindo que o React Router gerencie a navegação do lado do cliente.
    re_path(r'^(?!api/).*$', TemplateView.as_view(template_name='index.html')),
]
