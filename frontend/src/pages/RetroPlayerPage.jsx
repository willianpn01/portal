import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { romService } from '@/services/romService'
import SaveStateModal from '@/components/retro/SaveStateModal'

// Build a self-contained HTML page for EmulatorJS.
// EJS runs inside an isolated iframe context so its let/const declarations
// never collide with the SPA's global scope across ROM switches.
// The gameUrl is a blob: URL so EJS reads straight from memory — no proxy,
// no network, no Content-Encoding issues.
function buildEjsHtml(core, gameUrl, romId, loadStateUrl) {
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
window.EJS_gameID             = "${romId}";
${loadStateUrl ? `window.EJS_loadStateURL = "${loadStateUrl}";` : ''}

window.addEventListener('message', function(e) {
  if (!e.data) return;

  if (e.data.type === 'GET_STATE') {
    try {
      var state = window.EJS_emulator.gameManager.getState();
      var arr = Array.from(state);
      var screenshotDataUrl = null;
      try {
        var canvas = document.querySelector('#game canvas');
        if (canvas) screenshotDataUrl = canvas.toDataURL('image/png');
      } catch(_) {}
      window.parent.postMessage({ type: 'STATE_DATA', stateArr: arr, screenshotDataUrl: screenshotDataUrl }, '*');
    } catch(err) {
      window.parent.postMessage({ type: 'STATE_ERROR', message: err.message }, '*');
    }
  }

  if (e.data.type === 'LOAD_STATE') {
    try {
      var arr = new Uint8Array(e.data.stateArr);
      window.EJS_emulator.gameManager.loadState(arr);
    } catch(err) {
      console.error('LOAD_STATE error:', err);
    }
  }
});
</script>
<script src="${pathtodata}loader.js"></script>
</body>
</html>`
}

export default function RetroPlayerPage() {
  const { id } = useParams()
  const [rom,      setRom]      = useState(null)
  const [blobUrl,  setBlobUrl]  = useState(null)
  const [progress, setProgress] = useState(null)  // null = idle, 0-100 = downloading
  const [error,    setError]    = useState('')

  // Save state UI state
  const [lastSaveUrl,    setLastSaveUrl]    = useState(null)
  const [lastSaveChecked, setLastSaveChecked] = useState(false)
  const [slotPickerOpen, setSlotPickerOpen] = useState(false)
  const [loadModalOpen,  setLoadModalOpen]  = useState(false)
  const [pendingSave,    setPendingSave]    = useState(null)  // { stateArr, screenshotDataUrl }

  const blobRef    = useRef(null)  // holds the current blob URL so cleanup can revoke it
  const ejsIframe  = useRef(null)  // ref for the inner EJS iframe

  // Step 1 — load ROM metadata and register the play session
  useEffect(() => {
    romService.registerPlay(id)
      .then(({ data }) => setRom(data))
      .catch(() => setError('Erro ao carregar a ROM. Verifique se o arquivo ainda existe.'))
  }, [id])

  // Step 2 — download the ROM file as a Blob in the main React context.
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

  // Step 3 — fetch save states to find the most recent one for auto-load
  useEffect(() => {
    if (!rom) return
    romService.getSaveStates(rom.id)
      .then((slots) => {
        const filled = slots.filter((s) => s.has_state)
        if (filled.length > 0) {
          const latest = filled.reduce((a, b) =>
            new Date(a.updated_at) > new Date(b.updated_at) ? a : b
          )
          setLastSaveUrl(romService.saveStateDownloadUrl(rom.id, latest.slot))
        }
        setLastSaveChecked(true)
      })
      .catch(() => setLastSaveChecked(true))
  }, [rom])

  // Listen for STATE_DATA messages from the EJS inner iframe
  useEffect(() => {
    const handler = (e) => {
      if (!e.data) return
      if (e.data.type === 'STATE_DATA') {
        setPendingSave({
          stateArr: e.data.stateArr,
          screenshotDataUrl: e.data.screenshotDataUrl,
        })
        setSlotPickerOpen(true)
      }
      if (e.data.type === 'STATE_ERROR') {
        console.error('EJS getState error:', e.data.message)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const handleSaveState = () => {
    if (!ejsIframe.current) return
    ejsIframe.current.contentWindow.postMessage({ type: 'GET_STATE' }, '*')
  }

  const handleApplyState = (stateArr) => {
    if (!ejsIframe.current) return
    ejsIframe.current.contentWindow.postMessage({ type: 'LOAD_STATE', stateArr }, '*')
  }

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

  const isReady = rom && blobUrl && lastSaveChecked

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
          {isReady && (
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleSaveState}
                className="text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded transition-colors border border-gray-700"
              >
                💾 Salvar State
              </button>
              <button
                onClick={() => setLoadModalOpen(true)}
                className="text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded transition-colors border border-gray-700"
              >
                📂 Carregar State
              </button>
            </div>
          )}
        </div>
      )}

      {isReady ? (
        <iframe
          ref={ejsIframe}
          key={blobUrl}
          srcDoc={buildEjsHtml(rom.platform.emulatorjs_core, blobUrl, id, lastSaveUrl)}
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

      <SaveStateModal
        mode="save"
        isOpen={slotPickerOpen}
        onClose={() => { setSlotPickerOpen(false); setPendingSave(null) }}
        romId={rom?.id}
        pendingSave={pendingSave}
      />
      <SaveStateModal
        mode="load"
        isOpen={loadModalOpen}
        onClose={() => setLoadModalOpen(false)}
        romId={rom?.id}
        onLoad={handleApplyState}
      />
    </div>
  )
}
