from django.conf import settings
from django.db import models


class PDFJob(models.Model):
    class Operation(models.TextChoices):
        MERGE        = 'merge',            'Unir PDFs'
        SPLIT        = 'split',            'Dividir PDF'
        PDF_IMG      = 'pdf_to_images',    'PDF → Imagens'
        IMG_PDF      = 'images_to_pdf',    'Imagens → PDF'
        PDF_TEXT     = 'pdf_to_text',      'PDF → Texto'
        OCR_IMG      = 'ocr_image',        'OCR em Imagem'
        OCR_PDF      = 'ocr_pdf',          'OCR em PDF'
        COMPRESS     = 'compress',         'Comprimir PDF'
        ROTATE       = 'rotate',           'Rotacionar PDF'
        PDF_DOCX     = 'pdf_to_docx',      'PDF → DOCX'
        PDF_DOCX_OCR = 'pdf_to_docx_ocr',  'PDF → DOCX (OCR)'
        DOCX_PDF     = 'docx_to_pdf',      'DOCX → PDF'
        IMG_CONVERT  = 'img_convert',      'Converter Imagem'
        IMG_CROP     = 'img_crop',         'Cortar Imagem'
        IMG_RESIZE   = 'img_resize',       'Redimensionar Imagem'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Aguardando'
        RUNNING = 'running', 'Processando'
        DONE    = 'done',    'Concluído'
        ERROR   = 'error',   'Erro'

    operation   = models.CharField(max_length=20, choices=Operation.choices)
    status      = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    input_files = models.JSONField(default=list)
    output_file = models.TextField(blank=True)
    params      = models.JSONField(default=dict)
    error_msg   = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
    user        = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='pdf_jobs',
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'PDF Job'
        verbose_name_plural = 'PDF Jobs'

    def __str__(self):
        return f'{self.operation} [{self.status}] — user {self.user_id}'
