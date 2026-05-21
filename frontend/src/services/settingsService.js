import api from './api'

export const settingsService = {
  getSettings: ()     => api.get('/settings/'),
  saveSettings: (data) => api.put('/settings/', data),
}
