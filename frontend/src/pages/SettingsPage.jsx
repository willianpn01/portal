import { useEffect, useState } from 'react'
import { Save, RefreshCw, Plus, Trash2, Eye, EyeOff, Check } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import { settingsService } from '@/services/settingsService'
import { newsService } from '@/services/newsService'
import { fileManagerService } from '@/services/fileManagerService'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/PageHeader'

// ── Appearance ────────────────────────────────────────────────────────────────

function AppearanceSection() {
  const { theme, setTheme } = useThemeStore()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aparência</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs mb-3" style={{ color: 'var(--text3)' }}>Escolha o tema visual do portal.</p>
        <div className="theme-selector">
          {[
            { id: 'frieren', name: 'Frieren', desc: 'Claro · Natureza · Fantasia', preview: 'frieren-preview' },
            { id: 'arcane',  name: 'Arcane',  desc: 'Escuro · Dourado · Místico',  preview: 'arcane-preview'  },
          ].map(({ id, name, desc, preview }) => (
            <div
              key={id}
              className={`theme-option${theme === id ? ' active' : ''}`}
              onClick={() => setTheme(id)}
            >
              <div className={`theme-preview ${preview}`} />
              <span>{name}</span>
              <small>{desc}</small>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  )
}

function Field({ label, name, value, onChange, placeholder, type = 'text', sensitive }) {
  const [show, setShow] = useState(false)
  const isMasked = sensitive && value === '********'

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-gray-400 text-xs">{label}</Label>
      <div className="relative">
        <Input
          id={name}
          name={name}
          type={sensitive && !show ? 'password' : 'text'}
          value={value ?? ''}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder={placeholder || label}
          className="bg-gray-900 border-gray-700 text-gray-100 pr-9"
          onFocus={() => { if (isMasked) onChange(name, '') }}
        />
        {sensitive && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Settings sections ─────────────────────────────────────────────────────────

function WeatherSection({ config, onChange }) {
  return (
    <Section title="Clima">
      <div className="space-y-1.5">
        <Label className="text-gray-400 text-xs">Provedor</Label>
        <select
          value={config.weather_provider ?? 'openweathermap'}
          onChange={(e) => onChange('weather_provider', e.target.value)}
          className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="openweathermap">OpenWeatherMap</option>
          <option value="weatherapi">WeatherAPI</option>
        </select>
      </div>
      <Field label="API Key" name="weather_api_key" value={config.weather_api_key} onChange={onChange} sensitive />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cidade" name="weather_city" value={config.weather_city} onChange={onChange} placeholder="Ex: São Paulo" />
        <Field label="País (código)" name="weather_country" value={config.weather_country} onChange={onChange} placeholder="Ex: BR" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude (opcional)" name="weather_lat" value={config.weather_lat} onChange={onChange} placeholder="Auto (geocoding)" />
        <Field label="Longitude (opcional)" name="weather_lon" value={config.weather_lon} onChange={onChange} placeholder="Auto (geocoding)" />
      </div>
      <p className="text-xs text-gray-600">
        Lat/Lon são usados pela One Call API 3.0. Deixe em branco para geocoding automático pela cidade.
      </p>
    </Section>
  )
}

function ExecutablesSection({ config, onChange }) {
  return (
    <Section title="Executáveis">
      <p className="text-xs text-gray-500">Deixe em branco para detectar automaticamente via PATH do sistema.</p>
      <Field label="ffmpeg" name="ffmpeg_path" value={config.ffmpeg_path} onChange={onChange} placeholder="auto" />
      <Field label="yt-dlp" name="yt_dlp_path" value={config.yt_dlp_path} onChange={onChange} placeholder="auto" />
      <Field label="Tesseract OCR" name="tesseract_path" value={config.tesseract_path} onChange={onChange} placeholder="auto" />
    </Section>
  )
}

function DirectoriesSection({ config, onChange }) {
  return (
    <Section title="Diretórios">
      <Field label="ROMs" name="roms_path" value={config.roms_path} onChange={onChange} placeholder="/caminho/para/roms" />
      <Field label="Downloads" name="downloads_path" value={config.downloads_path} onChange={onChange} placeholder="/caminho/para/downloads" />
      <div className="space-y-1.5">
        <Label className="text-gray-400 text-xs">Raízes do Gerenciador de Arquivos</Label>
        <AllowedRootsEditor
          roots={config.allowed_file_manager_roots ?? []}
          onChange={(roots) => onChange('allowed_file_manager_roots', roots)}
        />
      </div>
    </Section>
  )
}

function AllowedRootsEditor({ roots, onChange }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const v = draft.trim()
    if (v && !roots.includes(v)) {
      onChange([...roots, v])
      setDraft('')
    }
  }

  return (
    <div className="space-y-2">
      {roots.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300 truncate">
            {r}
          </span>
          <button
            type="button"
            onClick={() => onChange(roots.filter((_, j) => j !== i))}
            className="text-red-500 hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="/novo/caminho"
          className="bg-gray-900 border-gray-700 text-gray-100 text-sm"
        />
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus size={14} />
        </Button>
      </div>
    </div>
  )
}

function TheGamesDBSection({ config, onChange }) {
  return (
    <Section title="TheGamesDB">
      <p className="text-xs" style={{ color: 'var(--text3)' }}>
        Obtenha uma API key gratuita em{' '}
        <a
          href="https://forums.thegamesdb.net"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--blue)' }}
        >
          forums.thegamesdb.net
        </a>{' '}
        (seção API Key Requests).
      </p>
      <Field
        label="API Key"
        name="thegamesdb_api_key"
        value={config.thegamesdb_api_key}
        onChange={onChange}
        sensitive
      />
    </Section>
  )
}

function FeedsSection() {
  const [feeds, setFeeds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState({ label: '', url: '', category: '', order: 0 })
  const [refreshing, setRefreshing] = useState(null)

  useEffect(() => {
    newsService.getFeeds().then(({ data }) => {
      setFeeds(data)
      setLoading(false)
    })
  }, [])

  const toggleActive = async (feed) => {
    const { data } = await newsService.updateFeed(feed.id, { is_active: !feed.is_active })
    setFeeds((prev) => prev.map((f) => (f.id === feed.id ? data : f)))
  }

  const deleteFeed = async (id) => {
    if (!confirm('Remover este feed?')) return
    await newsService.deleteFeed(id)
    setFeeds((prev) => prev.filter((f) => f.id !== id))
  }

  const refresh = async (id) => {
    setRefreshing(id)
    try {
      await newsService.refreshFeed(id)
    } finally {
      setRefreshing(null)
    }
  }

  const addFeed = async () => {
    if (!draft.label || !draft.url) return
    const { data } = await newsService.createFeed(draft)
    setFeeds((prev) => [...prev, data])
    setDraft({ label: '', url: '', category: '', order: 0 })
    setShowNew(false)
  }

  return (
    <Section title="Feeds RSS">
      {loading ? (
        <p className="text-sm text-gray-500 animate-pulse">Carregando…</p>
      ) : (
        <div className="space-y-2">
          {feeds.map((feed) => (
            <div
              key={feed.id}
              className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-800/40 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => toggleActive(feed)}
                className={`w-8 h-5 rounded-full transition-colors ${feed.is_active ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${feed.is_active ? 'translate-x-3' : 'translate-x-0.5'}`}
                />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 font-medium truncate">{feed.label}</p>
                <p className="text-xs text-gray-500 truncate">{feed.url}</p>
              </div>
              <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded">{feed.category || '—'}</span>
              <button
                type="button"
                onClick={() => refresh(feed.id)}
                disabled={refreshing === feed.id}
                className="text-gray-500 hover:text-blue-400 disabled:opacity-40"
              >
                <RefreshCw size={14} className={refreshing === feed.id ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={() => deleteFeed(feed.id)}
                className="text-gray-500 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {showNew ? (
            <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Nome</Label>
                  <Input
                    value={draft.label}
                    onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                    className="bg-gray-900 border-gray-700 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Categoria</Label>
                  <Input
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                    placeholder="tech, geral…"
                    className="bg-gray-900 border-gray-700 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-400">URL do Feed</Label>
                <Input
                  value={draft.url}
                  onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                  placeholder="https://…"
                  className="bg-gray-900 border-gray-700 text-sm"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
                <Button size="sm" onClick={addFeed}>Adicionar</Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed border-gray-700 text-gray-500 hover:text-gray-300"
              onClick={() => setShowNew(true)}
            >
              <Plus size={14} className="mr-1" /> Adicionar Feed
            </Button>
          )}
        </div>
      )}
    </Section>
  )
}

// ── File Manager Roots ────────────────────────────────────────────────────────

function FileManagerRootsSection() {
  const [roots, setRoots] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState({ label: '', path: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    fileManagerService.getRoots().then(({ data }) => {
      setRoots(data)
      setLoading(false)
    })
  }, [])

  const toggle = async (root) => {
    const { data } = await fileManagerService.toggleRoot(root.id, !root.is_active)
    setRoots((prev) => prev.map((r) => (r.id === root.id ? data : r)))
  }

  const remove = async (id) => {
    if (!confirm('Remover esta raiz?')) return
    await fileManagerService.deleteRoot(id)
    setRoots((prev) => prev.filter((r) => r.id !== id))
  }

  const add = async () => {
    if (!draft.label.trim() || !draft.path.trim()) return
    setError('')
    try {
      const { data } = await fileManagerService.createRoot(draft.label.trim(), draft.path.trim())
      setRoots((prev) => [...prev, data])
      setDraft({ label: '', path: '' })
      setShowNew(false)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao criar raiz.')
    }
  }

  return (
    <Section title="Diretórios do File Manager">
      {loading ? (
        <p className="text-xs text-gray-500 animate-pulse">Carregando…</p>
      ) : (
        <div className="space-y-2">
          {roots.map((root) => (
            <div
              key={root.id}
              className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-800/40 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => toggle(root)}
                className={`w-8 h-5 rounded-full transition-colors ${root.is_active ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${root.is_active ? 'translate-x-3' : 'translate-x-0.5'}`}
                />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 font-medium">{root.label}</p>
                <p className="text-xs text-gray-500 truncate">{root.path}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(root.id)}
                className="text-gray-500 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {showNew ? (
            <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Nome</Label>
                  <Input
                    value={draft.label}
                    onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                    placeholder="Ex: Documentos"
                    className="bg-gray-900 border-gray-700 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Caminho</Label>
                  <Input
                    value={draft.path}
                    onChange={(e) => setDraft((d) => ({ ...d, path: e.target.value }))}
                    placeholder="/home/user/docs"
                    className="bg-gray-900 border-gray-700 text-sm"
                  />
                </div>
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => { setShowNew(false); setError('') }}>Cancelar</Button>
                <Button size="sm" onClick={add}>Adicionar</Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed border-gray-700 text-gray-500 hover:text-gray-300"
              onClick={() => setShowNew(true)}
            >
              <Plus size={14} className="mr-1" /> Adicionar Diretório
            </Button>
          )}
        </div>
      )}
    </Section>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    settingsService.getSettings().then(({ data }) => {
      setConfig(data)
      setLoading(false)
    })
  }, [])

  const handleChange = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await settingsService.saveSettings(config)
      setConfig(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-gray-500 animate-pulse">Carregando configurações…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <PageHeader icon="ti-settings" title="Configurações">
        <Button onClick={handleSave} disabled={saving} className="min-w-28">
          {saving ? (
            <RefreshCw size={14} className="mr-2 animate-spin" />
          ) : saved ? (
            <Check size={14} className="mr-2 text-green-400" />
          ) : (
            <Save size={14} className="mr-2" />
          )}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </Button>
      </PageHeader>

      <AppearanceSection />
      <WeatherSection config={config} onChange={handleChange} />
      <ExecutablesSection config={config} onChange={handleChange} />
      <DirectoriesSection config={config} onChange={handleChange} />
      <TheGamesDBSection config={config} onChange={handleChange} />
      <FileManagerRootsSection />
      <FeedsSection />
    </div>
  )
}
