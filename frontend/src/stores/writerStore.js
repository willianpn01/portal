import { create } from 'zustand'
import { writerService } from '@/services/writerService'

const useWriterStore = create((set, get) => ({
  project: null,
  chapter: null,
  autosaveStatus: 'idle',   // 'idle' | 'saving' | 'saved' | 'error'
  lastSavedAt: null,        // Date object
  exportStatus: 'idle',     // 'idle' | 'exporting' | 'done' | 'error'
  exportTaskId: null,
  exportUrl: null,

  // Focus mode
  focusMode: false,

  // Search bar
  searchOpen: false,
  searchTerm: '',
  replaceTerm: '',

  // AI correction
  isCorrectingSpelling: false,
  spellingResult: null,
  showSpellingModal: false,

  setProject: (project) => set({ project }),
  setChapter: (chapter) => set({ chapter }),
  setAutosaveStatus: (autosaveStatus) => set({ autosaveStatus }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
  setExportState: (patch) => set(patch),
  setFocusMode: (focusMode) => set({ focusMode }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setReplaceTerm: (replaceTerm) => set({ replaceTerm }),
  setIsCorrectingSpelling: (v) => set({ isCorrectingSpelling: v }),
  setSpellingResult: (v) => set({ spellingResult: v }),
  setShowSpellingModal: (v) => set({ showSpellingModal: v }),

  doAutosave: async (chapterId, html) => {
    set({ autosaveStatus: 'saving' })
    try {
      await writerService.autosave(chapterId, html)
      set({ autosaveStatus: 'saved', lastSavedAt: new Date() })
    } catch {
      set({ autosaveStatus: 'error' })
    }
  },
}))

export default useWriterStore
