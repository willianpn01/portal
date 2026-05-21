import { create } from 'zustand'
import { radioService } from '@/services/radioService'

// Normalize a station object from either Radio Browser API or our favorites API
function normalize(station) {
  return {
    station_uuid: station.station_uuid || station.stationuuid || '',
    name:         station.name         || '',
    url:          station.url_resolved || station.url || '',
    favicon:      station.favicon      || '',
    country:      station.country      || '',
    language:     station.language     || '',
    tags:         station.tags         || '',
  }
}

const useRadioStore = create((set, get) => ({
  currentStation: null,
  isPlaying:      false,
  volume:         0.8,
  isLoading:      false,
  error:          null,
  favorites:      [],

  play: (station) => set({
    currentStation: normalize(station),
    isPlaying:      true,
    error:          null,
    isLoading:      true,
  }),

  pause:     () => set({ isPlaying: false }),
  resume:    () => set({ isPlaying: true }),
  stop:      () => set({ currentStation: null, isPlaying: false, isLoading: false, error: null }),
  setVolume: (v) => set({ volume: v }),
  setError:  (error) => set({ error, isPlaying: false, isLoading: false }),
  setIsLoading: (v) => set({ isLoading: v }),

  fetchFavorites: async () => {
    try {
      const { data } = await radioService.getFavorites()
      set({ favorites: data })
    } catch { /* ignore */ }
  },

  addFavorite: async (station) => {
    const payload = normalize(station)
    try {
      const { data } = await radioService.addFavorite(payload)
      set((s) => ({
        favorites: [data, ...s.favorites.filter((f) => f.station_uuid !== payload.station_uuid)],
      }))
    } catch { /* ignore */ }
  },

  removeFavorite: async (uuid) => {
    try {
      await radioService.removeFavorite(uuid)
      set((s) => ({ favorites: s.favorites.filter((f) => f.station_uuid !== uuid) }))
    } catch { /* ignore */ }
  },
}))

export default useRadioStore
