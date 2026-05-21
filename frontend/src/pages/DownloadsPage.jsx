import { useEffect, useRef, useState } from 'react'
import {
  Search, Download, Music, Film, X, Trash2,
  Loader2, Clock, CheckCircle2, AlertCircle,
  Ban, RefreshCw, ChevronDown,
} from 'lucide-react'
import useDownloadsStore from '@/stores/downloadsStore'
import { downloadsService } from '@/services/downloadsService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/utils/cn'
import { PageHeader } from '@/components/ui/PageHeader'

// ── status config ─────────────────────────────────────────────────────────────

const STATUS = {
  pending:   { label: 'Aguardando', icon: Clock,         color: 'text-gray-400',   bg: 'bg-gray-700/50' },
  running:   { label: 'Baixando',   icon: Loader2,       color: 'text-blue-400',   bg: 'bg-blue-900/30' },
  done:      { label: 'Concluído',  icon: CheckCircle2,  color: 'text-green-400',  bg: 'bg-green-900/30' },
  error:     { label: 'Erro',       icon: AlertCircle,   color: 'text-red-400',    bg: 'bg-red-900/30' },
  cancelled: { label: 'Cancelado',  icon: Ban,           color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
}

function StatusBadge({ s }) {
  const cfg = STATUS[s] ?? STATUS.pending
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.color)}>
      <Icon size={11} className={s === 'running' ? 'animate-spin' : ''} />
      {cfg.label}
    </span>
  )
}

// ── format helpers ────────────────────────────────────────────────────────────

function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

// ── info card ─────────────────────────────────────────────────────────────────

function InfoCard({ info, onDismiss }) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-gray-700 bg-gray-800/60 relative">
      {info.thumbnail && (
        <img
          src={info.thumbnail}
          alt={info.title}
          className="w-28 h-16 object-cover rounded shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-100 line-clamp-2">{info.title}</p>
        {info.uploader && <p className="text-xs text-gray-400 mt-0.5">{info.uploader}</p>}
        {info.duration_fmt && (
          <p className="text-xs text-gray-500 mt-0.5">
            <Clock size={11} className="inline mr-1" />{info.duration_fmt}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 text-gray-600 hover:text-gray-300"
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── new download form ─────────────────────────────────────────────────────────

function NewDownloadForm({ onCreated }) {
  const { createJob } = useDownloadsStore()
  const [url, setUrl]           = useState('')
  const [info, setInfo]         = useState(null)
  const [infoLoading, setInfoLoading] = useState(false)
  const [infoError, setInfoError]     = useState('')
  const [type, setType]         = useState('video')
  const [resolution, setResolution]   = useState('best')
  const [subtitles, setSubtitles]     = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState('')

  const fetchInfo = async () => {
    if (!url.trim()) return
    setInfoLoading(true)
    setInfoError('')
    setInfo(null)
    try {
      const { data } = await downloadsService.getUrlInfo(url.trim())
      setInfo(data)
      if (data.resolutions?.length) setResolution(data.resolutions[0])
    } catch (e) {
      setInfoError(e.response?.data?.detail ?? 'Erro ao buscar informações.')
    } finally {
      setInfoLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await createJob({
        url: url.trim(),
        title: info?.title ?? '',
        download_type: type,
        resolution: type === 'video' ? resolution : '',
        subtitles,
      })
      setUrl('')
      setInfo(null)
      setResolution('best')
      setSubtitles(false)
      onCreated?.()
    } catch (e) {
      setSubmitError(e.response?.data?.detail ?? 'Erro ao criar download.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Novo download</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL + buscar info */}
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setInfo(null); setInfoError('') }}
              placeholder="https://youtube.com/watch?v=... ou URL direta"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={fetchInfo}
              disabled={!url.trim() || infoLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 rounded-md transition-colors whitespace-nowrap"
            >
              {infoLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar info
            </button>
          </div>

          {/* info card */}
          {infoError && (
            <p className="text-xs text-red-400">{infoError}</p>
          )}
          {info && (
            <InfoCard info={info} onDismiss={() => setInfo(null)} />
          )}

          {/* type + options */}
          <div className="flex flex-wrap gap-4">
            {/* type selector */}
            <div className="flex gap-2">
              {[
                { v: 'video', label: 'Vídeo', icon: Film },
                { v: 'audio', label: 'Áudio (MP3)', icon: Music },
              ].map(({ v, label, icon: Icon }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setType(v)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors',
                    type === v
                      ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200',
                  )}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {/* resolution (only for video) */}
            {type === 'video' && (
              <div className="relative">
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="appearance-none bg-gray-800 border border-gray-700 rounded-md pl-3 pr-8 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="best">Melhor disponível</option>
                  {(info?.resolutions ?? []).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  {!info && ['2160p', '1440p', '1080p', '720p', '480p', '360p'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
            )}

            {/* subtitles */}
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={subtitles}
                onChange={(e) => setSubtitles(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
              />
              Baixar legendas
            </label>
          </div>

          {submitError && (
            <p className="text-xs text-red-400">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={!url.trim() || submitting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-md transition-colors"
          >
            {submitting
              ? <Loader2 size={15} className="animate-spin" />
              : <Download size={15} />}
            {submitting ? 'Enfileirando…' : 'Baixar'}
          </button>
        </form>
      </CardContent>
    </Card>
  )
}

// ── job card ──────────────────────────────────────────────────────────────────

function JobCard({ job }) {
  const { removeJob, updateJob } = useDownloadsStore()
  const [removing, setRemoving] = useState(false)

  // Polling: só para jobs running ou pending
  useEffect(() => {
    if (job.status !== 'running' && job.status !== 'pending') return
    const id = setInterval(async () => {
      try {
        const { data } = await downloadsService.getJob(job.id)
        updateJob(data)
      } catch {}
    }, 2000)
    return () => clearInterval(id)
  }, [job.id, job.status, updateJob])

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await removeJob(job.id)
    } catch {
      setRemoving(false)
    }
  }

  const displayName = job.title || job.url

  return (
    <div className="flex flex-col gap-2 p-4 rounded-lg border border-gray-800 bg-gray-900/60 hover:bg-gray-900 transition-colors">
      {/* header row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-100 truncate" title={displayName}>
            {displayName}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <StatusBadge s={job.status} />
            <span className="text-xs text-gray-500">
              {job.download_type === 'audio' ? 'MP3' : job.resolution || 'Vídeo'}
            </span>
            {job.file_size && (
              <span className="text-xs text-gray-500">{fmtSize(job.file_size)}</span>
            )}
          </div>
        </div>

        <button
          onClick={handleRemove}
          disabled={removing}
          title={job.status === 'running' ? 'Cancelar' : 'Remover'}
          className="shrink-0 p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-40"
        >
          {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>

      {/* progress bar (running only) */}
      {job.status === 'running' && (
        <div className="space-y-1">
          <Progress
            value={job.progress}
            indicatorClassName="bg-blue-500"
            className="h-1.5"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{job.progress.toFixed(1)}%</span>
            <span>
              {job.speed && job.eta
                ? `${job.speed} — ${job.eta}`
                : job.speed || job.eta || ''}
            </span>
          </div>
        </div>
      )}

      {/* error message */}
      {job.status === 'error' && job.error_msg && (
        <p className="text-xs text-red-400 bg-red-900/10 border border-red-900/30 rounded px-2 py-1">
          {job.error_msg}
        </p>
      )}

      {/* done: file path */}
      {job.status === 'done' && job.file_path && (
        <p className="text-xs text-gray-500 truncate font-mono" title={job.file_path}>
          {job.file_path}
        </p>
      )}
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function DownloadsPage() {
  const { jobs, isLoading, fetchJobs } = useDownloadsStore()

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const pending  = jobs.filter((j) => j.status === 'pending' || j.status === 'running')
  const finished = jobs.filter((j) => j.status === 'done' || j.status === 'error' || j.status === 'cancelled')

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <PageHeader icon="ti-download" title="Downloads" />
      <NewDownloadForm onCreated={fetchJobs} />

      {/* active jobs */}
      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Em andamento</h2>
          {pending.map((j) => <JobCard key={j.id} job={j} />)}
        </section>
      )}

      {/* finished jobs */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Histórico {finished.length > 0 && `(${finished.length})`}
          </h2>
          <button
            onClick={fetchJobs}
            className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
            title="Atualizar"
          >
            {isLoading
              ? <Loader2 size={14} className="animate-spin" />
              : <RefreshCw size={14} />}
          </button>
        </div>

        {finished.length === 0 && !isLoading && (
          <p className="text-sm text-gray-500">Nenhum download ainda.</p>
        )}

        {finished.map((j) => <JobCard key={j.id} job={j} />)}
      </section>
    </div>
  )
}
