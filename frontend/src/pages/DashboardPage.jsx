import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen, Download, Gamepad2, FileText, Radio, Play, Pause } from 'lucide-react'
import useAuthStore from '@/stores/authStore'
import useDashboardStore from '@/stores/dashboardStore'
import useWeatherStore from '@/stores/weatherStore'
import useNewsStore from '@/stores/newsStore'
import useRadioStore from '@/stores/radioStore'
import { romService } from '@/services/romService'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatTime(d) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
function formatDate(d) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}
function formatUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ')
}
function barColor(p) {
  if (p >= 85) return 'var(--red)'
  if (p >= 60) return 'var(--gold2)'
  return 'var(--green)'
}
function formatDay(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' })
    .replace('.', '').replace(/^\w/, c => c.toUpperCase())
}
function publishedAgo(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

const PLATFORM_BG = {
  nes: '#c0392b', snes: '#1d4ed8', gb: '#15803d',
  gbc: '#7e22ce', gba: '#c2410c', megadrive: '#1e3a5f',
}
const PLATFORM_LABEL = {
  nes: 'NES', snes: 'SNES', gb: 'GB', gbc: 'GBC', gba: 'GBA', megadrive: 'MD',
}


// ── Clock ─────────────────────────────────────────────────────────────────────

function ClockCard({ timezone }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="card-hd"><i className="ti ti-clock" />Horário</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'capitalize', marginBottom: 4 }}>
        {formatDate(now)}
      </div>
      <div className="clock-time" style={{ fontSize: 34, fontWeight: 300, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {formatTime(now)} 🍃
      </div>
      {timezone && (
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>{timezone}</div>
      )}
    </div>
  )
}

// ── System ────────────────────────────────────────────────────────────────────

function StatBar({ label, value, total, unit, percent }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: 'var(--text2)' }}>{label}</span>
        <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {total != null ? `${value} / ${total} ${unit}` : `${value}%`}
        </span>
      </div>
      <div className="bar-bg" style={{ height: 5 }}>
        <div className="bar" style={{ width: `${percent}%`, background: barColor(percent) }} />
      </div>
    </div>
  )
}

function SystemCard({ stats }) {
  return (
    <div className="card">
      <div className="card-hd"><i className="ti ti-cpu" />Sistema</div>
      {!stats ? (
        <p style={{ fontSize: 12, color: 'var(--text3)' }}>Carregando…</p>
      ) : (
        <>
          <StatBar label="CPU" value={stats.cpu_percent} percent={stats.cpu_percent} />
          <StatBar label="RAM" value={stats.ram_used_gb} total={stats.ram_total_gb} unit="GB" percent={stats.ram_percent} />
          <StatBar label="Disco" value={stats.disk_used_gb} total={stats.disk_total_gb} unit="GB" percent={stats.disk_percent} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
            <span>Uptime</span>
            <span style={{ color: 'var(--text2)' }}>{formatUptime(stats.uptime_seconds)}</span>
          </div>
        </>
      )}
    </div>
  )
}

// ── News ──────────────────────────────────────────────────────────────────────

function NewsCard({ feeds, isLoading }) {
  const [tab, setTab] = useState(0)

  if (isLoading && feeds.length === 0) return (
    <div className="card">
      <div className="card-hd"><i className="ti ti-news" />Notícias</div>
      <p style={{ fontSize: 12, color: 'var(--text3)' }}>Carregando…</p>
    </div>
  )
  if (feeds.length === 0) return null

  const activeFeed = feeds[tab] ?? feeds[0]

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="card-hd" style={{ margin: 0 }}><i className="ti ti-news" />Notícias</div>
        <Link to="/news" style={{ fontSize: 11, color: 'var(--blue)', textDecoration: 'none' }}>Ver todas →</Link>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        {feeds.map((f, i) => (
          <button key={f.id} className={`ntab${tab === i ? ' active' : ''}`} onClick={() => setTab(i)}>
            {f.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
        {(activeFeed?.items ?? []).slice(0, 4).map((item, i) => (
          <a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', gap: 10, textDecoration: 'none', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}
          >
            {item.image && (
              <img
                src={item.image} alt=""
                style={{ width: 52, height: 38, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                onError={e => { e.target.style.display = 'none' }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', lineHeight: 1.35,
                overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {item.title}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{publishedAgo(item.published)}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Quick Access ──────────────────────────────────────────────────────────────

const SHORTCUTS = [
  { to: '/files',     label: 'Arquivos',  sub: 'Gerenciador',  icon: FolderOpen, bg: 'rgba(74,124,89,0.12)',  ic: 'var(--green)' },
  { to: '/retro',     label: 'Retro',     sub: 'Emulador',     icon: Gamepad2,   bg: 'rgba(74,107,138,0.12)', ic: 'var(--blue)' },
  { to: '/downloads', label: 'Downloads', sub: 'yt-dlp / URL', icon: Download,   bg: 'rgba(184,147,42,0.12)', ic: 'var(--gold2)' },
  { to: '/pdf',       label: 'PDF/OCR',   sub: 'Ferramentas',  icon: FileText,   bg: 'rgba(192,90,58,0.12)',  ic: 'var(--red)' },
]

function QuickAccessCard() {
  return (
    <div className="card">
      <div className="card-hd"><i className="ti ti-layout-grid" />Acessos Rápidos</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {SHORTCUTS.map(({ to, label, sub, icon: Icon, bg, ic }) => (
          <Link
            key={to}
            to={to}
            style={{
              textDecoration: 'none', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border2)', background: bg,
              padding: '10px 10px', display: 'flex', alignItems: 'center', gap: 8,
              transition: 'transform 0.12s',
            }}
          >
            <Icon size={18} style={{ color: ic, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{sub}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Now Playing ───────────────────────────────────────────────────────────────

function NowPlayingCard() {
  const { currentStation, isPlaying, isLoading, pause, resume } = useRadioStore()

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-hd"><i className="ti ti-music" />Tocando Agora</div>
      {!currentStation ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 0' }}>
          <Radio size={32} style={{ color: 'var(--text3)' }} />
          <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>Nenhum áudio tocando</p>
          <Link to="/radio" style={{ fontSize: 11, color: 'var(--blue)', textDecoration: 'none' }}>Abrir Rádio →</Link>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 6 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 10, overflow: 'hidden',
            background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, position: 'relative',
          }}>
            📻
            {currentStation.favicon && (
              <img src={currentStation.favicon} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none' }} />
            )}
          </div>
          <div style={{ textAlign: 'center', minWidth: 0, width: '100%' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentStation.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
              {[currentStation.country, currentStation.language].filter(Boolean).join(' · ') || 'Rádio ao vivo'}
            </div>
          </div>
          <button
            onClick={isPlaying ? pause : resume}
            disabled={isLoading}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--accent)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Recent ROMs ───────────────────────────────────────────────────────────────

function RecentROMs() {
  const [roms, setRoms] = useState([])

  useEffect(() => {
    romService.getROMs({ ordering: '-created_at', page_size: 6 })
      .then(({ data }) => setRoms(data.results ?? []))
      .catch(() => {})
  }, [])

  if (roms.length === 0) return null

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="card-hd" style={{ margin: 0 }}><i className="ti ti-device-gamepad-2" />ROMs Recentes</div>
        <Link to="/roms" style={{ fontSize: 11, color: 'var(--blue)', textDecoration: 'none' }}>Ver biblioteca →</Link>
      </div>
      <div className="rom-row">
        {roms.map(rom => {
          const slug = rom.platform?.slug ?? ''
          const bg = PLATFORM_BG[slug] ?? '#555'
          return (
            <Link key={rom.id} to={`/retro/play/${rom.id}`} className="rom-card" style={{ textDecoration: 'none' }}>
              <div className="rom-cover" style={{ background: bg }}>
                <img
                  src={romService.coverUrl(rom.id)}
                  alt={rom.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none' }}
                />
              </div>
              <div className="rom-info">
                <div style={{ marginBottom: 3 }}>
                  <span className="platform-badge">{PLATFORM_LABEL[slug] ?? slug.toUpperCase()}</span>
                  {rom.is_favorite && <span style={{ marginLeft: 3, fontSize: 9, color: 'var(--gold2)' }}>★</span>}
                </div>
                <div className="rom-title">{rom.title}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user                            = useAuthStore(s => s.user)
  const { systemStats, datetime, fetchStats } = useDashboardStore()
  const { weather, fetchWeather } = useWeatherStore()
  const { feeds, isLoading: newsLoading, fetchNews } = useNewsStore()

  useEffect(() => {
    fetchStats()
    fetchWeather()
    fetchNews()
    const id = setInterval(fetchStats, 10_000)
    return () => clearInterval(id)
  }, [fetchStats, fetchWeather, fetchNews])

  return (
    <div className="dashboard-bg" style={{
      margin: '-20px -24px',
      padding: '20px 24px',
      minHeight: 'calc(100% + 40px)',
      position: 'relative',
    }}>
      {/* Semi-transparent overlay — theme-aware via --dash-overlay CSS variable */}
      <div className="dashboard-overlay" />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Greeting header — floats directly over the background */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '4px 0 8px' }}>
          <div>
            <h2 style={{
              margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)',
              textShadow: '0 1px 8px rgba(255,255,255,0.8)',
            }}>
              Bem-vindo de volta, {user?.username ?? '...'} 🍃
            </h2>
            <p style={{
              margin: '4px 0 0', fontSize: 13, color: 'var(--text2)',
              textShadow: '0 1px 8px rgba(255,255,255,0.8)',
            }}>
              Que esta jornada te traga paz e sabedoria.
            </p>
          </div>
          {weather && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {weather.condition_icon && (
                <img src={weather.condition_icon} alt="" style={{ width: 40, height: 40 }} />
              )}
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 24, fontWeight: 300, color: 'var(--text)', lineHeight: 1,
                  textShadow: '0 1px 8px rgba(255,255,255,0.8)',
                }}>
                  {Math.round(weather.temperature)}°C
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--text2)', marginTop: 2, textTransform: 'capitalize',
                  textShadow: '0 1px 8px rgba(255,255,255,0.8)',
                }}>
                  {weather.condition}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Row 1: Clock · System */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 320px', gap: 14 }}>
          <div className="card-corner"><ClockCard timezone={datetime?.timezone} /></div>
          <div className="card-corner"><SystemCard stats={systemStats} /></div>
        </div>

        {/* Row 2: News · Quick Access */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 14 }}>
          <div className="card-corner"><NewsCard feeds={feeds} isLoading={newsLoading} /></div>
          <div className="card-corner"><QuickAccessCard /></div>
        </div>

        <div className="card-corner"><RecentROMs /></div>
      </div>
    </div>
  )
}
