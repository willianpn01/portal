import api from '@/services/api'

const base = '/roms'

export const romService = {
  // Scan / rescrape
  startScan:    (roms_path) => api.post(`${base}/scan/`, { roms_path }),
  getScanJob:   (id)        => api.get(`${base}/scan/${id}/`),
  rescrape:     ()           => api.post(`${base}/rescrape/`),
  // Platforms
  getPlatforms: ()          => api.get(`${base}/platforms/`),
  // ROMs
  getROMs:      (params)    => api.get(`${base}/`, { params }),
  getROM:       (id)        => api.get(`${base}/${id}/`),
  updateROM:    (id, data)  => api.patch(`${base}/${id}/`, data),
  registerPlay: (id)        => api.post(`${base}/${id}/play/`),
  coverUrl:     (id)        => `/api${base}/${id}/cover/`,
  fileUrl:      (id)        => `/api${base}/${id}/file/`,
}
