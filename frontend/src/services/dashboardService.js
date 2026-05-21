import api from '@/services/api'

export const dashboardService = {
  getStats: () => api.get('/dashboard/'),
}
