import { useEffect, useRef } from 'react'
import useRadioStore from '@/stores/radioStore'

export default function RadioPlayer() {
  const {
    currentStation, isPlaying, volume, isLoading, error,
    pause, resume, stop, setVolume,
  } = useRadioStore()

  const audioRef  = useRef(null)
  const lastSrcRef = useRef('')

  // Register audio event listeners once — use getState() to avoid stale closures
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const clearLoading = () => useRadioStore.getState().setIsLoading(false)
    const onError      = () => useRadioStore.getState().setError('Erro ao conectar ao stream.')
    const onWaiting    = () => useRadioStore.getState().setIsLoading(true)

    audio.addEventListener('error',    onError)
    audio.addEventListener('waiting',  onWaiting)
    // 'playing' fires when playback starts/resumes after buffering.
    // 'canplay' fires earlier (enough data to start) — used as fallback for
    // live streams where 'playing' may not fire in all browsers.
    audio.addEventListener('playing',  clearLoading)
    audio.addEventListener('canplay',  clearLoading)
    return () => {
      audio.removeEventListener('error',    onError)
      audio.removeEventListener('waiting',  onWaiting)
      audio.removeEventListener('playing',  clearLoading)
      audio.removeEventListener('canplay',  clearLoading)
    }
  }, [])

  // React to station / isPlaying changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!currentStation) {
      audio.pause()
      audio.src = ''
      lastSrcRef.current = ''
      return
    }

    if (lastSrcRef.current !== currentStation.url) {
      audio.pause()
      audio.src = currentStation.url
      audio.load()
      lastSrcRef.current = currentStation.url
    }

    if (isPlaying) {
      const p = audio.play()
      if (p) {
        p.then(() => useRadioStore.getState().setIsLoading(false))
         .catch((e) => {
           if (e.name !== 'AbortError') {
             useRadioStore.getState().setError('Não foi possível reproduzir o stream.')
           }
         })
      }
    } else {
      audio.pause()
    }
  }, [currentStation?.station_uuid, isPlaying])

  // Sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  if (!currentStation) return null

  return (
    <div className="radio-bar h-[72px] shrink-0 border-t border-gray-700 bg-gray-900 flex items-center gap-3 px-4">
      {/* Hidden audio — lives here permanently, never unmounted */}
      <audio ref={audioRef} preload="none" />

      {/* Favicon */}
      <div className="relative w-10 h-10 shrink-0 rounded overflow-hidden bg-gray-700 flex items-center justify-center">
        <span className="text-xl absolute select-none">📻</span>
        {currentStation.favicon && (
          <img
            src={currentStation.favicon}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        )}
      </div>

      {/* Station info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate leading-tight">
          {currentStation.name}
        </p>
        <p className="text-xs text-gray-400 truncate">
          {error ? (
            <span className="text-red-400">{error}</span>
          ) : (
            [currentStation.country, currentStation.language].filter(Boolean).join(' · ') || 'Tocando...'
          )}
        </p>
      </div>

      {/* Play / Pause */}
      <button
        onClick={isPlaying ? pause : resume}
        disabled={isLoading && !error}
        className="w-10 h-10 shrink-0 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center transition-colors"
        title={isPlaying ? 'Pausar' : 'Retomar'}
      >
        {isLoading && !error ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : isPlaying ? (
          <span className="text-white text-sm leading-none">⏸</span>
        ) : (
          <span className="text-white text-sm leading-none pl-0.5">▶</span>
        )}
      </button>

      {/* Volume */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-gray-400 text-xs select-none">
          {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-20 accent-blue-500 cursor-pointer"
        />
      </div>

      {/* Stop */}
      <button
        onClick={stop}
        className="w-8 h-8 shrink-0 flex items-center justify-center text-gray-500 hover:text-white transition-colors rounded"
        title="Parar"
      >
        ⏹
      </button>
    </div>
  )
}
