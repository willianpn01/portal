import { diffWords } from 'diff'
import { X, Check, XCircle, Sparkles } from 'lucide-react'

const P = {
  bg:       '#f5f0e8',
  surface:  '#faf7f2',
  border:   '#e0d8cc',
  text:     '#3d3028',
  muted:    '#b0a090',
  accent:   '#4a7a4a',
  accentBg: '#e8ede8',
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function SpellingDiffModal({ result, onAccept, onReject }) {
  if (!result) return null

  const originalText  = stripHtml(result.original)
  const correctedText = stripHtml(result.corrected)
  const parts         = diffWords(originalText, correctedText)

  // Count correction groups (each contiguous block of adds/removes = 1 correction)
  let correctionCount = 0
  let inChange = false
  for (const part of parts) {
    if (part.added || part.removed) {
      if (!inChange) correctionCount++
      inChange = true
    } else {
      inChange = false
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200,
    }}>
      <div style={{
        background: P.surface,
        border: `1px solid ${P.border}`,
        borderRadius: 12,
        width: 680,
        maxWidth: '95vw',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${P.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} style={{ color: P.accent }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: P.text }}>
              Revisão ortográfica —{' '}
              {correctionCount === 0
                ? 'nenhuma correção'
                : `${correctionCount} correção${correctionCount !== 1 ? 'ões' : ''} encontrada${correctionCount !== 1 ? 's' : ''}`}
            </span>
          </div>
          <button
            onClick={onReject}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: P.muted, padding: 2 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Legend */}
        <div style={{
          padding: '8px 20px',
          borderBottom: `1px solid ${P.border}`,
          display: 'flex',
          gap: 20,
          fontSize: 11,
          color: P.muted,
          flexShrink: 0,
          background: P.bg,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: '#fde8e8', display: 'inline-block' }} />
            Removido
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: '#e8f5e9', display: 'inline-block' }} />
            Adicionado
          </span>
        </div>

        {/* Diff body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          fontSize: 14,
          lineHeight: 1.8,
          color: P.text,
          fontFamily: 'Georgia, serif',
        }}>
          {parts.map((part, i) => (
            <span
              key={i}
              style={{
                background:      part.added   ? '#e8f5e9'
                               : part.removed ? '#fde8e8'
                               : 'transparent',
                color:           part.added   ? '#2d6a2d'
                               : part.removed ? '#c0392b'
                               : 'inherit',
                textDecoration:  part.removed ? 'line-through' : 'none',
                borderRadius:    (part.added || part.removed) ? 2 : 0,
                padding:         (part.added || part.removed) ? '0 1px' : 0,
              }}
            >
              {part.value}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: `1px solid ${P.border}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          flexShrink: 0,
        }}>
          <button
            onClick={onReject}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 18px', fontSize: 13,
              background: 'none', border: `1px solid ${P.border}`,
              borderRadius: 6, cursor: 'pointer', color: P.text,
            }}
          >
            <XCircle size={14} /> Rejeitar
          </button>
          <button
            onClick={onAccept}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 18px', fontSize: 13,
              background: P.accent, border: 'none',
              borderRadius: 6, cursor: 'pointer', color: '#fff',
            }}
          >
            <Check size={14} /> Aceitar correções
          </button>
        </div>
      </div>
    </div>
  )
}
