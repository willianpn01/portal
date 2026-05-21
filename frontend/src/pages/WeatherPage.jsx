import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Wind, Droplets, Thermometer, Sun, Eye, Cloud, Gauge } from 'lucide-react'
import useWeatherStore from '@/stores/weatherStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/PageHeader'

const CACHE_MINUTES = 60

// ── helpers ───────────────────────────────────────────────────────────────────

function uviLabel(uvi) {
  if (uvi <= 2)  return { text: 'Baixo',      color: 'text-green-400' }
  if (uvi <= 5)  return { text: 'Moderado',   color: 'text-yellow-400' }
  if (uvi <= 7)  return { text: 'Alto',       color: 'text-orange-400' }
  if (uvi <= 10) return { text: 'Muito Alto', color: 'text-red-400' }
  return               { text: 'Extremo',     color: 'text-purple-400' }
}

function formatForecastDay(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('pt-BR', { weekday: 'long' })
    .replace('.', '')
    .replace(/^\w/, (c) => c.toUpperCase())
}

function val(v, suffix = '') {
  return v != null ? `${v}${suffix}` : '—'
}

// ── sub-components ────────────────────────────────────────────────────────────

function RefreshButton({ lastFetchedAt, isLoading, onRefresh }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const minutesAgo       = lastFetchedAt ? Math.floor((now - lastFetchedAt) / 60_000) : null
  const canRefresh       = minutesAgo === null || minutesAgo >= CACHE_MINUTES
  const minutesRemaining = CACHE_MINUTES - (minutesAgo ?? 0)

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onRefresh}
        disabled={isLoading || !canRefresh}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
          bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed
          text-white transition-colors"
      >
        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        Atualizar
      </button>
      {minutesAgo !== null && (
        <p className="text-xs text-gray-500">
          {canRefresh
            ? `Atualizado há ${minutesAgo} min`
            : `Atualizado há ${minutesAgo} min — próxima em ${minutesRemaining} min`}
        </p>
      )}
    </div>
  )
}

function CurrentCard({ weather }) {
  const uvi    = weather.uvi ?? null
  const uviLbl = uvi !== null ? uviLabel(uvi) : null

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-6">
          {weather.condition_icon && (
            <img src={weather.condition_icon} alt={weather.condition} className="w-20 h-20" />
          )}
          <div>
            <p className="text-6xl font-bold text-gray-100 leading-none tabular-nums">
              {Math.round(weather.temperature)}°C
            </p>
            <p className="text-lg text-gray-400 capitalize mt-2">{weather.condition}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatItem
            icon={<Thermometer size={16} className="text-orange-400" />}
            label="Sensação"
            value={`${Math.round(weather.feels_like)}°C`}
          />
          <StatItem
            icon={<Droplets size={16} className="text-blue-400" />}
            label="Umidade"
            value={`${weather.humidity}%`}
          />
          <StatItem
            icon={<Wind size={16} className="text-gray-400" />}
            label="Vento"
            value={`${weather.wind_kph} km/h`}
          />
          {uviLbl && (
            <StatItem
              icon={<Sun size={16} className={uviLbl.color} />}
              label="UV Index"
              value={`${uvi} — ${uviLbl.text}`}
              valueClass={uviLbl.color}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StatItem({ icon, label, value, valueClass = 'text-gray-200' }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-sm font-medium ${valueClass}`}>{value}</p>
      </div>
    </div>
  )
}

function ForecastCard({ weather }) {
  if (!weather.forecast?.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previsão — próximos 4 dias</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {weather.forecast.map((day) => (
            <div
              key={day.date}
              className="flex flex-col items-center gap-1 rounded-xl border border-gray-700 bg-gray-800/40 p-4 text-center"
            >
              <p className="text-xs text-gray-400 font-medium">{formatForecastDay(day.date)}</p>
              {day.condition_icon && (
                <img src={day.condition_icon} alt={day.condition} className="w-12 h-12 my-1" />
              )}
              <p className="text-xs text-gray-400 capitalize leading-tight">{day.condition}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-sm font-bold text-gray-100">{Math.round(day.temp_max)}°</span>
                <span className="text-sm text-gray-500">{Math.round(day.temp_min)}°</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function DetailsCard({ weather }) {
  const items = [
    { icon: <Gauge size={15} className="text-blue-400" />,    label: 'Pressão',           value: val(weather.pressure, ' hPa') },
    { icon: <Droplets size={15} className="text-cyan-400" />, label: 'Ponto de Orvalho',  value: val(weather.dew_point, '°C') },
    { icon: <Cloud size={15} className="text-gray-400" />,    label: 'Cobertura de Nuvens', value: val(weather.clouds, '%') },
    { icon: <Eye size={15} className="text-purple-400" />,    label: 'Visibilidade',       value: val(weather.visibility, ' km') },
    { icon: <Wind size={15} className="text-gray-400" />,     label: 'Velocidade do Vento', value: val(weather.wind_kph, ' km/h') },
    { icon: <Wind size={15} className="text-yellow-400" />,   label: 'Rajadas',             value: val(weather.wind_gust, ' km/h') },
    { icon: <Sun size={15} className="text-orange-300" />,    label: 'Nascer do Sol',       value: weather.sunrise || '—' },
    { icon: <Sun size={15} className="text-orange-500" />,    label: 'Pôr do Sol',          value: weather.sunset || '—' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5">
          {items.map(({ icon, label, value }) => (
            <div key={label} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">{icon}</span>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-medium text-gray-200">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function WeatherPage() {
  const { weather, error, isLoading, fetchWeather, lastFetchedAt } = useWeatherStore()

  useEffect(() => {
    fetchWeather()
  }, [fetchWeather])

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader icon="ti-cloud" title="Clima" />
        <p className="text-sm text-gray-400">{error}</p>
        <Link to="/settings" className="text-xs text-blue-400 hover:underline">
          Configurar em Ajustes
        </Link>
      </div>
    )
  }

  if (isLoading && !weather) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-gray-500 animate-pulse">Carregando clima…</p>
      </div>
    )
  }

  if (!weather) return null

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <PageHeader icon="ti-cloud" title={`${weather.city}${weather.country ? ` — ${weather.country}` : ''}`} />
        <RefreshButton lastFetchedAt={lastFetchedAt} isLoading={isLoading} onRefresh={fetchWeather} />
      </div>

      <CurrentCard weather={weather} />
      <ForecastCard weather={weather} />
      <DetailsCard weather={weather} />
    </div>
  )
}
