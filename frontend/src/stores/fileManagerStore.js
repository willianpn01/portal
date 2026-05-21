import { create } from 'zustand'
import { fileManagerService } from '@/services/fileManagerService'

const useFileManagerStore = create((set, get) => ({
  roots: [],
  activeRoot: null,
  currentPath: '',
  items: [],
  isLoading: false,
  error: null,

  fetchRoots: async () => {
    try {
      const { data } = await fileManagerService.getRoots()
      const active = data.filter((r) => r.is_active)
      set({ roots: active })
      if (active.length > 0 && !get().activeRoot) {
        get().setActiveRoot(active[0])
      }
    } catch (err) {
      set({ error: err.message })
    }
  },

  setActiveRoot: (root) => {
    set({ activeRoot: root, currentPath: '', items: [] })
    get().refresh()
  },

  navigate: (path) => {
    set({ currentPath: path })
    get().refresh()
  },

  goUp: () => {
    const { currentPath } = get()
    if (!currentPath) return
    const parent = currentPath.includes('/')
      ? currentPath.substring(0, currentPath.lastIndexOf('/'))
      : ''
    get().navigate(parent)
  },

  refresh: async () => {
    const { activeRoot, currentPath } = get()
    if (!activeRoot) return
    set({ isLoading: true, error: null })
    try {
      const { data } = await fileManagerService.listDirectory(activeRoot.id, currentPath)
      set({ items: data.items, isLoading: false })
    } catch (err) {
      set({ error: err.message, isLoading: false })
    }
  },
}))

export default useFileManagerStore
