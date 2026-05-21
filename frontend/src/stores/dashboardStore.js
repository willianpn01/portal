import { create } from 'zustand'
import { dashboardService } from '@/services/dashboardService'

const useDashboardStore = create((set) => ({
  systemStats: null,
  datetime: null,
  isLoading: false,
  error: null,

  fetchStats: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await dashboardService.getStats()
      set({ systemStats: data.system, datetime: data.datetime, isLoading: false })
    } catch (err) {
      set({ error: err.message, isLoading: false })
    }
  },
}))

export default useDashboardStore
