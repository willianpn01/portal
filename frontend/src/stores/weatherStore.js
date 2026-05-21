import { create } from 'zustand'
import { weatherService } from '@/services/weatherService'

const useWeatherStore = create((set) => ({
  weather:       null,
  error:         null,
  isLoading:     false,
  lastFetchedAt: null,

  fetchWeather: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await weatherService.getWeather()
      if (data.error) {
        set({ weather: null, error: data.error })
      } else {
        set({ weather: data, error: null, lastFetchedAt: Date.now() })
      }
    } catch {
      set({ error: 'Erro ao carregar clima.' })
    } finally {
      set({ isLoading: false })
    }
  },
}))

export default useWeatherStore
