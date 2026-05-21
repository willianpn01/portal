import api from '@/services/api'

const base = '/downloads'

export const downloadsService = {
  getJobs: ()          => api.get(`${base}/`),
  getJob:  (id)        => api.get(`${base}/${id}/`),
  createJob: (payload) => api.post(`${base}/`, payload),
  deleteJob: (id)      => api.delete(`${base}/${id}/`),
  getUrlInfo:  (url)   => api.get(`${base}/info/`, { params: { url } }),
  getJobInfo:  (id)    => api.get(`${base}/${id}/info/`),
}
