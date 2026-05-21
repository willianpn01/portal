import api from '@/services/api'
import { pdfService } from '@/services/pdfService'

const base = '/pdf'

export const imageService = {
  upload(file) {
    const fd = new FormData()
    fd.append('file', file)
    return api.post(`${base}/upload/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  listJobs:    ()   => pdfService.getJobs(),
  getJob:      (id) => pdfService.getJob(id),
  createJob:   (d)  => pdfService.createJob(d),
  downloadUrl: (id) => pdfService.downloadOutput(id),
}
