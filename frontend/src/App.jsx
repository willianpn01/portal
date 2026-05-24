import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from '@/stores/authStore'
import MainLayout from '@/layouts/MainLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import WeatherPage from '@/pages/WeatherPage'
import NewsPage from '@/pages/NewsPage'
import PdfPage from '@/pages/PdfPage'
import DownloadsPage from '@/pages/DownloadsPage'
import FilesPage from '@/pages/FilesPage'
import RetroPage from '@/pages/RetroPage'
import RetroPlayerPage from '@/pages/RetroPlayerPage'
import RomsPage from '@/pages/RomsPage'
import RadioPage from '@/pages/RadioPage'
import ImagesPage from '@/pages/ImagesPage'
import SettingsPage from '@/pages/SettingsPage'

function RequireAuth({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe)

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/retro" element={<RequireAuth><RetroPage /></RequireAuth>} />
        <Route path="/retro/play/:id" element={<RequireAuth><RetroPlayerPage /></RequireAuth>} />
        <Route
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/weather" element={<WeatherPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/pdf" element={<PdfPage />} />
          <Route path="/downloads" element={<DownloadsPage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/roms" element={<RomsPage />} />
          <Route path="/radio" element={<RadioPage />} />
          <Route path="/images" element={<ImagesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
