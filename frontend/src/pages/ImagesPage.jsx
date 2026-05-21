import { useCallback, useEffect, useRef, useState } from 'react'
import { imageService } from '@/services/imageService'
import { PageHeader } from '@/components/ui/PageHeader'

const ACCEPT = '.jpg,.jpeg,.png,.webp,.bmp,.gif,.tiff'
const IMG_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff'])

const OP_LABELS = {
  img_convert: 'Converter formato',
  img_crop:    'Cortar imagem',
  img_resize:  'Redimensionar',
}

const TABS = ['Ferramentas', 'Histórico']

// ── helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function statusColor(s) {
  return { pending: 'text-yellow-400', running: 'text-blue-400', done: 'text-green-400', error: 'text-red-400' }[s] || 'text-gray-400'
}
function statusLabel(s) {
  return { pending: 'Pendente', running: 'Processando', done: 'Concluído', error: 'Erro' }[s] || s
}

// ── Upload zone ───────────────────────────────────────────────────────────────

function UploadZone({ onUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()

  const handle = async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!IMG_EXTS.has(ext)) {
      setError(`Formato não suportado: .${ext}`)
      return
    }
    setError('')
    setUploading(true)
    const preview = URL.createObjectURL(file)
    try {
      const { data } = await imageService.upload(file)
      onUploaded({ file, preview, info: data })
    } catch (e) {
      URL.revokeObjectURL(preview)
      setError(e.response?.data?.detail || 'Erro ao enviar imagem.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
        ${dragging ? 'border-blue-400 bg-blue-900/10' : 'border-gray-600 hover:border-gray-500'}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]) }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handle(e.target.files[0])}
      />
      <p className="text-sm" style={{ color: 'var(--text2)' }}>
        {uploading ? 'Enviando…' : 'Arraste uma imagem aqui ou clique para selecionar'}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
        JPG · PNG · WebP · BMP · GIF · TIFF
      </p>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  )
}

// ── Image preview ─────────────────────────────────────────────────────────────

function ImagePreview({ preview, info, onClear }) {
  return (
    <div className="flex gap-4 items-start p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <img
        src={preview}
        alt="preview"
        className="rounded-lg object-contain"
        style={{ maxWidth: 160, maxHeight: 120, background: 'var(--bg2)' }}
      />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{info.filename}</p>
        <p className="text-xs" style={{ color: 'var(--text2)' }}>
          {info.dimensions && <span className="mr-3">📐 {info.dimensions} px</span>}
          <span>{formatBytes(info.size_bytes)}</span>
          <span className="ml-3 uppercase">{info.extension}</span>
        </p>
      </div>
      <button
        onClick={onClear}
        className="text-xs shrink-0 hover:opacity-70"
        style={{ color: 'var(--text3)' }}
      >
        Trocar
      </button>
    </div>
  )
}

// ── Convert card ──────────────────────────────────────────────────────────────

function ConvertCard({ info, onJobCreated }) {
  const [fmt, setFmt] = useState('png')
  const [quality, setQuality] = useState(90)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const needsQuality = fmt === 'jpeg' || fmt === 'webp'

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const { data } = await imageService.createJob({
        operation:   'img_convert',
        input_files: [info.filename],
        params:      { output_format: fmt, quality },
      })
      onJobCreated(data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao criar job.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>🔄 Converter formato</p>

      <div className="space-y-1">
        <label className="text-xs" style={{ color: 'var(--text2)' }}>Formato de saída</label>
        <select
          value={fmt}
          onChange={(e) => setFmt(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          {['jpeg', 'png', 'webp', 'bmp', 'tiff'].map((f) => (
            <option key={f} value={f}>{f.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {needsQuality && (
        <div className="space-y-1">
          <label className="text-xs flex justify-between" style={{ color: 'var(--text2)' }}>
            <span>Qualidade</span><span>{quality}%</span>
          </label>
          <input
            type="range"
            min={60} max={100}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-2 text-sm rounded-lg disabled:opacity-50 transition-colors"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {submitting ? 'Enviando…' : 'Converter'}
      </button>
    </div>
  )
}

// ── Crop card ─────────────────────────────────────────────────────────────────

function CropCard({ info, preview, onJobCreated }) {
  const [dims] = useState(() => {
    if (!info.dimensions) return { w: 0, h: 0 }
    const [w, h] = info.dimensions.split('x').map(Number)
    return { w, h }
  })
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [width, setWidth]   = useState(dims.w)
  const [height, setHeight] = useState(dims.h)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]   = useState('')

  // Overlay visualisation
  const previewW = 280
  const scale    = dims.w > 0 ? previewW / dims.w : 1
  const previewH = Math.round(dims.h * scale)

  const clamp = (v, max) => Math.max(0, Math.min(Number(v) || 0, max))

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const { data } = await imageService.createJob({
        operation:   'img_crop',
        input_files: [info.filename],
        params:      { x, y, width, height },
      })
      onJobCreated(data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao criar job.')
    } finally {
      setSubmitting(false)
    }
  }

  const boxLeft   = Math.round(x * scale)
  const boxTop    = Math.round(y * scale)
  const boxWidth  = Math.round(width  * scale)
  const boxHeight = Math.round(height * scale)

  return (
    <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>✂️ Cortar imagem</p>

      {dims.w > 0 && (
        <p className="text-xs" style={{ color: 'var(--text3)' }}>
          Dimensões originais: {dims.w} × {dims.h} px
        </p>
      )}

      {/* Preview with crop overlay */}
      {preview && dims.w > 0 && (
        <div className="relative rounded overflow-hidden" style={{ width: previewW, height: previewH, background: 'var(--bg2)' }}>
          <img src={preview} alt="" className="absolute inset-0 w-full h-full object-contain" />
          <div
            className="absolute pointer-events-none"
            style={{
              left:   boxLeft,
              top:    boxTop,
              width:  boxWidth,
              height: boxHeight,
              border: '2px solid #3b82f6',
              background: 'rgba(59,130,246,0.12)',
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'X (px)', value: x,      set: (v) => setX(clamp(v, dims.w)) },
          { label: 'Y (px)', value: y,      set: (v) => setY(clamp(v, dims.h)) },
          { label: 'Largura (px)', value: width,  set: (v) => setWidth(clamp(v, dims.w - x)) },
          { label: 'Altura (px)',  value: height, set: (v) => setHeight(clamp(v, dims.h - y)) },
        ].map(({ label, value, set }) => (
          <div key={label} className="space-y-0.5">
            <label className="text-xs" style={{ color: 'var(--text2)' }}>{label}</label>
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => set(e.target.value)}
              className="w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={submitting || width <= 0 || height <= 0}
        className="w-full py-2 text-sm rounded-lg disabled:opacity-50 transition-colors"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {submitting ? 'Enviando…' : 'Cortar'}
      </button>
    </div>
  )
}

// ── Resize card ───────────────────────────────────────────────────────────────

function ResizeCard({ info, onJobCreated }) {
  const [origDims] = useState(() => {
    if (!info.dimensions) return { w: 0, h: 0 }
    const [w, h] = info.dimensions.split('x').map(Number)
    return { w, h }
  })
  const [width, setWidth]     = useState(String(origDims.w || ''))
  const [height, setHeight]   = useState(String(origDims.h || ''))
  const [keepAspect, setKeepAspect] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]     = useState('')

  const onWidthChange = (val) => {
    setWidth(val)
    if (keepAspect && origDims.w && origDims.h && val) {
      setHeight(String(Math.round(origDims.h * (Number(val) / origDims.w))))
    }
  }

  const onHeightChange = (val) => {
    setHeight(val)
    if (keepAspect && origDims.w && origDims.h && val) {
      setWidth(String(Math.round(origDims.w * (Number(val) / origDims.h))))
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const { data } = await imageService.createJob({
        operation:   'img_resize',
        input_files: [info.filename],
        params: {
          width:       Number(width) || null,
          height:      Number(height) || null,
          keep_aspect: keepAspect,
        },
      })
      onJobCreated(data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao criar job.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>📏 Redimensionar</p>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Largura (px)', value: width,  onChange: onWidthChange },
          { label: 'Altura (px)',  value: height, onChange: onHeightChange },
        ].map(({ label, value, onChange }) => (
          <div key={label} className="space-y-0.5">
            <label className="text-xs" style={{ color: 'var(--text2)' }}>{label}</label>
            <input
              type="number"
              min={1}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <button
          type="button"
          onClick={() => setKeepAspect((v) => !v)}
          className={`w-8 h-5 rounded-full transition-colors ${keepAspect ? 'bg-blue-600' : 'bg-gray-600'}`}
        >
          <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${keepAspect ? 'translate-x-3' : 'translate-x-0.5'}`} />
        </button>
        <span className="text-xs" style={{ color: 'var(--text2)' }}>Manter proporção</span>
      </label>

      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={submitting || (!width && !height)}
        className="w-full py-2 text-sm rounded-lg disabled:opacity-50 transition-colors"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {submitting ? 'Enviando…' : 'Redimensionar'}
      </button>
    </div>
  )
}

// ── Ferramentas tab ───────────────────────────────────────────────────────────

function FerramentasTab({ onJobCreated }) {
  const [uploaded, setUploaded] = useState(null)
  const previewRef = useRef(null)

  const handleUploaded = (data) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = data.preview
    setUploaded(data)
  }

  const handleClear = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
    }
    setUploaded(null)
  }

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
  }, [])

  return (
    <div className="space-y-4">
      {!uploaded ? (
        <UploadZone onUploaded={handleUploaded} />
      ) : (
        <>
          <ImagePreview
            preview={uploaded.preview}
            info={uploaded.info}
            onClear={handleClear}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ConvertCard info={uploaded.info} onJobCreated={onJobCreated} />
            <CropCard    info={uploaded.info} preview={uploaded.preview} onJobCreated={onJobCreated} />
            <ResizeCard  info={uploaded.info} onJobCreated={onJobCreated} />
          </div>
        </>
      )}
    </div>
  )
}

// ── Histórico tab ─────────────────────────────────────────────────────────────

function HistoricoTab({ jobs, setJobs }) {
  const [loading, setLoading] = useState(true)
  const pollingRef = useRef(null)

  const fetchAll = useCallback(async () => {
    try {
      const { data } = await imageService.listJobs()
      setJobs(data.filter((j) => j.operation.startsWith('img_')))
    } finally {
      setLoading(false)
    }
  }, [setJobs])

  const pollActive = useCallback(async () => {
    const active = jobs.filter((j) => j.status === 'pending' || j.status === 'running')
    for (const job of active) {
      try {
        const { data } = await imageService.getJob(job.id)
        setJobs((prev) => prev.map((j) => (j.id === job.id ? data : j)))
      } catch { /* ignore */ }
    }
  }, [jobs, setJobs])

  useEffect(() => { fetchAll() }, [fetchAll])

  const hasActive = jobs.some((j) => j.status === 'pending' || j.status === 'running')
  useEffect(() => {
    if (hasActive) {
      pollingRef.current = setInterval(pollActive, 3000)
    } else {
      clearInterval(pollingRef.current)
    }
    return () => clearInterval(pollingRef.current)
  }, [hasActive, pollActive])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm" style={{ color: 'var(--text2)' }}>{jobs.length} job(s) no histórico</p>
        <button
          onClick={fetchAll}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <p className="text-sm animate-pulse" style={{ color: 'var(--text3)' }}>Carregando…</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text3)' }}>
          Nenhum job ainda. Envie uma imagem e execute uma operação.
        </p>
      ) : (
        jobs.map((job) => (
          <div
            key={job.id}
            className="p-4 rounded-xl border"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {OP_LABELS[job.operation] || job.operation}
                  </span>
                  <span className={`text-xs font-medium ${statusColor(job.status)}`}>
                    {statusLabel(job.status)}
                    {job.status === 'running' && (
                      <span className="ml-1 inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    )}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
                  {job.input_files?.join(', ')}
                </p>
                {job.error_msg && (
                  <p className="text-red-400 text-xs mt-1 truncate" title={job.error_msg}>
                    {job.error_msg}
                  </p>
                )}
                <p className="text-xs mt-1" style={{ color: 'var(--text3)', opacity: 0.7 }}>
                  {new Date(job.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              {job.status === 'done' && job.output_file && (
                <a
                  href={imageService.downloadUrl(job.id)}
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ImagesPage() {
  const [activeTab, setActiveTab] = useState('Ferramentas')
  const [jobs, setJobs] = useState([])

  const handleJobCreated = (job) => {
    setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)])
    setActiveTab('Histórico')
  }

  return (
    <div className="space-y-4">
      <PageHeader icon="ti-photo" title="Ferramentas de Imagem" />

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
              ${activeTab === tab
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent hover:text-gray-200'}`}
            style={activeTab !== tab ? { color: 'var(--text3)' } : {}}
          >
            {tab}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'Ferramentas' && (
          <FerramentasTab onJobCreated={handleJobCreated} />
        )}
        {activeTab === 'Histórico' && (
          <HistoricoTab jobs={jobs} setJobs={setJobs} />
        )}
      </div>
    </div>
  )
}
