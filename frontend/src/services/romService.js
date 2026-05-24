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
  // Save states
  getSaveStates:   (romId)              => api.get(`${base}/${romId}/savestates/`).then(r => r.data),
  deleteSaveState: (romId, slot)        => api.delete(`${base}/${romId}/savestates/${slot}/`),
  saveSaveState:   (romId, slot, stateBlob, screenshotBlob) => {
    const form = new FormData()
    form.append('state', stateBlob, 'state.bin')
    if (screenshotBlob) form.append('screenshot', screenshotBlob, 'screenshot.png')
    // Content-Type: undefined removes the global 'application/json' default so
    // the browser sets 'multipart/form-data; boundary=...' automatically.
    return api.post(`${base}/${romId}/savestates/${slot}/`, form, {
      headers: { 'Content-Type': undefined },
    })
  },
  saveStateDownloadUrl: (romId, slot) => `/api${base}/${romId}/savestates/${slot}/download/`,
}
