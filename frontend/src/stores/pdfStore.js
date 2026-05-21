import { create } from 'zustand'
import { pdfService } from '@/services/pdfService'

const usePdfStore = create((set, get) => ({
  files: [],
  jobs: [],
  isLoadingFiles: false,
  isLoadingJobs: false,

  fetchFiles: async () => {
    set({ isLoadingFiles: true })
    try {
      const { data } = await pdfService.listWorkspace()
      set({ files: data, isLoadingFiles: false })
    } catch {
      set({ isLoadingFiles: false })
    }
  },

  uploadFile: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await pdfService.uploadFile(form)
    set((s) => ({ files: [data, ...s.files] }))
    return data
  },

  deleteFile: async (filename) => {
    await pdfService.deleteFile(filename)
    set((s) => ({ files: s.files.filter((f) => f.filename !== filename) }))
  },

  fetchJobs: async () => {
    set({ isLoadingJobs: true })
    try {
      const { data } = await pdfService.getJobs()
      set({ jobs: data, isLoadingJobs: false })
    } catch {
      set({ isLoadingJobs: false })
    }
  },

  createJob: async (payload) => {
    const { data } = await pdfService.createJob(payload)
    set((s) => ({ jobs: [data, ...s.jobs] }))
    return data
  },

  updateJob: (updated) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === updated.id ? updated : j)),
    })),
}))

export default usePdfStore
