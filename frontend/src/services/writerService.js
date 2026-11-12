import api from '@/services/api'

const base = '/writer'

export const writerService = {
  getProjects:   ()                => api.get(`${base}/projects/`),
  createProject: (data)            => api.post(`${base}/projects/`, data),
  getProject:    (id)              => api.get(`${base}/projects/${id}/`),
  updateProject: (id, data)        => api.patch(`${base}/projects/${id}/`, data),
  deleteProject: (id)              => api.delete(`${base}/projects/${id}/`),
  getChapters:   (projectId)       => api.get(`${base}/projects/${projectId}/chapters/`),
  createChapter: (projectId, data) => api.post(`${base}/projects/${projectId}/chapters/`, data),
  getChapter:    (id)              => api.get(`${base}/chapters/${id}/`),
  updateChapter: (id, data)        => api.patch(`${base}/chapters/${id}/`, data),
  deleteChapter: (id)              => api.delete(`${base}/chapters/${id}/`),
  autosave:      (id, html)        => api.post(`${base}/chapters/${id}/autosave/`, { html_content: html }),
  saveVersion:   (id, data)        => api.post(`${base}/chapters/${id}/save-version/`, data),
  getVersions:   (id)              => api.get(`${base}/chapters/${id}/versions/`),
  getVersion:    (id, vId)         => api.get(`${base}/chapters/${id}/versions/${vId}/`),
  exportDocx:    (id)              => api.post(`${base}/chapters/${id}/export/`),
  exportStatus:  (id, taskId)      => api.get(`${base}/chapters/${id}/export/status/${taskId}/`),
  correctSpelling: (id, data, config) => api.post(`${base}/chapters/${id}/correct/`, data, config),
}
