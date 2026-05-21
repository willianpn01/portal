import api from '@/services/api'

const base = '/files'

export const fileManagerService = {
  getRoots:    ()               => api.get(`${base}/roots/`),
  createRoot:  (label, path)   => api.post(`${base}/roots/`, { label, path }),
  toggleRoot:  (id, is_active) => api.patch(`${base}/roots/${id}/`, { is_active }),
  deleteRoot:  (id)            => api.delete(`${base}/roots/${id}/`),

  listDirectory: (rootId, path = '') =>
    api.get(`${base}/list/`, { params: { root: rootId, path } }),

  download: (rootId, path) =>
    `${base}/download/?root=${rootId}&path=${encodeURIComponent(path)}`,

  upload: (rootId, path, file) => {
    const form = new FormData()
    form.append('root', rootId)
    form.append('path', path)
    form.append('file', file)
    return api.post(`${base}/upload/`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  operation: (payload) =>
    api.post(`${base}/operation/`, payload),

  zip: (rootId, paths, destination) =>
    api.post(`${base}/zip/`, { root: rootId, paths, destination }),

  unzip: (rootId, path, destination = '') =>
    api.post(`${base}/unzip/`, { root: rootId, path, destination }),

  preview: (rootId, path) =>
    api.get(`${base}/preview/`, { params: { root: rootId, path } }),
}
