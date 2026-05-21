import { useEffect, useRef, useState, useCallback } from 'react'
import usePdfStore from '@/stores/pdfStore'
import { pdfService } from '@/services/pdfService'
import { PageHeader } from '@/components/ui/PageHeader'

// ── constants ──────────────────────────────────────────────────────────────────

const TABS = ['Workspace', 'Ferramentas', 'Histórico']

const OPERATIONS = [
  {
    id: 'merge',
    label: 'Mesclar PDFs',
    description: 'Combine múltiplos PDFs em um só.',
    icon: '🔗',
    multiFile: true,
    acceptPdf: true,
    params: [],

  },
  {
    id: 'split',
    label: 'Dividir PDF',
    description: 'Divida páginas ou intervalos em arquivos separados.',
    icon: '✂️',
    multiFile: false,
    acceptPdf: true,
    params: [{ key: 'ranges_text', label: 'Intervalos (ex: 1-3,5,7-9)', placeholder: 'Deixe vazio para uma página por arquivo', type: 'text' }],
  },
  {
    id: 'pdf_to_images',
    label: 'PDF → Imagens',
    description: 'Exporte cada página como PNG.',
    icon: '🖼️',
    multiFile: false,
    acceptPdf: true,
    params: [{ key: 'dpi', label: 'DPI', placeholder: '150', type: 'number' }],
  },
  {
    id: 'images_to_pdf',
    label: 'Imagens → PDF',
    description: 'Converta imagens para um único PDF.',
    icon: '📄',
    multiFile: true,
    acceptPdf: false,
    params: [],
  },
  {
    id: 'pdf_to_text',
    label: 'PDF → Texto',
    description: 'Extraia texto nativo de um PDF.',
    icon: '📝',
    multiFile: false,
    acceptPdf: true,
    params: [],
  },
  {
    id: 'ocr_image',
    label: 'OCR Imagem',
    description: 'Reconheça texto em uma imagem.',
    icon: '🔍',
    multiFile: false,
    acceptPdf: false,
    params: [{ key: 'lang', label: 'Idioma(s)', placeholder: 'por+eng', type: 'text' }],
  },
  {
    id: 'ocr_pdf',
    label: 'OCR PDF',
    description: 'Adicione camada de texto pesquisável ao PDF.',
    icon: '🔎',
    multiFile: false,
    acceptPdf: true,
    params: [{ key: 'lang', label: 'Idioma(s)', placeholder: 'por+eng', type: 'text' }],
  },
  {
    id: 'compress',
    label: 'Comprimir PDF',
    description: 'Reduza o tamanho do arquivo.',
    icon: '📦',
    multiFile: false,
    acceptPdf: true,
    params: [
      {
        key: 'quality',
        label: 'Qualidade',
        type: 'select',
        options: [
          { value: 'screen', label: 'Tela (menor)' },
          { value: 'ebook', label: 'eBook (médio)' },
          { value: 'printer', label: 'Impressão (alto)' },
          { value: 'prepress', label: 'Pré-impressão (máximo)' },
        ],
      },
    ],
  },
  {
    id: 'rotate',
    label: 'Rotacionar PDF',
    description: 'Gire páginas inteiras ou específicas.',
    icon: '🔄',
    multiFile: false,
    acceptPdf: true,
    params: [
      {
        key: 'degrees',
        label: 'Graus',
        type: 'select',
        options: [
          { value: '90', label: '90°' },
          { value: '180', label: '180°' },
          { value: '270', label: '270°' },
        ],
      },
      { key: 'pages_text', label: 'Páginas (ex: 1,3,5)', placeholder: 'Vazio = todas', type: 'text' },
    ],
  },
  {
    id: 'pdf_to_docx',
    label: 'PDF → DOCX',
    description: 'Extrai texto e estrutura do PDF em parágrafos editáveis. Formatação visual (cores, imagens, layout exato) não é preservada.',
    icon: '📝',
    multiFile: false,
    acceptPdf: true,
    acceptDocx: false,
    params: [],
  },
  {
    id: 'pdf_to_docx_ocr',
    label: 'PDF → DOCX (OCR)',
    description: 'OCR + conversão para DOCX — ideal para PDFs digitalizados.',
    icon: '🔎',
    multiFile: false,
    acceptPdf: true,
    acceptDocx: false,
    params: [{ key: 'lang', label: 'Idioma(s)', placeholder: 'por+eng', type: 'text' }],
  },
  {
    id: 'docx_to_pdf',
    label: 'DOCX → PDF',
    description: 'Converta documentos Word para PDF.',
    icon: '📄',
    badge: 'LibreOffice',
    multiFile: false,
    acceptPdf: false,
    acceptDocx: true,
    params: [],
  },
]

// ── helpers ────────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function parseRanges(text) {
  if (!text.trim()) return []
  return text.split(',').map((r) => {
    const parts = r.trim().split('-').map(Number)
    return parts.length === 2 ? [parts[0], parts[1]] : [parts[0], parts[0]]
  })
}

function statusColor(status) {
  return {
    pending: 'text-yellow-400',
    running: 'text-blue-400',
    done: 'text-green-400',
    error: 'text-red-400',
  }[status] || 'text-gray-400'
}

function statusLabel(status) {
  return { pending: 'Pendente', running: 'Processando', done: 'Concluído', error: 'Erro' }[status] || status
}

// ── Workspace Tab ──────────────────────────────────────────────────────────────

function WorkspaceTab({ onSelect, selectedFiles }) {
  const { files, isLoadingFiles, fetchFiles, uploadFile, deleteFile } = usePdfStore()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()

  useEffect(() => { fetchFiles() }, [])

  const handleFiles = async (fileList) => {
    setUploading(true)
    setError('')
    for (const file of Array.from(fileList)) {
      try {
        await uploadFile(file)
      } catch (e) {
        setError(e.response?.data?.detail || `Erro ao enviar ${file.name}`)
      }
    }
    setUploading(false)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const toggleSelect = (filename) => {
    onSelect((prev) =>
      prev.includes(filename) ? prev.filter((f) => f !== filename) : [...prev, filename]
    )
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${dragging ? 'border-blue-400 bg-blue-900/20' : 'border-gray-600 hover:border-gray-500'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tiff,.tif,.docx,.doc"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="text-gray-400 text-sm">
          {uploading ? 'Enviando...' : 'Arraste arquivos aqui ou clique para selecionar'}
        </p>
        <p className="text-gray-600 text-xs mt-1">PDF, DOCX, DOC, PNG, JPG, GIF, WEBP, BMP, TIFF</p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* File list */}
      {isLoadingFiles ? (
        <p className="text-gray-500 text-sm">Carregando...</p>
      ) : files.length === 0 ? (
        <p className="text-gray-500 text-sm">Nenhum arquivo no workspace.</p>
      ) : (
        <div className="space-y-1">
          {files.map((f) => {
            const sel = selectedFiles.includes(f.filename)
            return (
              <div
                key={f.filename}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${sel ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'}`}
                onClick={() => toggleSelect(f.filename)}
              >
                <input
                  type="checkbox"
                  checked={sel}
                  onChange={() => toggleSelect(f.filename)}
                  onClick={(e) => e.stopPropagation()}
                  className="accent-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{f.filename}</p>
                  <p className="text-xs text-gray-500">
                    {formatBytes(f.size_bytes)}
                    {f.pages != null && ` · ${f.pages} pág.`}
                    {` · ${f.extension.toUpperCase()}`}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteFile(f.filename) }}
                  className="text-gray-500 hover:text-red-400 text-xs px-2 py-1 rounded transition-colors"
                >
                  Remover
                </button>
              </div>
            )
          })}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <p className="text-blue-400 text-xs">
          {selectedFiles.length} arquivo(s) selecionado(s) para uso nas Ferramentas
        </p>
      )}
    </div>
  )
}

// ── Operation Form Modal ───────────────────────────────────────────────────────

function OperationModal({ op, files, onClose, onCreate }) {
  const [selected, setSelected] = useState(files.slice(0, op.multiFile ? files.length : 1))
  const [paramVals, setParamVals] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const setParam = (key, val) => setParamVals((p) => ({ ...p, [key]: val }))

  const handleSubmit = async () => {
    if (selected.length === 0) { setError('Selecione ao menos um arquivo.'); return }
    setSubmitting(true)
    setError('')

    const params = {}
    for (const p of op.params) {
      const v = paramVals[p.key]
      if (p.key === 'ranges_text') {
        params.ranges = parseRanges(v || '')
      } else if (p.key === 'pages_text') {
        const raw = (v || '').trim()
        params.pages = raw ? raw.split(',').map(Number) : null
      } else if (p.key === 'dpi') {
        params.dpi = parseInt(v || '150', 10)
      } else if (v !== undefined && v !== '') {
        params[p.key] = v
      }
    }

    try {
      await onCreate({ operation: op.id, input_files: selected, params })
      onClose()
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao criar job.')
      setSubmitting(false)
    }
  }

  const toggleFile = (fn) =>
    setSelected((prev) =>
      op.multiFile
        ? prev.includes(fn) ? prev.filter((f) => f !== fn) : [...prev, fn]
        : [fn]
    )

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-700 flex items-center gap-3">
          <span className="text-2xl">{op.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold" style={{ color: 'var(--text)' }}>{op.label}</h2>
              {op.badge && (
                <span className="text-xs text-blue-300 bg-blue-900/40 border border-blue-700/50 px-1.5 py-0.5 rounded font-medium">
                  {op.badge}
                </span>
              )}
            </div>
            <p className="text-gray-400 text-xs">{op.description}</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* File selection */}
          <div>
            <p className="text-gray-300 text-sm font-medium mb-2">
              {op.multiFile ? 'Arquivos de entrada' : 'Arquivo de entrada'}
            </p>
            {files.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum arquivo no workspace.</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {files
                  .filter((f) => {
                    if (op.acceptDocx) return f.extension === 'docx' || f.extension === 'doc'
                    if (op.acceptPdf && !op.multiFile) return f.extension === 'pdf'
                    if (op.id === 'images_to_pdf') return f.extension !== 'pdf' && f.extension !== 'docx' && f.extension !== 'doc'
                    return true
                  })
                  .map((f) => (
                    <label key={f.filename} className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 p-1 rounded">
                      <input
                        type={op.multiFile ? 'checkbox' : 'radio'}
                        name="file_select"
                        checked={selected.includes(f.filename)}
                        onChange={() => toggleFile(f.filename)}
                        className="accent-blue-500"
                      />
                      <span className="text-sm text-gray-300 truncate">{f.filename}</span>
                      <span className="text-xs text-gray-500 ml-auto">{formatBytes(f.size_bytes)}</span>
                    </label>
                  ))}
              </div>
            )}
          </div>

          {/* Params */}
          {op.params.map((p) => (
            <div key={p.key}>
              <label className="block text-gray-300 text-sm mb-1">{p.label}</label>
              {p.type === 'select' ? (
                <select
                  value={paramVals[p.key] ?? p.options[0].value}
                  onChange={(e) => setParam(p.key, e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  {p.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={p.type}
                  placeholder={p.placeholder}
                  value={paramVals[p.key] ?? ''}
                  onChange={(e) => setParam(p.key, e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                />
              )}
            </div>
          ))}

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="p-5 border-t border-gray-700 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            {submitting ? 'Processando...' : 'Executar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Ferramentas Tab ────────────────────────────────────────────────────────────

function FeramentasTab({ selectedFiles, onJobCreated }) {
  const { files, createJob } = usePdfStore()
  const [activeOp, setActiveOp] = useState(null)

  const handleCreate = async (payload) => {
    const job = await createJob(payload)
    onJobCreated(job)
  }

  return (
    <div>
      <p className="text-gray-500 text-xs mb-4">
        {selectedFiles.length > 0
          ? `${selectedFiles.length} arquivo(s) pré-selecionado(s) do Workspace`
          : 'Selecione arquivos no Workspace ou escolha-os ao executar a operação'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {OPERATIONS.map((op) => (
          <button
            key={op.id}
            onClick={() => setActiveOp(op)}
            className="text-left p-4 bg-gray-800/60 border border-gray-700 rounded-xl hover:border-gray-500 hover:bg-gray-800 transition-all"
          >
            <div className="flex items-start justify-between gap-1">
              <span className="text-2xl">{op.icon}</span>
              {op.badge && (
                <span className="text-xs text-blue-300 bg-blue-900/40 border border-blue-700/50 px-1.5 py-0.5 rounded font-medium shrink-0">
                  {op.badge}
                </span>
              )}
            </div>
            <p className="text-sm font-medium mt-2" style={{ color: 'var(--text)' }}>{op.label}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>{op.description}</p>
          </button>
        ))}
      </div>

      {activeOp && (
        <OperationModal
          op={activeOp}
          files={files}
          onClose={() => setActiveOp(null)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}

// ── Histórico Tab ──────────────────────────────────────────────────────────────

function HistoricoTab() {
  const { jobs, isLoadingJobs, fetchJobs, updateJob } = usePdfStore()
  const pollingRef = useRef(null)

  const hasActive = jobs.some((j) => j.status === 'pending' || j.status === 'running')

  const poll = useCallback(async () => {
    const active = jobs.filter((j) => j.status === 'pending' || j.status === 'running')
    for (const job of active) {
      try {
        const { data } = await pdfService.getJob(job.id)
        updateJob(data)
      } catch { /* ignore */ }
    }
  }, [jobs, updateJob])

  useEffect(() => {
    fetchJobs()
  }, [])

  useEffect(() => {
    if (hasActive) {
      pollingRef.current = setInterval(poll, 3000)
    } else {
      clearInterval(pollingRef.current)
    }
    return () => clearInterval(pollingRef.current)
  }, [hasActive, poll])

  const opLabel = (id) => OPERATIONS.find((o) => o.id === id)?.label || id

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-400 text-sm">{jobs.length} job(s) no histórico</p>
        <button
          onClick={fetchJobs}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Atualizar
        </button>
      </div>

      {isLoadingJobs ? (
        <p className="text-gray-500 text-sm">Carregando...</p>
      ) : jobs.length === 0 ? (
        <p className="text-gray-500 text-sm">Nenhum job ainda. Execute uma operação na aba Ferramentas.</p>
      ) : (
        jobs.map((job) => (
          <div
            key={job.id}
            className="p-4 bg-gray-800/60 border border-gray-700 rounded-xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{opLabel(job.operation)}</span>
                  <span className={`text-xs font-medium ${statusColor(job.status)}`}>
                    {statusLabel(job.status)}
                    {job.status === 'running' && (
                      <span className="ml-1 inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    )}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  Arquivos: {job.input_files?.join(', ')}
                </p>
                {job.error_msg && (
                  <p className="text-red-400 text-xs mt-1 truncate" title={job.error_msg}>
                    {job.error_msg}
                  </p>
                )}
                <p className="text-gray-600 text-xs mt-1">
                  {new Date(job.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              {job.status === 'done' && job.output_file && (
                <a
                  href={pdfService.downloadOutput(job.id)}
                  download
                  className="shrink-0 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg transition-colors"
                >
                  Baixar
                </a>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function PdfPage() {
  const [activeTab, setActiveTab] = useState('Workspace')
  const [selectedFiles, setSelectedFiles] = useState([])

  const handleJobCreated = () => {
    setActiveTab('Histórico')
  }

  return (
    <div className="space-y-4">
      <PageHeader icon="ti-file-type-pdf" title="Ferramentas PDF" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
              ${activeTab === tab
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'Workspace' && (
          <WorkspaceTab onSelect={setSelectedFiles} selectedFiles={selectedFiles} />
        )}
        {activeTab === 'Ferramentas' && (
          <FeramentasTab selectedFiles={selectedFiles} onJobCreated={handleJobCreated} />
        )}
        {activeTab === 'Histórico' && (
          <HistoricoTab />
        )}
      </div>
    </div>
  )
}
