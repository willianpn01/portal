import { create } from 'zustand'
import { romService } from '@/services/romService'

const useRomStore = create((set, get) => ({
  roms:       [],
  platforms:  [],
  filters:    { platform: null, search: '', favoritesOnly: false, ordering: 'title' },
  scanJob:    null,
  pagination: { page: 1, count: 0, hasNext: false },
  isLoading:  false,

  setFilters: (patch) => {
    set((s) => ({
      filters:    { ...s.filters, ...patch },
      roms:       [],
      pagination: { page: 1, count: 0, hasNext: false },
    }))
    get().fetchROMs(1)
  },

  fetchPlatforms: async () => {
    try {
      const { data } = await romService.getPlatforms()
      set({ platforms: data })
    } catch { /* ignore */ }
  },

  fetchROMs: async (page = 1) => {
    set({ isLoading: true })
    const { filters } = get()
    const params = {
      page,
      ordering: filters.ordering,
      ...(filters.platform    && { platform:  filters.platform }),
      ...(filters.search      && { search:    filters.search }),
      ...(filters.favoritesOnly && { favorites: '1' }),
    }
    try {
      const { data } = await romService.getROMs(params)
      set((s) => ({
        roms:       page === 1 ? data.results : [...s.roms, ...data.results],
        pagination: { page, count: data.count, hasNext: data.has_next },
        isLoading:  false,
      }))
    } catch {
      set({ isLoading: false })
    }
  },

  loadMore: () => {
    const { pagination, isLoading } = get()
    if (!isLoading && pagination.hasNext) {
      get().fetchROMs(pagination.page + 1)
    }
  },

  toggleFavorite: async (id) => {
    const rom = get().roms.find((r) => r.id === id)
    if (!rom) return
    const newVal = !rom.is_favorite
    set((s) => ({ roms: s.roms.map((r) => r.id === id ? { ...r, is_favorite: newVal } : r) }))
    try {
      await romService.updateROM(id, { is_favorite: newVal })
    } catch {
      set((s) => ({ roms: s.roms.map((r) => r.id === id ? { ...r, is_favorite: !newVal } : r) }))
    }
  },

  startScan: async (roms_path) => {
    const { data } = await romService.startScan(roms_path)
    set({ scanJob: data })
    return data
  },

  pollScanJob: async (jobId) => {
    try {
      const { data } = await romService.getScanJob(jobId)
      set({ scanJob: data })
      return data
    } catch {
      return null
    }
  },
}))

export default useRomStore
