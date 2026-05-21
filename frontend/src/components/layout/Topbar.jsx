import { useLocation } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import useAuthStore from '@/stores/authStore'

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/weather': 'Clima',
  '/news': 'Notícias',
  '/pdf': 'PDF / OCR',
  '/downloads': 'Downloads',
  '/files': 'Gerenciador de Arquivos',
  '/retro': 'Retro',
  '/roms': 'Biblioteca de ROMs',
  '/radio': 'Rádio',
  '/settings': 'Configurações',
}

export default function Topbar() {
  const { pathname } = useLocation()
  const { user, logout } = useAuthStore()
  const title = PAGE_TITLES[pathname] ?? 'Portal'

  return (
    <header className="h-14 shrink-0 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      <h1 className="text-base font-semibold text-gray-100">{title}</h1>

      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400 flex items-center gap-1.5">
          <User size={15} />
          {user?.username}
        </span>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-400 transition-colors"
        >
          <LogOut size={15} />
          Sair
        </button>
      </div>
    </header>
  )
}
