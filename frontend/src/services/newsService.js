import api from './api'

export const newsService = {
  getNews:       ()         => api.get('/news/'),
  getFeeds:      ()         => api.get('/news/feeds/'),
  createFeed:    (data)     => api.post('/news/feeds/', data),
  updateFeed:    (id, data) => api.patch(`/news/feeds/${id}/`, data),
  deleteFeed:    (id)       => api.delete(`/news/feeds/${id}/`),
  refreshFeed:   (id)       => api.post(`/news/feeds/${id}/refresh/`),
}
