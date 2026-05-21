from django.db import models


class Platform(models.Model):
    slug            = models.CharField(max_length=30, unique=True)
    name            = models.CharField(max_length=100)
    emulatorjs_core = models.CharField(max_length=50)

    PLATFORMS = [
        ('nes',       'Nintendo Entertainment System', 'nes'),
        ('snes',      'Super Nintendo',                'snes9x'),
        ('gb',        'Game Boy',                      'gambatte'),
        ('gbc',       'Game Boy Color',                'gambatte'),
        ('gba',       'Game Boy Advance',              'mgba'),
        ('megadrive', 'Sega Mega Drive / Genesis',     'segaMD'),
    ]

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


PLATFORM_EXTENSIONS = {
    'nes':       ['.nes'],
    'snes':      ['.smc', '.sfc'],
    'gb':        ['.gb'],
    'gbc':       ['.gbc'],
    'gba':       ['.gba'],
    'megadrive': ['.md', '.bin', '.gen'],
}


class ROM(models.Model):
    platform         = models.ForeignKey(Platform, on_delete=models.CASCADE, related_name='roms')
    title            = models.CharField(max_length=300)
    file_path        = models.TextField(unique=True)
    file_size        = models.BigIntegerField()
    file_hash        = models.CharField(max_length=64, blank=True)
    cover_path       = models.TextField(blank=True)
    description      = models.TextField(blank=True)
    genre            = models.CharField(max_length=100, blank=True)
    year             = models.IntegerField(null=True, blank=True)
    players          = models.IntegerField(default=1)
    region           = models.CharField(max_length=20, blank=True)
    thegamesdb_id    = models.IntegerField(null=True, blank=True)
    is_favorite      = models.BooleanField(default=False)
    tags             = models.JSONField(default=list)
    last_played      = models.DateTimeField(null=True, blank=True)
    play_count       = models.IntegerField(default=0)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['title']

    def __str__(self):
        return self.title


class ScanJob(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pendente'
        RUNNING = 'running', 'Rodando'
        DONE    = 'done',    'Concluído'
        ERROR   = 'error',   'Erro'

    status       = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    roms_path    = models.TextField()
    total_found  = models.IntegerField(default=0)
    total_new    = models.IntegerField(default=0)
    current_file = models.CharField(max_length=300, blank=True)
    error_msg    = models.TextField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'ScanJob #{self.pk} [{self.status}]'
