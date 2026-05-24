import { NavLink } from 'react-router-dom'
import {
  Compass, LayoutDashboard, CloudSun, Newspaper,
  FileText, Download, FolderOpen, Gamepad2, Library,
  Radio, Image, Settings, LogOut,
} from 'lucide-react'
import useAuthStore from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/',        label: 'Dashboard',  icon: LayoutDashboard, end: true },
      { to: '/weather', label: 'Clima',       icon: CloudSun },
      { to: '/news',    label: 'Notícias',    icon: Newspaper },
    ],
  },
  {
    label: 'FERRAMENTAS',
    items: [
      { to: '/pdf',       label: 'PDF / OCR', icon: FileText },
      { to: '/images',    label: 'Imagens',   icon: Image },
      { to: '/downloads', label: 'Downloads', icon: Download },
      { to: '/files',     label: 'Arquivos',  icon: FolderOpen },
    ],
  },
  {
    label: 'LAZER',
    items: [
      { to: '/roms',  label: 'ROMs',  icon: Library },
      { to: '/radio', label: 'Rádio', icon: Radio },
    ],
  },
]

const activeStyle = {
  background: 'rgba(74,124,89,0.12)',
  borderLeft: '3px solid var(--green)',
  color: 'var(--accent)',
}
const inactiveStyle = {
  borderLeft: '3px solid transparent',
  color: 'var(--text2)',
}

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const { theme } = useThemeStore()
  const portalName = theme === 'arcane' ? 'Potter' : 'Frieren'
  const initials = (user?.username ?? 'P').slice(0, 2).toUpperCase()

  return (
    <aside className="sidebar" style={{
      width: 220, flexShrink: 0,
      background: `var(--sidebar-bg)`,
      borderRight: '1px solid var(--border2)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      position: 'relative', zIndex: 1,
    }}>
      {/* Logo */}
      <div style={{
        padding: '18px 16px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(138,111,46,0.12)',
          border: '1px solid rgba(138,111,46,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Compass size={18} style={{ color: 'var(--gold)' }} />
        </div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            PORTAL
          </div>
          <div className="logo-title" style={{ fontSize: 17, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.04em' }}>
            {portalName}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>
            Painel pessoal
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 4 }}>
            {group.label && (
              <div className="nav-cat" style={{
                fontSize: 9.5, fontWeight: 700, color: 'var(--text3)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '10px 10px 4px',
              }}>
                {group.label}
              </div>
            )}
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13, fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'background 0.12s',
                  marginBottom: 1,
                  ...(isActive ? activeStyle : inactiveStyle),
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={15} style={{ color: isActive ? 'var(--accent)' : 'var(--text3)', flexShrink: 0 }} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px' }}>
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '6px 8px', borderRadius: 'var(--radius-sm)',
            fontSize: 13, fontWeight: 500, textDecoration: 'none',
            marginBottom: 8,
            ...(isActive ? activeStyle : inactiveStyle),
          })}
        >
          {({ isActive }) => (
            <>
              <Settings size={15} style={{ color: isActive ? 'var(--accent)' : 'var(--text3)' }} />
              Configurações
            </>
          )}
        </NavLink>

        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--green2), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.username ?? '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>
              {user?.is_staff ? 'Administrador' : 'Usuário'}
            </div>
          </div>
          <button
            onClick={logout}
            title="Sair"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', flexShrink: 0 }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
