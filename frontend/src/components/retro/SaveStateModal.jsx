import { useEffect, useState, useCallback } from 'react'
import { romService } from '@/services/romService'

// ── SlotCard ──────────────────────────────────────────────────────────────────

function SlotCard({ slot, mode, onPick, busy }) {
  const has      = slot.has_state
  const disabled = mode === 'load' && !has
  const date     = has
    ? new Date(slot.updated_at).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <button
      onClick={() => onPick(slot.slot)}
      disabled={disabled || busy}
      style={{
        border: `1px solid ${has ? '#4a4a4a' : '#2a2a2a'}`,
        borderRadius: '8px', overflow: 'hidden',
        background: 'transparent', padding: 0,
        cursor: disabled || busy ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <div style={{ aspectRatio: '16/9', background: '#0a0a0a', position: 'relative' }}>
        {has && slot.screenshot_url ? (
          <img src={slot.screenshot_url} alt={`Slot ${slot.slot}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#444', fontSize: '18px' }}>
            {busy ? '⏳' : '·'}
          </div>
        )}
        <span style={{ position: 'absolute', bottom: '3px', left: '5px',
          background: 'rgba(0,0,0,0.72)', color: '#bbb', fontSize: '10px',
          padding: '1px 4px', borderRadius: '3px' }}>
          {slot.slot}
        </span>
      </div>
      <div style={{ padding: '3px 6px', background: '#181818', minHeight: '20px' }}>
        {date && <p style={{ fontSize: '9px', color: '#666', margin: 0, textAlign: 'center' }}>{date}</p>}
      </div>
    </button>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

// Save mode: pendingSave = { stateArr: number[], screenshotDataUrl: string|null }
// Load mode: onLoad(stateArr: number[]) is called when user picks a slot
export default function SaveStateModal({ mode, isOpen, onClose, romId, pendingSave, onLoad }) {
  const [slots,    setSlots]  = useState([])
  const [busySlot, setBusy]   = useState(null)
  const [toast,    setToast]  = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const reload = useCallback(() => {
    if (romId) romService.getSaveStates(romId).then(setSlots).catch(() => {})
  }, [romId])

  useEffect(() => { if (isOpen) reload() }, [isOpen, reload])

  if (!isOpen) return null

  async function handlePick(slotNum) {
    setBusy(slotNum)
    try {
      if (mode === 'save') {
        const stateBlob = new Blob([new Uint8Array(pendingSave.stateArr)], {
          type: 'application/octet-stream',
        })
        let screenshotBlob = null
        if (pendingSave.screenshotDataUrl) {
          const res = await fetch(pendingSave.screenshotDataUrl)
          screenshotBlob = await res.blob()
        }
        await romService.saveSaveState(romId, slotNum, stateBlob, screenshotBlob)
        showToast(`Salvo no slot ${slotNum}`)
        reload()
        setTimeout(onClose, 900)
      } else {
        // Load: fetch binary → Uint8Array → Array → pass back to parent
        const url  = romService.saveStateDownloadUrl(romId, slotNum)
        const resp = await fetch(url, { credentials: 'same-origin' })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const buf = await resp.arrayBuffer()
        const arr = Array.from(new Uint8Array(buf))
        onLoad(arr)
        onClose()
      }
    } catch (err) {
      showToast(`Erro: ${err.message}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ background: '#141414', border: '1px solid #3a3a3a',
        borderRadius: '12px', width: '500px', maxWidth: '94vw',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid #3a3a3a' }}>
          <span style={{ color: '#ddd', fontWeight: 600, fontSize: '14px' }}>
            {mode === 'save' ? '💾 Salvar em qual slot?' : '📂 Carregar qual slot?'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            color: '#666', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
          gap: '8px', padding: '14px' }}>
          {slots.map(slot => (
            <SlotCard key={slot.slot} slot={slot} mode={mode}
              onPick={handlePick} busy={busySlot === slot.slot} />
          ))}
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%',
          transform: 'translateX(-50%)', background: '#222', color: '#fff',
          padding: '7px 16px', borderRadius: '18px', fontSize: '13px',
          zIndex: 1100, boxShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
