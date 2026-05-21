import api from './api'

export const weatherService = {
  getWeather: () => api.get('/weather/'),
}
