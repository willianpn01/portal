from django.db import models


class BookProject(models.Model):
    title       = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    settings    = models.JSONField(default=dict)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title


class Chapter(models.Model):
    project       = models.ForeignKey(BookProject, on_delete=models.CASCADE, related_name='chapters')
    title         = models.CharField(max_length=200)
    order         = models.PositiveIntegerField(default=0)
    html_content  = models.TextField(default='')
    meta          = models.JSONField(default=dict)
    last_autosave = models.DateTimeField(null=True, blank=True)
    last_export   = models.DateTimeField(null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'{self.project.title} — {self.title}'

    def prune_versions(self, limit=20):
        ids_to_keep = list(self.versions.order_by('-saved_at').values_list('id', flat=True)[:limit])
        self.versions.exclude(id__in=ids_to_keep).delete()


class AITask(models.Model):
    TASK_TYPES = [('correction', 'Correção'), ('extraction', 'Extração')]

    task_type      = models.CharField(max_length=20, choices=TASK_TYPES)
    project        = models.ForeignKey(BookProject, on_delete=models.CASCADE)
    chapter        = models.ForeignKey(Chapter, on_delete=models.CASCADE, null=True, blank=True)
    input_snippet  = models.TextField()
    output_raw     = models.TextField()
    tokens_used    = models.IntegerField(default=0)
    cost_estimated = models.FloatField(default=0.0)
    timestamp      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f'{self.task_type} @ {self.timestamp:%Y-%m-%d %H:%M}'


class ChapterVersion(models.Model):
    chapter      = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name='versions')
    html_content = models.TextField()
    saved_at     = models.DateTimeField(auto_now_add=True)
    label        = models.CharField(max_length=50, default='autosave')

    class Meta:
        ordering = ['-saved_at']

    def __str__(self):
        return f'{self.chapter.title} — {self.label} @ {self.saved_at}'
