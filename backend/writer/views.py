import uuid

import bleach
from bleach.css_sanitizer import CSSSanitizer
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import BookProject, Chapter, ChapterVersion
from .serializers import (
    BookProjectSerializer,
    ChapterDetailSerializer,
    ChapterListSerializer,
    ChapterVersionDetailSerializer,
    ChapterVersionListSerializer,
)
from .tasks import export_chapter_to_docx

# ── bleach sanitization ───────────────────────────────────────────────────────

ALLOWED_TAGS = [
    'p', 'h1', 'h2', 'h3', 'h4', 'strong', 'em', 'u',
    'ul', 'ol', 'li', 'blockquote', 'br',
    'span', 'mark', 'hr', 'div',
]
ALLOWED_ATTRS = {'*': ['class', 'style', 'data-color']}

_CSS_SANITIZER = CSSSanitizer(allowed_css_properties=[
    'color', 'background-color', 'font-family', 'font-size',
    'text-align', 'font-weight', 'font-style', 'text-decoration',
])


def _sanitize(html):
    return bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        css_sanitizer=_CSS_SANITIZER,
        strip=True,
    )


# ── projects ──────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def project_list(request):
    if request.method == 'GET':
        projects = BookProject.objects.all()
        return Response(BookProjectSerializer(projects, many=True).data)

    serializer = BookProjectSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def project_detail(request, pk):
    try:
        project = BookProject.objects.get(pk=pk)
    except BookProject.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(BookProjectSerializer(project).data)

    if request.method == 'PATCH':
        serializer = BookProjectSerializer(project, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    # DELETE
    project.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── chapters ──────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def chapter_list(request, pk):
    try:
        project = BookProject.objects.get(pk=pk)
    except BookProject.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        chapters = project.chapters.all()
        return Response(ChapterListSerializer(chapters, many=True).data)

    # POST — create chapter
    last = project.chapters.order_by('-order').first()
    next_order = (last.order + 1) if last else 0

    data = dict(request.data)
    data['project'] = project.pk
    data.setdefault('order', next_order)

    serializer = ChapterDetailSerializer(data=data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    serializer.save(project=project, order=next_order)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def chapter_detail(request, pk):
    try:
        chapter = Chapter.objects.select_related('project').get(pk=pk)
    except Chapter.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ChapterDetailSerializer(chapter).data)

    if request.method == 'PATCH':
        serializer = ChapterDetailSerializer(chapter, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    # DELETE
    chapter.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── autosave / save-version ───────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chapter_autosave(request, pk):
    try:
        chapter = Chapter.objects.get(pk=pk)
    except Chapter.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    html = _sanitize(request.data.get('html_content', ''))
    chapter.html_content = html
    chapter.last_autosave = timezone.now()
    chapter.save(update_fields=['html_content', 'last_autosave', 'updated_at'])

    ChapterVersion.objects.create(chapter=chapter, html_content=html, label='autosave')
    chapter.prune_versions()

    return Response(ChapterDetailSerializer(chapter).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chapter_save_version(request, pk):
    try:
        chapter = Chapter.objects.get(pk=pk)
    except Chapter.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    html = _sanitize(request.data.get('html_content', chapter.html_content))
    label = request.data.get('label', 'manual')

    chapter.html_content = html
    chapter.save(update_fields=['html_content', 'updated_at'])

    version = ChapterVersion.objects.create(chapter=chapter, html_content=html, label=label)
    chapter.prune_versions()

    return Response(ChapterVersionDetailSerializer(version).data, status=status.HTTP_201_CREATED)


# ── versions ──────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chapter_versions(request, pk):
    try:
        chapter = Chapter.objects.get(pk=pk)
    except Chapter.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    versions = chapter.versions.all()
    return Response(ChapterVersionListSerializer(versions, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chapter_version_detail(request, pk, version_pk):
    try:
        chapter = Chapter.objects.get(pk=pk)
    except Chapter.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        version = chapter.versions.get(pk=version_pk)
    except ChapterVersion.DoesNotExist:
        return Response({'detail': 'Versão não encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    return Response(ChapterVersionDetailSerializer(version).data)


# ── export ────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chapter_export(request, pk):
    try:
        chapter = Chapter.objects.get(pk=pk)
    except Chapter.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    task_id = str(uuid.uuid4())
    chapter.meta['last_export_task'] = {
        'task_id': task_id,
        'status': 'pending',
        'url': None,
        'error': None,
    }
    chapter.save(update_fields=['meta'])

    export_chapter_to_docx(chapter.pk, task_id)

    return Response({'task_id': task_id}, status=status.HTTP_202_ACCEPTED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chapter_export_status(request, pk, task_id):
    try:
        chapter = Chapter.objects.get(pk=pk)
    except Chapter.DoesNotExist:
        return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    task_info = chapter.meta.get('last_export_task')
    if not task_info or task_info.get('task_id') != task_id:
        return Response({'detail': 'Task não encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        'status': task_info.get('status'),
        'url':    task_info.get('url'),
        'error':  task_info.get('error'),
    })
