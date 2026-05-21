import { create } from 'zustand'
import { newsService } from '@/services/newsService'

const useNewsStore = create((set, get) => ({
  feeds:     [],
  allFeeds:  [],
  isLoading: false,
  error:     null,

  fetchNews: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await newsService.getNews()
      set({ feeds: data })
    } catch {
      set({ error: 'Erro ao carregar notícias.' })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchAllFeeds: async () => {
    const { data } = await newsService.getFeeds()
    set({ allFeeds: data })
  },

  createFeed: async (feedData) => {
    const { data } = await newsService.createFeed(feedData)
    set((s) => ({ allFeeds: [...s.allFeeds, data] }))
    return data
  },

  updateFeed: async (id, feedData) => {
    const { data } = await newsService.updateFeed(id, feedData)
    set((s) => ({
      allFeeds: s.allFeeds.map((f) => (f.id === id ? data : f)),
    }))
    return data
  },

  deleteFeed: async (id) => {
    await newsService.deleteFeed(id)
    set((s) => ({ allFeeds: s.allFeeds.filter((f) => f.id !== id) }))
  },

  refreshFeed: async (id) => {
    await newsService.refreshFeed(id)
    await get().fetchNews()
  },
}))

export default useNewsStore
