import api from '@/services/api'

const base = '/radio'

export const radioService = {
  search:         (params)    => api.get(`${base}/search/`, { params }),
  top:            (limit = 20) => api.get(`${base}/top/`, { params: { limit } }),
  getFavorites:   ()          => api.get(`${base}/favorites/`),
  addFavorite:    (data)      => api.post(`${base}/favorites/`, data),
  removeFavorite: (uuid)      => api.delete(`${base}/favorites/${uuid}/`),
  click:          (uuid)      => api.post(`${base}/click/${uuid}/`),
}
