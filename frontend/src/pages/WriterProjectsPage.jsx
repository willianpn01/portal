import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { writerService } from '@/services/writerService'
import { BookOpen, Plus, Trash2, ChevronRight } from 'lucide-react'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function NewProjectModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!title.trim()) { setError('Título obrigatório.'); return }
    setLoading(true)
    setError('')
    try {
      const { data } = await writerService.createProject({ title: title.trim(), description: description.trim() })
      onCreated(data)
    } catch (e) {
      setError(e.response?.data?.title?.[0] || 'Erro ao criar projeto.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
        <div className="p-5 border-b border-gray-700">
          <h2 className="text-white font-semibold text-base">Novo Projeto</h2>
          <p className="text-gray-400 text-xs mt-1">Crie um novo projeto de escrita.</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-gray-300 text-sm mb-1">Título</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Nome do projeto..."
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-green-500"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Descrição <span className="text-gray-500">(opcional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Uma breve sinopse ou notas..."
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-green-500 resize-none"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 text-sm bg-green-700 hover:bg-green-600 text-white rounded transition-colors disabled:opacity-50"
          >
            {loading ? 'Criando...' : 'Criar Projeto'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ project, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      await writerService.deleteProject(project.id)
      onDeleted(project.id)
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm">
        <div className="p-5">
          <h2 className="text-white font-semibold text-base mb-2">Excluir Projeto</h2>
          <p className="text-gray-400 text-sm">
            Tem certeza que deseja excluir <strong className="text-white">"{project.title}"</strong>? Todos os capítulos e versões serão removidos permanentemente.
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

export default function WriterProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    writerService.getProjects()
      .then(({ data }) => setProjects(data))
      .finally(() => setLoading(false))
  }, [])

  const handleCreated = (project) => {
    setProjects((prev) => [project, ...prev])
    setShowNewModal(false)
    navigate(`/writer/project/${project.id}`)
  }

  const handleDeleted = (id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    setDeleteTarget(null)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <BookOpen size={20} className="text-green-400" />
            Escritor
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Projetos de escrita — romances, roteiros e textos longos</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} />
          Novo Projeto
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm mt-8">Carregando projetos...</div>
      ) : projects.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
            <BookOpen size={28} className="text-gray-500" />
          </div>
          <div>
            <p className="text-gray-300 font-medium">Nenhum projeto ainda</p>
            <p className="text-gray-500 text-sm mt-1">
              Crie seu primeiro projeto e comece a escrever!
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="mt-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
          >
            Criar primeiro projeto
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-gray-900 border border-gray-700 rounded-xl p-5 flex flex-col gap-3 hover:border-gray-500 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => navigate(`/writer/project/${project.id}`)}
                  className="flex-1 text-left"
                >
                  <h3 className="text-white font-semibold text-base leading-tight group-hover:text-green-400 transition-colors">
                    {project.title}
                  </h3>
                </button>
                <button
                  onClick={() => setDeleteTarget(project)}
                  className="text-gray-600 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                  title="Excluir projeto"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {project.description && (
                <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed">
                  {project.description}
                </p>
              )}

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-800">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{project.chapter_count} {project.chapter_count === 1 ? 'capítulo' : 'capítulos'}</span>
                  <span>·</span>
                  <span>{formatDate(project.updated_at)}</span>
                </div>
                <button
                  onClick={() => navigate(`/writer/project/${project.id}`)}
                  className="text-gray-500 hover:text-green-400 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewModal && (
        <NewProjectModal onClose={() => setShowNewModal(false)} onCreated={handleCreated} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
