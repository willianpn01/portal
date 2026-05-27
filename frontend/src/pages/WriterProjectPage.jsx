import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { writerService } from '@/services/writerService'
import {
  ArrowLeft, GripVertical, Plus, Trash2, Edit3, BookOpen, Clock,
} from 'lucide-react'

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function countWords(html) {
  if (!html) return 0
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? text.split(' ').length : 0
}

function DeleteChapterModal({ chapter, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      await writerService.deleteChapter(chapter.id)
      onDeleted(chapter.id)
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm">
        <div className="p-5">
          <h2 className="text-white font-semibold text-base mb-2">Excluir Capítulo</h2>
          <p className="text-gray-400 text-sm">
            Tem certeza que deseja excluir <strong className="text-white">"{chapter.title}"</strong>? O conteúdo e todas as versões serão removidos permanentemente.
          </p>
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50"
          >
            {loading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SortableChapterRow({ chapter, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const wordCount = countWords(chapter.meta?.word_count_cache ?? '')
  const words = chapter.meta?.word_count != null ? chapter.meta.word_count : wordCount

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0"
        title="Arrastar para reordenar"
      >
        <GripVertical size={16} />
      </button>

      {/* Chapter info */}
      <div className="flex-1 min-w-0">
        <p className="text-gray-100 font-medium text-sm truncate">{chapter.title}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
          {words > 0 && <span>{words.toLocaleString('pt-BR')} palavras</span>}
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {formatTime(chapter.updated_at)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(chapter.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-green-400 border border-green-800 hover:bg-green-900/30 rounded-lg transition-colors"
        >
          <Edit3 size={12} />
          Editar
        </button>
        <button
          onClick={() => onDelete(chapter)}
          className="p-1.5 text-gray-600 hover:text-red-400 transition-colors ml-1"
          title="Excluir capítulo"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

export default function WriterProjectPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [creatingChapter, setCreatingChapter] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    Promise.all([
      writerService.getProject(projectId),
      writerService.getChapters(projectId),
    ]).then(([{ data: proj }, { data: chaps }]) => {
      setProject(proj)
      setTitleInput(proj.title)
      setChapters(chaps)
    }).finally(() => setLoading(false))
  }, [projectId])

  const handleTitleBlur = async () => {
    setEditingTitle(false)
    if (!titleInput.trim() || titleInput === project.title) return
    try {
      const { data } = await writerService.updateProject(projectId, { title: titleInput.trim() })
      setProject(data)
    } catch {
      setTitleInput(project.title)
    }
  }

  const handleNewChapter = async () => {
    setCreatingChapter(true)
    try {
      const title = `Capítulo ${chapters.length + 1}`
      const { data } = await writerService.createChapter(projectId, { title })
      navigate(`/writer/project/${projectId}/edit/${data.id}`)
    } catch {
      setCreatingChapter(false)
    }
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = chapters.findIndex((c) => c.id === active.id)
    const newIndex = chapters.findIndex((c) => c.id === over.id)
    const reordered = arrayMove(chapters, oldIndex, newIndex)
    setChapters(reordered)

    // Patch affected chapters with new order values
    await Promise.allSettled(
      reordered.map((ch, idx) =>
        ch.order !== idx ? writerService.updateChapter(ch.id, { order: idx }) : null
      ).filter(Boolean)
    )
    // Refresh chapters to get server-confirmed orders
    const { data } = await writerService.getChapters(projectId)
    setChapters(data)
  }

  const handleChapterDeleted = (id) => {
    setChapters((prev) => prev.filter((c) => c.id !== id))
    setDeleteTarget(null)
  }

  if (loading) {
    return (
      <div className="p-6 text-gray-400 text-sm">Carregando projeto...</div>
    )
  }

  if (!project) {
    return (
      <div className="p-6 text-gray-400 text-sm">Projeto não encontrado.</div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back nav */}
      <button
        onClick={() => navigate('/writer')}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={15} />
        Escritor
      </button>

      {/* Project header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <BookOpen size={20} className="text-green-400 shrink-0" />
          {editingTitle ? (
            <input
              autoFocus
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              className="flex-1 bg-transparent border-b border-green-500 text-gray-100 text-2xl font-bold focus:outline-none"
            />
          ) : (
            <h1
              className="text-2xl font-bold text-gray-100 cursor-pointer hover:text-green-400 transition-colors"
              onClick={() => setEditingTitle(true)}
              title="Clique para editar o título"
            >
              {project.title}
            </h1>
          )}
        </div>
        {project.description && (
          <p className="text-gray-500 text-sm ml-8">{project.description}</p>
        )}
      </div>

      {/* Chapters section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-gray-300 font-semibold text-sm uppercase tracking-wider">
          Capítulos ({chapters.length})
        </h2>
        <button
          onClick={handleNewChapter}
          disabled={creatingChapter}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus size={14} />
          {creatingChapter ? 'Criando...' : 'Novo Capítulo'}
        </button>
      </div>

      {chapters.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-700 rounded-xl">
          <p className="text-gray-500 text-sm">Nenhum capítulo ainda.</p>
          <button
            onClick={handleNewChapter}
            disabled={creatingChapter}
            className="mt-3 px-4 py-2 text-sm bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Criar primeiro capítulo
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={chapters.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {chapters.map((chapter) => (
                <SortableChapterRow
                  key={chapter.id}
                  chapter={chapter}
                  onEdit={(id) => navigate(`/writer/project/${projectId}/edit/${id}`)}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {deleteTarget && (
        <DeleteChapterModal
          chapter={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleChapterDeleted}
        />
      )}
    </div>
  )
}
