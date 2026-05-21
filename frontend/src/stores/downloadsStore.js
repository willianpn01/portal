import { create } from 'zustand'
import { downloadsService } from '@/services/downloadsService'

const useDownloadsStore = create((set, get) => ({
  jobs: [],
  isLoading: false,

  fetchJobs: async () => {
    set({ isLoading: true })
    try {
      const { data } = await downloadsService.getJobs()
      set({ jobs: data, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  createJob: async (payload) => {
    const { data } = await downloadsService.createJob(payload)
    set((s) => ({ jobs: [data, ...s.jobs] }))
    return data
  },

  removeJob: async (id) => {
    await downloadsService.deleteJob(id)
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }))
  },

  updateJob: (updated) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === updated.id ? updated : j)),
    })),
}))

export default useDownloadsStore
