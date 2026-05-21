from django.apps import AppConfig


class RomLibraryConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'rom_library'

    def ready(self):
        from django.db.models.signals import post_migrate
        post_migrate.connect(_seed_platforms, sender=self)


def _seed_platforms(sender, **kwargs):
    from .models import Platform
    for slug, name, core in Platform.PLATFORMS:
        Platform.objects.update_or_create(
            slug=slug,
            defaults={'name': name, 'emulatorjs_core': core},
        )
