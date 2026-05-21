import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import RadioPlayer from '@/components/player/RadioPlayer'
import MusicPlayer from '@/components/player/MusicPlayer'

export default function MainLayout() {
  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <div className="content">
          <Outlet />
        </div>
        <RadioPlayer />
        <MusicPlayer />
      </div>
    </div>
  )
}
