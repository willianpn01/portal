import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useRomStore from '@/stores/romStore'
import { romService } from '@/services/romService'
import { PageHeader } from '@/components/ui/PageHeader'

const PLATFORM_COLORS = {
  nes:       'bg-red-900',
  snes:      'bg-purple-900',
  gb:        'bg-gray-700',
  gbc:       'bg-green-900',
  gba:       'bg-indigo-900',
  megadrive: 'bg-blue-900',
}

const SORT_OPTIONS = [
  { value: 'title',        label: 'A-Z' },
  { value: '-play_count',  label: 'Mais jogados' },
  { value: '-last_played', label: 'Recentes' },
  { value: '-created_at',  label: 'Mais novos' },
]

// ── Scan Modal ────────────────────────────────────────────────────────────────

function ScanModal({ onClose, onDone }) {
  const [pathInput, setPathInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const { scanJob, startScan, pollScanJob } = useRomStore()
  const intervalRef = useRef(null)

  const handleStart = async () => {
    if (!pathInput.trim()) { setError('Informe o caminho do diretório.'); return }
    setError('')
    setSubmitting(true)
    try {
      const job = await startScan(pathInput.trim())
      intervalRef.current = setInterval(async () => {
        const updated = await pollScanJob(job.id)
        if (updated?.status === 'done' || updated?.status === 'error') {
          clearInterval(intervalRef.current)
          if (updated.status === 'done') onDone()
        }
      }, 2000)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao iniciar scan.')
      setSubmitting(false)
    }
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  const isRunning = scanJob?.status === 'pending' || scanJob?.status === 'running'
  const isDone    = scanJob?.status === 'done'
  const isError   = scanJob?.status === 'error'
  const showForm  = !scanJob || isError

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
        <div className="p-5 border-b border-gray-700">
          <h2 className="text-white font-semibold">Escanear ROMs</h2>
          <p className="text-gray-400 text-xs mt-1">
            Busca recursivamente ROMs no diretório informado.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {showForm ? (
            <>
              <input
                type="text"
                placeholder="/home/user/roms  ou  C:\ROMs"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                disabled={submitting}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              {isError && <p className="text-red-400 text-sm">{scanJob.error_msg}</p>}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Encontrados</span>
                <span className="text-white font-medium">{scanJob.total_found}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Novos</span>
                <span className="text-green-400 font-medium">{scanJob.total_new}</span>
              </div>
              {scanJob.current_file && (
                <p className="text-gray-500 text-xs truncate">
                  Processando: {scanJob.current_file}
                </p>
              )}
              {isRunning && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-blue-400 text-xs">Escaneando...</span>
                </div>
              )}
              {isDone && (
                <p className="text-green-400 text-sm font-medium">Scan concluído!</p>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-700 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {isDone ? 'Fechar' : 'Cancelar'}
          </button>
          {showForm && (
            <button
              onClick={handleStart}
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {submitting ? 'Iniciando...' : 'Iniciar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ROM Card ──────────────────────────────────────────────────────────────────

function ROMCard({ rom, onToggleFavorite }) {
  const navigate = useNavigate()
  const slug = rom.platform?.slug || ''
  const bg   = PLATFORM_COLORS[slug] || 'bg-gray-800'

  return (
    <div
      onClick={() => navigate(`/retro/play/${rom.id}`)}
      className="group relative bg-gray-800 border border-gray-700 rounded-xl overflow-hidden cursor-pointer hover:border-gray-500 hover:scale-[1.02] transition-all duration-150"
    >
      {/* Cover */}
      <div className={`aspect-[3/4] relative overflow-hidden ${bg}`}>
        {rom.cover_url ? (
          <img
            src={rom.cover_url}
            alt={rom.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-black text-white/20 select-none">
              {slug.toUpperCase().slice(0, 3)}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-xs text-gray-200 font-medium leading-tight truncate">{rom.title}</p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-gray-500 truncate">{rom.platform?.name?.split(' ').slice(0, 2).join(' ')}</span>
          {rom.play_count > 0 && (
            <span className="text-xs text-gray-600 shrink-0">{rom.play_count}×</span>
          )}
        </div>
      </div>

      {/* Favorite toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(rom.id) }}
        className={`absolute top-1.5 right-1.5 text-base leading-none transition-opacity ${
          rom.is_favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-80'
        }`}
        title={rom.is_favorite ? 'Remover favorito' : 'Favoritar'}
      >
        {rom.is_favorite ? '⭐' : '☆'}
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RomsPage() {
  const {
    roms, platforms, filters, pagination, isLoading,
    fetchROMs, fetchPlatforms, toggleFavorite, setFilters, loadMore,
  } = useRomStore()
  const [showScan, setShowScan] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const debounceRef = useRef(null)

  const toast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const handleRescrape = async () => {
    try {
      const { data } = await romService.rescrape()
      if (data.total === 0) {
        toast('Nenhuma ROM sem metadata encontrada.')
      } else {
        toast(`Buscando metadata para ${data.total} ROM${data.total !== 1 ? 's' : ''}…`)
      }
    } catch {
      toast('Erro ao iniciar re-scraping.')
    }
  }

  useEffect(() => {
    fetchPlatforms()
    fetchROMs(1)
  }, [])

  const handleSearch = (e) => {
    clearTimeout(debounceRef.current)
    const val = e.target.value
    debounceRef.current = setTimeout(() => setFilters({ search: val }), 400)
  }

  const handleScanDone = () => {
    fetchROMs(1)
    fetchPlatforms()
    setShowScan(false)
  }

  const activePlatforms = platforms.filter((p) => (p.rom_count || 0) > 0)

  return (
    <div className="space-y-4">
      <PageHeader icon="ti-device-gamepad-2" title="ROM Library">
        <button
          onClick={handleRescrape}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-sm rounded-lg transition-colors"
          style={{ color: 'var(--text)' }}
          title="Busca metadata no TheGamesDB para ROMs sem informações"
        >
          Atualizar metadata
        </button>
        <button
          onClick={() => setShowScan(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
        >
          Escanear ROMs
        </button>
      </PageHeader>

      {/* Platform tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilters({ platform: null })}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${
            !filters.platform
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Todos
        </button>
        {activePlatforms.map((p) => (
          <button
            key={p.slug}
            onClick={() => setFilters({ platform: p.slug })}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filters.platform === p.slug
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {p.name.split(' ').slice(0, 2).join(' ')} ({p.rom_count})
          </button>
        ))}
      </div>

      {/* Search + controls */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="text"
          placeholder="Buscar por título..."
          defaultValue={filters.search}
          onChange={handleSearch}
          className="flex-1 min-w-48 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => setFilters({ favoritesOnly: !filters.favoritesOnly })}
          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
            filters.favoritesOnly
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          ⭐ Favoritos
        </button>
        <select
          value={filters.ordering}
          onChange={(e) => setFilters({ ordering: e.target.value })}
          className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {isLoading && roms.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">Carregando...</p>
      ) : roms.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-4xl">🎮</p>
          <p className="text-gray-500 text-sm">Nenhuma ROM encontrada.</p>
          <p className="text-gray-600 text-xs">Use "Escanear ROMs" para catalogar seu diretório.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {roms.map((rom) => (
              <ROMCard key={rom.id} rom={rom} onToggleFavorite={toggleFavorite} />
            ))}
          </div>

          {pagination.hasNext && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={isLoading}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 text-sm rounded-lg transition-colors"
              >
                {isLoading ? 'Carregando...' : `Carregar mais (${pagination.count - roms.length} restantes)`}
              </button>
            </div>
          )}
        </>
      )}

      {showScan && (
        <ScanModal onClose={() => setShowScan(false)} onDone={handleScanDone} />
      )}

      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm shadow-xl z-50" style={{ color: 'var(--text)' }}>
          {toastMsg}
        </div>
      )}
    </div>
  )
}
