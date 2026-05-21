import api from '@/services/api'

const base = '/pdf'

export const pdfService = {
  uploadFile:   (formData) => api.post(`${base}/upload/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  listWorkspace:  ()           => api.get(`${base}/workspace/`),
  deleteFile:     (filename)   => api.delete(`${base}/workspace/${encodeURIComponent(filename)}/`),
  getJobs:        ()           => api.get(`${base}/jobs/`),
  getJob:         (id)         => api.get(`${base}/jobs/${id}/`),
  createJob:      (payload)    => api.post(`${base}/jobs/`, payload),
  downloadOutput: (id)         => `/api${base}/jobs/${id}/download/`,
}
