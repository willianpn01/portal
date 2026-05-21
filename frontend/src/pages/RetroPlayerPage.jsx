import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { romService } from '@/services/romService'

// Build a self-contained HTML page for EmulatorJS.
// EJS runs inside an isolated iframe context so its let/const declarations
// never collide with the SPA's global scope across ROM switches.
// The gameUrl is a blob: URL so EJS reads straight from memory — no proxy,
// no network, no Content-Encoding issues.
function buildEjsHtml(core, gameUrl) {
  const pathtodata = 'https://cdn.emulatorjs.org/stable/data/'
  return `<!DOCTYPE html>
<html style="margin:0;height:100%;background:#000">
<body style="margin:0;height:100%;background:#000">
<div id="game" style="width:100%;height:100vh"></div>
<script>
window.EJS_pathtodata         = "${pathtodata}";
window.EJS_player             = "#game";
window.EJS_core               = "${core}";
window.EJS_gameUrl            = "${gameUrl}";
window.EJS_startOnLoaded      = true;
window.EJS_fullscreenOnLoaded = false;
window.EJS_language           = "en-US";
</script>
<script src="${pathtodata}loader.js"></script>
</body>
</html>`
}

export default function RetroPlayerPage() {
  const { id } = useParams()
  const [rom,     setRom]     = useState(null)
  const [blobUrl, setBlobUrl] = useState(null)
  const [progress, setProgress] = useState(null)  // null = idle, 0-100 = downloading
  const [error,   setError]   = useState('')
  const blobRef = useRef(null)  // holds the current blob URL so cleanup can revoke it

  // Step 1 — load ROM metadata and register the play session
  useEffect(() => {
    romService.registerPlay(id)
      .then(({ data }) => setRom(data))
      .catch(() => setError('Erro ao carregar a ROM. Verifique se o arquivo ainda existe.'))
  }, [id])

  // Step 2 — download the ROM file as a Blob in the main React context.
  // Passing a blob: URL to EJS means it reads from browser memory instead
  // of making an HTTP request inside the iframe, bypassing any proxy/auth issues.
  useEffect(() => {
    if (!rom) return
    let cancelled = false
    setProgress(0)

    const download = async () => {
      const resp = await fetch(romService.fileUrl(rom.id), { credentials: 'same-origin' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const total = parseInt(resp.headers.get('Content-Length') || '0', 10)
      const reader = resp.body.getReader()
      const chunks = []
      let received = 0

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (cancelled) { reader.cancel(); return }
        chunks.push(value)
        received += value.length
        if (total > 0) setProgress(Math.round((received / total) * 100))
      }

      const blob = new Blob(chunks, { type: 'application/octet-stream' })
      const url  = URL.createObjectURL(blob)
      blobRef.current = url
      setBlobUrl(url)
      setProgress(null)
    }

    download().catch((err) => {
      if (!cancelled) setError(`Erro ao baixar a ROM: ${err.message}`)
    })

    return () => {
      cancelled = true
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current)
        blobRef.current = null
      }
      setBlobUrl(null)
      setProgress(null)
    }
  }, [rom])

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-sm">{error}</p>
          <Link to="/roms" className="text-blue-400 text-sm hover:underline">
            ← Voltar à biblioteca
          </Link>
        </div>
      </div>
    )
  }

  const isReady = rom && blobUrl

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {rom && (
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
          <Link to="/retro" className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
            ← Retro
          </Link>
          <span className="text-gray-700 text-xs">|</span>
          <Link to="/roms" className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
            Biblioteca
          </Link>
          <span className="text-gray-700 text-xs">|</span>
          <span className="text-gray-200 text-sm font-medium truncate">{rom.title}</span>
          <span className="text-gray-500 text-xs shrink-0">{rom.platform?.name}</span>
          {progress !== null && (
            <span className="ml-auto text-xs text-blue-400 shrink-0 tabular-nums">
              {progress}%
            </span>
          )}
        </div>
      )}

      {isReady ? (
        <iframe
          key={blobUrl}
          srcDoc={buildEjsHtml(rom.platform.emulatorjs_core, blobUrl)}
          className="flex-1 w-full border-0"
          title={rom.title}
          allow="fullscreen *; gamepad *"
          allowFullScreen
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          {progress !== null ? (
            <>
              <div className="w-56 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-gray-500 text-xs tabular-nums">
                Baixando ROM… {progress}%
              </p>
            </>
          ) : (
            <p className="text-gray-500 text-sm animate-pulse">Carregando…</p>
          )}
        </div>
      )}
    </div>
  )
}
