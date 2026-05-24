import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import useRomStore from '@/stores/romStore'

const PLATFORM_COLORS = {
  nes:       'bg-red-900',
  snes:      'bg-purple-900',
  gb:        'bg-gray-700',
  gbc:       'bg-green-900',
  gba:       'bg-indigo-900',
  megadrive: 'bg-blue-900',
}

// ── Compact ROM item ──────────────────────────────────────────────────────────

function ROMItem({ rom, isSelected, onClick }) {
  const slug = rom.platform?.slug || ''
  return (
    <button
      onClick={() => onClick(rom)}
      className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors ${
        isSelected
          ? 'bg-blue-900/60 border border-blue-600/70'
          : 'hover:bg-gray-700/60 border border-transparent'
      }`}
    >
      <div className={`w-9 h-12 shrink-0 rounded overflow-hidden flex items-center justify-center ${PLATFORM_COLORS[slug] || 'bg-gray-700'}`}>
        {rom.cover_url ? (
          <img src={rom.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-xs font-black text-white/30 select-none">
            {slug.toUpperCase().slice(0, 3)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-200 font-medium truncate leading-snug">{rom.title}</p>
        <p className="text-xs text-gray-500 truncate">
          {rom.platform?.name?.split(' ').slice(0, 2).join(' ')}
          {rom.is_favorite && ' ⭐'}
        </p>
      </div>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RetroPage() {
  const { roms, platforms, filters, pagination, isLoading, fetchROMs, fetchPlatforms, setFilters, loadMore } = useRomStore()
  const [selectedRom, setSelectedRom] = useState(null)
  const [iframeKey, setIframeKey]     = useState(0)
  const debounceRef = useRef(null)

  useEffect(() => {
    fetchPlatforms()
    if (roms.length === 0) fetchROMs(1)
  }, [])

  const handleSelect = (rom) => {
    setSelectedRom(rom)
    setIframeKey((k) => k + 1)
  }

  const handleSearch = (e) => {
    clearTimeout(debounceRef.current)
    const val = e.target.value
    debounceRef.current = setTimeout(() => setFilters({ search: val }), 400)
  }

  return (
    <div className="flex overflow-hidden w-screen h-screen">

      {/* Left panel — ROM list */}
      <div className="w-72 shrink-0 flex flex-col border-r border-gray-700 bg-gray-900/80">
        {/* Back nav */}
        <div className="px-3 pt-3 pb-1">
          <Link to="/roms" className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
            ← ROMs
          </Link>
        </div>
        {/* Filters */}
        <div className="p-3 border-b border-gray-700 space-y-2">
          <input
            type="text"
            placeholder="Buscar ROM..."
            defaultValue={filters.search}
            onChange={handleSearch}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
          <select
            value={filters.platform || ''}
            onChange={(e) => setFilters({ platform: e.target.value || null })}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">Todas as plataformas</option>
            {platforms.filter((p) => (p.rom_count || 0) > 0).map((p) => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {isLoading && roms.length === 0 ? (
            <p className="text-gray-500 text-xs p-3">Carregando...</p>
          ) : roms.length === 0 ? (
            <p className="text-gray-500 text-xs p-3">
              Nenhuma ROM. Vá em ROM Library → Escanear ROMs.
            </p>
          ) : (
            <>
              {roms.map((rom) => (
                <ROMItem
                  key={rom.id}
                  rom={rom}
                  isSelected={selectedRom?.id === rom.id}
                  onClick={handleSelect}
                />
              ))}
              {pagination.hasNext && (
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="w-full text-xs text-blue-400 hover:text-blue-300 py-2 text-center disabled:opacity-50"
                >
                  Carregar mais...
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right panel — emulator */}
      <div className="flex-1 bg-black flex flex-col items-center justify-center overflow-hidden">
        {selectedRom ? (
          <iframe
            key={iframeKey}
            src={`/retro/play/${selectedRom.id}`}
            className="w-full h-full border-0"
            title={selectedRom.title}
            allow="fullscreen; autoplay"
          />
        ) : (
          <div className="text-center space-y-3 select-none">
            <p className="text-6xl">🕹️</p>
            <p className="text-gray-400 text-sm">Selecione uma ROM para jogar</p>
            <p className="text-gray-600 text-xs">ou abra em tela cheia pela ROM Library</p>
          </div>
        )}
      </div>
    </div>
  )
}
