import { useEffect, useRef, useState } from 'react'
import { radioService } from '@/services/radioService'
import useRadioStore from '@/stores/radioStore'
import { PageHeader } from '@/components/ui/PageHeader'

const TABS = ['Descobrir', 'Favoritos']

// ── Station Card ──────────────────────────────────────────────────────────────

function StationCard({ station, isFavorite, isActive, isBuffering, onPlay, onToggleFavorite }) {
  const uuid    = station.station_uuid || station.stationuuid
  const country = station.country || ''
  const tags    = station.tags    || ''
  const info    = [country, tags].filter(Boolean).join(' · ')

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-800/60 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors">
      {/* Favicon */}
      <div className="relative w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-gray-700 flex items-center justify-center">
        <span className="text-lg absolute select-none">📻</span>
        {station.favicon && (
          <img
            src={station.favicon}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 font-medium truncate">{station.name}</p>
        {info && <p className="text-xs text-gray-500 truncate">{info}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onPlay(station)}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors text-xs ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white'
          }`}
          title="Tocar"
        >
          {isBuffering ? (
            <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
          ) : isActive ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => onToggleFavorite(station, uuid)}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors text-base ${
            isFavorite
              ? 'text-red-400 hover:text-red-300'
              : 'text-gray-600 hover:text-red-400'
          }`}
          title={isFavorite ? 'Remover favorito' : 'Favoritar'}
        >
          {isFavorite ? '♥' : '♡'}
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RadioPage() {
  const [activeTab, setActiveTab]       = useState('Descobrir')
  const [topStations, setTopStations]   = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [searchQuery, setSearchQuery]   = useState('')
  const [loadingTop, setLoadingTop]     = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)

  const {
    currentStation, isPlaying, isLoading,
    play, pause, resume, favorites,
    fetchFavorites, addFavorite, removeFavorite,
  } = useRadioStore()

  const debounceRef = useRef(null)

  useEffect(() => {
    setLoadingTop(true)
    radioService.top(30)
      .then(({ data }) => setTopStations(data))
      .catch(() => {})
      .finally(() => setLoadingTop(false))
    fetchFavorites()
  }, [])

  const handleSearch = (e) => {
    const q = e.target.value
    setSearchQuery(q)
    clearTimeout(debounceRef.current)
    if (!q.trim()) {
      setSearchResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoadingSearch(true)
      try {
        const { data } = await radioService.search({ name: q.trim(), limit: 30 })
        setSearchResults(data)
      } catch { /* ignore */ }
      setLoadingSearch(false)
    }, 400)
  }

  const handlePlay = (station) => {
    const uuid = station.station_uuid || station.stationuuid
    if (currentStation?.station_uuid === uuid) {
      isPlaying ? pause() : resume()
    } else {
      play(station)
      radioService.click(uuid).catch(() => {})
    }
  }

  const handleToggleFavorite = (station, uuid) => {
    const fav = favorites.some((f) => f.station_uuid === uuid)
    fav ? removeFavorite(uuid) : addFavorite(station)
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    if (tab === 'Favoritos') fetchFavorites()
  }

  const displayedStations = searchQuery.trim() ? searchResults : topStations
  const isSearching = loadingSearch

  return (
    <div className="space-y-4">
      <PageHeader icon="ti-radio" title="Rádio Online" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab}
            {tab === 'Favoritos' && favorites.length > 0 && (
              <span className="ml-1.5 text-xs bg-gray-700 text-gray-300 rounded-full px-1.5 py-0.5">
                {favorites.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Discover */}
      {activeTab === 'Descobrir' && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Buscar estação de rádio..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
          />

          <p className="text-gray-600 text-xs">
            {isSearching
              ? 'Buscando...'
              : searchQuery.trim()
                ? `${searchResults.length} resultado(s) para "${searchQuery}"`
                : loadingTop
                  ? 'Carregando estações populares...'
                  : `${topStations.length} estações mais votadas`}
          </p>

          <div className="space-y-2">
            {displayedStations.map((station) => {
              const uuid = station.station_uuid || station.stationuuid
              const isActive    = currentStation?.station_uuid === uuid && isPlaying
              const isBuffering = currentStation?.station_uuid === uuid && isLoading
              return (
                <StationCard
                  key={uuid}
                  station={station}
                  isFavorite={favorites.some((f) => f.station_uuid === uuid)}
                  isActive={isActive}
                  isBuffering={isBuffering}
                  onPlay={handlePlay}
                  onToggleFavorite={handleToggleFavorite}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Favorites */}
      {activeTab === 'Favoritos' && (
        <div className="space-y-2">
          {favorites.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <p className="text-4xl select-none">♡</p>
              <p className="text-gray-500 text-sm">Nenhum favorito ainda.</p>
              <p className="text-gray-600 text-xs">Clique em ♡ em qualquer estação para salvar.</p>
            </div>
          ) : (
            favorites.map((station) => {
              const uuid = station.station_uuid
              const isActive    = currentStation?.station_uuid === uuid && isPlaying
              const isBuffering = currentStation?.station_uuid === uuid && isLoading
              return (
                <StationCard
                  key={uuid}
                  station={station}
                  isFavorite={true}
                  isActive={isActive}
                  isBuffering={isBuffering}
                  onPlay={handlePlay}
                  onToggleFavorite={handleToggleFavorite}
                />
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
