import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { Node, Extension, mergeAttributes, wrappingInputRule } from '@tiptap/core'
import { BulletList } from '@tiptap/extension-bullet-list'
import { Typography } from '@tiptap/extension-typography'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, FontFamily, FontSize, Color } from '@tiptap/extension-text-style'
import { Highlight } from '@tiptap/extension-highlight'
import useWriterStore from '@/stores/writerStore'
import { writerService } from '@/services/writerService'
import {
  Bold, Italic, Underline as UnderlineIcon,
  Heading1, Heading2, Heading3, Pilcrow,
  List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignJustify,
  ArrowLeft, FileDown, Clock, X, RotateCcw,
  Search, Maximize2, Minus, StickyNote, Highlighter, Type,
  ChevronUp, ChevronDown, List as ListIcon,
} from 'lucide-react'

// ── palette ────────────────────────────────────────────────────────────────────
const P = {
  bg:        '#f5f0e8',
  surface:   '#faf7f2',
  border:    '#e0d8cc',
  text:      '#3d3028',
  muted:     '#b0a090',
  accent:    '#4a7a4a',
  accentBg:  '#e8ede8',
}

const FONTS = [
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Merriweather', value: "'Merriweather', serif" },
  { label: 'Lora', value: "'Lora', serif" },
  { label: 'Playfair Display', value: "'Playfair Display', serif" },
  { label: 'EB Garamond', value: "'EB Garamond', serif" },
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Courier Prime', value: "'Courier Prime', monospace" },
]

const FONT_SIZES = ['12', '14', '16', '18', '20', '24']

// ── helpers ────────────────────────────────────────────────────────────────────

function countWords(html) {
  if (!html) return 0
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? text.split(' ').length : 0
}

function formatSavedAgo(date) {
  if (!date) return null
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 5)  return 'Salvo agora'
  if (secs < 60) return `Salvo há ${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `Salvo há ${mins}min`
  return `Salvo há ${Math.floor(mins / 60)}h`
}

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatVersionDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// ── BulletList sem traço — só * dispara lista ─────────────────────────────────
// Padrão: /^\s*([-+*])\s$/ — desativamos o traço para evitar conflito com diálogo

const BulletListNoMinus = BulletList.extend({
  addInputRules() {
    return [
      wrappingInputRule({ find: /^\s*(\*)\s$/, type: this.type }),
    ]
  },
})

// ── AuthorNote extension ───────────────────────────────────────────────────────

const AuthorNote = Node.create({
  name: 'authorNote',
  group: 'block',
  content: 'inline*',
  parseHTML() {
    return [{ tag: 'div.author-note' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'author-note' }), 0]
  },
  addCommands() {
    return {
      insertAuthorNote: () => ({ chain }) =>
        chain().insertContent({
          type: 'authorNote',
          content: [{ type: 'text', text: 'Nota do autor...' }],
        }).run(),
    }
  },
})

// ── SearchHighlight plugin ─────────────────────────────────────────────────────

const searchPluginKey = new PluginKey('searchHighlight')

function buildSearchDecorations(doc, term) {
  if (!term) return DecorationSet.empty
  const decorations = []
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escapedTerm, 'gi')

  doc.descendants((node, pos) => {
    if (!node.isText) return
    let match
    while ((match = regex.exec(node.text)) !== null) {
      decorations.push(
        Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
          class: 'search-result',
        })
      )
    }
  })
  return DecorationSet.create(doc, decorations)
}

const SearchHighlightExtension = Extension.create({
  name: 'searchHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchPluginKey,
        state: {
          init: () => ({ term: '', decorations: DecorationSet.empty }),
          apply(tr, prev) {
            const meta = tr.getMeta(searchPluginKey)
            if (meta !== undefined) {
              return {
                term: meta,
                decorations: buildSearchDecorations(tr.doc, meta),
              }
            }
            if (tr.docChanged) {
              return {
                term: prev.term,
                decorations: buildSearchDecorations(tr.doc, prev.term),
              }
            }
            return prev
          },
        },
        props: {
          decorations(state) {
            return this.getState(state).decorations
          },
        },
      }),
    ]
  },
  addCommands() {
    return {
      setSearchHighlight: (term) => ({ tr, dispatch }) => {
        if (dispatch) {
          tr.setMeta(searchPluginKey, term)
          dispatch(tr)
        }
        return true
      },
    }
  },
})

// ── toolbar button ─────────────────────────────────────────────────────────────

function ToolBtn({ onClick, active, title, children, disabled }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      style={{
        width: 28, height: 28, borderRadius: 4, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? P.accentBg : 'transparent',
        color: active ? P.accent : P.text,
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return (
    <div style={{ width: 1, height: 20, background: P.border, margin: '0 2px', flexShrink: 0 }} />
  )
}

function ColorBtn({ title, color, onChange, icon: Icon }) {
  const inputRef = useRef(null)
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); inputRef.current?.click() }}
      title={title}
      style={{
        width: 28, height: 30, borderRadius: 4, border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', color: P.text, gap: 1, flexShrink: 0, padding: '2px 0',
      }}
    >
      <Icon size={13} />
      <div style={{ width: 16, height: 3, borderRadius: 1, background: color }} />
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
      />
    </button>
  )
}

// ── SearchBar ──────────────────────────────────────────────────────────────────

function SearchBar({ editor, searchTerm, setSearchTerm, replaceTerm, setReplaceTerm, onClose, resultCount, resultIndex }) {
  const handleSearch = (val) => {
    setSearchTerm(val)
    editor?.commands.setSearchHighlight(val)
  }

  const goNext = () => {
    if (!editor || !searchTerm) return
    const { state } = editor
    const pluginState = searchPluginKey.getState(state)
    if (!pluginState?.decorations) return
    const decorations = pluginState.decorations.find()
    if (!decorations.length) return
    const { from } = state.selection
    const next = decorations.find((d) => d.from > from) ?? decorations[0]
    editor.chain().focus().setTextSelection({ from: next.from, to: next.to }).scrollIntoView().run()
  }

  const goPrev = () => {
    if (!editor || !searchTerm) return
    const { state } = editor
    const pluginState = searchPluginKey.getState(state)
    if (!pluginState?.decorations) return
    const decorations = pluginState.decorations.find()
    if (!decorations.length) return
    const { from } = state.selection
    const prev = [...decorations].reverse().find((d) => d.to < from) ?? decorations[decorations.length - 1]
    editor.chain().focus().setTextSelection({ from: prev.from, to: prev.to }).scrollIntoView().run()
  }

  const doReplace = () => {
    if (!editor || !searchTerm) return
    const { state } = editor
    const { from, to } = state.selection
    const selectedText = state.doc.textBetween(from, to)
    if (selectedText.toLowerCase() === searchTerm.toLowerCase()) {
      editor.chain().focus().deleteSelection().insertContent(replaceTerm).run()
      goNext()
    } else {
      goNext()
    }
  }

  const doReplaceAll = () => {
    if (!editor || !searchTerm) return
    const { state } = editor
    const pluginState = searchPluginKey.getState(state)
    if (!pluginState?.decorations) return
    const decorations = [...pluginState.decorations.find()].reverse()
    let chain = editor.chain().focus()
    for (const deco of decorations) {
      chain = chain.setTextSelection({ from: deco.from, to: deco.to }).deleteSelection().insertContent(replaceTerm)
    }
    chain.run()
    editor.commands.setSearchHighlight(searchTerm)
  }

  const count = editor ? searchPluginKey.getState(editor.state)?.decorations.find().length ?? 0 : 0

  return (
    <div style={{
      height: 44, flexShrink: 0, borderBottom: `1px solid ${P.border}`,
      background: P.surface, display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 8,
    }}>
      <Search size={13} style={{ color: P.muted, flexShrink: 0 }} />
      <input
        autoFocus
        value={searchTerm}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Buscar..."
        style={{
          border: `1px solid ${P.border}`, borderRadius: 4, padding: '3px 8px',
          fontSize: 12, background: '#fff', color: P.text, width: 160, outline: 'none',
        }}
      />
      <span style={{ fontSize: 11, color: P.muted, flexShrink: 0 }}>
        {count > 0 ? `${count} resultado${count !== 1 ? 's' : ''}` : searchTerm ? '0 resultados' : ''}
      </span>
      <button onMouseDown={(e) => { e.preventDefault(); goPrev() }} title="Anterior"
        style={{ background: 'none', border: `1px solid ${P.border}`, borderRadius: 4, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.text }}>
        <ChevronUp size={11} />
      </button>
      <button onMouseDown={(e) => { e.preventDefault(); goNext() }} title="Próximo"
        style={{ background: 'none', border: `1px solid ${P.border}`, borderRadius: 4, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.text }}>
        <ChevronDown size={11} />
      </button>
      <div style={{ width: 1, height: 20, background: P.border }} />
      <input
        value={replaceTerm}
        onChange={(e) => setReplaceTerm(e.target.value)}
        placeholder="Substituir por..."
        style={{
          border: `1px solid ${P.border}`, borderRadius: 4, padding: '3px 8px',
          fontSize: 12, background: '#fff', color: P.text, width: 160, outline: 'none',
        }}
      />
      <button onMouseDown={(e) => { e.preventDefault(); doReplace() }}
        style={{ padding: '2px 10px', fontSize: 11, background: 'none', border: `1px solid ${P.border}`, borderRadius: 4, cursor: 'pointer', color: P.text, whiteSpace: 'nowrap' }}>
        Substituir
      </button>
      <button onMouseDown={(e) => { e.preventDefault(); doReplaceAll() }}
        style={{ padding: '2px 10px', fontSize: 11, background: 'none', border: `1px solid ${P.border}`, borderRadius: 4, cursor: 'pointer', color: P.text, whiteSpace: 'nowrap' }}>
        Subst. todos
      </button>
      <div style={{ flex: 1 }} />
      <button onMouseDown={(e) => { e.preventDefault(); onClose() }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: P.muted, display: 'flex', alignItems: 'center' }}>
        <X size={13} />
      </button>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────────

export default function WriterEditorPage() {
  const { projectId, chapterId } = useParams()
  const navigate = useNavigate()

  const {
    project, chapter,
    autosaveStatus, lastSavedAt,
    exportStatus, exportTaskId,
    focusMode, setFocusMode,
    searchOpen, setSearchOpen,
    searchTerm, setSearchTerm,
    replaceTerm, setReplaceTerm,
    setProject, setChapter,
    setExportState,
    doAutosave,
  } = useWriterStore()

  const [loading, setLoading] = useState(true)
  const [wordCount, setWordCount] = useState(0)
  const [selectionWords, setSelectionWords] = useState(0)
  const [sidePanelOpen, setSidePanelOpen] = useState(false)
  const [sidePanelTab, setSidePanelTab] = useState('versions') // 'versions' | 'toc'
  const [versions, setVersions] = useState([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [pendingRestore, setPendingRestore] = useState(null)
  const [savingVersion, setSavingVersion] = useState(false)
  const [savedAgoLabel, setSavedAgoLabel] = useState(null)
  const [tocItems, setTocItems] = useState([])

  // Font preferences
  const [font, setFont] = useState(
    () => localStorage.getItem('writer_font_preference') || 'Georgia, serif'
  )
  const [fontSize, setFontSize] = useState(
    () => localStorage.getItem('writer_fontsize_preference') || '14'
  )
  const [textColor, setTextColor] = useState(P.text)
  const [highlightColor, setHighlightColor] = useState('#fdecc8')

  // Title editing
  const [titleInput, setTitleInput] = useState('')
  const titleDebounceRef = useRef(null)

  // Saved-ago ticker
  useEffect(() => {
    setSavedAgoLabel(formatSavedAgo(lastSavedAt))
    const id = setInterval(() => setSavedAgoLabel(formatSavedAgo(lastSavedAt)), 5000)
    return () => clearInterval(id)
  }, [lastSavedAt])

  // Focus mode: ESC to exit
  useEffect(() => {
    if (!focusMode) return
    const handler = (e) => { if (e.key === 'Escape') setFocusMode(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [focusMode, setFocusMode])

  // Load data
  useEffect(() => {
    Promise.all([
      writerService.getProject(projectId),
      writerService.getChapter(chapterId),
    ]).then(([{ data: proj }, { data: chap }]) => {
      setProject(proj)
      setChapter(chap)
      setTitleInput(chap.title)
      setWordCount(countWords(chap.html_content))
    }).finally(() => setLoading(false))
  }, [projectId, chapterId, setProject, setChapter])

  // Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: false }),
      BulletListNoMinus,
      Typography.configure({
        // Disable smart quotes — they interfere with PT-BR dialogue (— character)
        openDoubleQuote: false,
        closeDoubleQuote: false,
        openSingleQuote: false,
        closeSingleQuote: false,
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontFamily,
      FontSize.configure({ types: ['textStyle'] }),
      Color,
      Highlight.configure({ multicolor: true }),
      AuthorNote,
      SearchHighlightExtension,
    ],
    content: '',
    onUpdate: ({ editor: ed }) => {
      setWordCount(countWords(ed.getHTML()))
      // TOC from headings
      const headings = []
      ed.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          headings.push({ level: node.attrs.level, text: node.textContent, pos })
        }
      })
      setTocItems(headings)
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to } = ed.state.selection
      if (from === to) { setSelectionWords(0); return }
      const text = ed.state.doc.textBetween(from, to, ' ')
      setSelectionWords(text.trim() ? text.trim().split(/\s+/).length : 0)
    },
    onBlur: ({ editor: ed }) => {
      doAutosave(chapterId, ed.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'outline-none',
        style: [
          `min-height: calc(100vh - 220px)`,
          `line-height: 1.8`,
          `color: ${P.text}`,
        ].join('; '),
      },
    },
  })

  // Set editor content once chapter is loaded
  useEffect(() => {
    if (editor && chapter && !loading) {
      editor.commands.setContent(chapter.html_content || '')
      // Rebuild TOC
      const headings = []
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          headings.push({ level: node.attrs.level, text: node.textContent, pos })
        }
      })
      setTocItems(headings)
    }
  }, [editor, chapter, loading])

  // Autosave interval — every 30s
  useEffect(() => {
    if (!editor) return
    const id = setInterval(() => doAutosave(chapterId, editor.getHTML()), 30000)
    return () => clearInterval(id)
  }, [editor, chapterId, doAutosave])

  // Export polling
  useEffect(() => {
    if (exportStatus !== 'exporting' || !exportTaskId) return
    const id = setInterval(async () => {
      try {
        const { data } = await writerService.exportStatus(chapterId, exportTaskId)
        if (data.status === 'done') {
          clearInterval(id)
          setExportState({ exportStatus: 'done', exportUrl: data.url })
          if (data.url) {
            const a = document.createElement('a')
            a.href = data.url
            a.download = 'capitulo.docx'
            a.click()
          }
          setTimeout(() => setExportState({ exportStatus: 'idle' }), 3000)
        } else if (data.status === 'error') {
          clearInterval(id)
          setExportState({ exportStatus: 'error' })
          alert(`Erro ao exportar: ${data.error || 'erro desconhecido'}`)
          setTimeout(() => setExportState({ exportStatus: 'idle' }), 2000)
        }
      } catch {
        clearInterval(id)
        setExportState({ exportStatus: 'error' })
      }
    }, 3000)
    return () => clearInterval(id)
  }, [exportStatus, exportTaskId, chapterId, setExportState])

  // Font/size handlers
  const handleFontChange = (val) => {
    setFont(val)
    localStorage.setItem('writer_font_preference', val)
  }
  const handleFontSizeChange = (val) => {
    setFontSize(val)
    localStorage.setItem('writer_fontsize_preference', val)
  }

  // Title debounce
  const handleTitleChange = (val) => {
    setTitleInput(val)
    clearTimeout(titleDebounceRef.current)
    titleDebounceRef.current = setTimeout(async () => {
      try {
        await writerService.updateChapter(chapterId, { title: val.trim() })
        if (chapter) setChapter({ ...chapter, title: val.trim() })
      } catch { /* ignore */ }
    }, 800)
  }

  // Side panel
  const openPanel = useCallback(async (tab) => {
    setSidePanelTab(tab)
    if (tab === 'versions') {
      setSidePanelOpen(true)
      setVersionsLoading(true)
      try {
        const { data } = await writerService.getVersions(chapterId)
        setVersions(data)
      } finally {
        setVersionsLoading(false)
      }
    } else {
      setSidePanelOpen(true)
    }
  }, [chapterId])

  const handleSaveVersionNow = async () => {
    if (!editor) return
    setSavingVersion(true)
    try {
      await writerService.saveVersion(chapterId, { html_content: editor.getHTML(), label: 'manual' })
      const { data } = await writerService.getVersions(chapterId)
      setVersions(data)
    } finally {
      setSavingVersion(false)
    }
  }

  const handleRestore = async () => {
    if (!pendingRestore || !editor) return
    try {
      const { data } = await writerService.getVersion(chapterId, pendingRestore.id)
      editor.commands.setContent(data.html_content)
      doAutosave(chapterId, data.html_content)
    } finally {
      setPendingRestore(null)
    }
  }

  const handleExport = async () => {
    if (exportStatus === 'exporting') return
    try {
      const { data } = await writerService.exportDocx(chapterId)
      setExportState({ exportStatus: 'exporting', exportTaskId: data.task_id, exportUrl: null })
    } catch {
      alert('Não foi possível iniciar exportação.')
    }
  }

  const handleSearchToggle = () => {
    if (searchOpen) {
      setSearchOpen(false)
      editor?.commands.setSearchHighlight('')
      setSearchTerm('')
    } else {
      setSearchOpen(true)
    }
  }

  const scrollToHeading = (pos) => {
    if (!editor) return
    editor.chain().focus().setTextSelection(pos).scrollIntoView().run()
  }

  const readTime = Math.max(1, Math.round(wordCount / 200))

  // ── editor CSS (injected via <style>) ────────────────────────────────────────
  const editorStyles = `
    .ProseMirror p { margin-bottom: 0.8em; }
    .ProseMirror h1 { font-size: 1.7em; font-weight: 700; margin: 0.6em 0 0.3em; font-family: Arial, sans-serif; color: ${P.text}; }
    .ProseMirror h2 { font-size: 1.35em; font-weight: 700; margin: 0.6em 0 0.3em; font-family: Arial, sans-serif; color: ${P.text}; }
    .ProseMirror h3 { font-size: 1.1em; font-weight: 700; margin: 0.5em 0 0.2em; font-family: Arial, sans-serif; color: ${P.text}; }
    .ProseMirror ul { list-style: disc; padding-left: 1.5em; margin-bottom: 0.8em; }
    .ProseMirror ol { list-style: decimal; padding-left: 1.5em; margin-bottom: 0.8em; }
    .ProseMirror li { margin-bottom: 0.2em; }
    .ProseMirror blockquote { border-left: 3px solid ${P.border}; padding-left: 1em; margin: 0.8em 0; color: ${P.muted}; font-style: italic; }
    .ProseMirror hr { border: none; border-top: 1px solid #c0b0a0; margin: 24px auto; width: 40%; }
    .ProseMirror:focus { outline: none; }
    .ProseMirror div.author-note {
      background: #f0ede6; border-left: 3px solid #c0b0a0;
      border-radius: 0 6px 6px 0; padding: 8px 12px; color: #8a7a6a;
      font-style: italic; font-size: 13px; margin: 8px 0; position: relative;
    }
    .ProseMirror div.author-note::before {
      content: 'NOTA DO AUTOR — não exportada';
      display: block; font-size: 9px; font-style: normal;
      font-family: sans-serif; letter-spacing: 0.06em; color: #a89880; margin-bottom: 4px;
    }
    .ProseMirror .search-result { background: #fdecc8; border-radius: 2px; }
    .ProseMirror mark { border-radius: 2px; padding: 0 1px; }
  `

  if (loading) {
    return (
      <div style={{ background: P.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: P.muted, fontSize: 14 }}>Carregando...</span>
      </div>
    )
  }

  // ── Focus mode render ────────────────────────────────────────────────────────
  if (focusMode) {
    return (
      <div style={{ background: '#1a1a1a', height: '100vh', width: '100vw', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <style>{`
          ${editorStyles}
          .focus-editor .ProseMirror { color: #d4c9b8 !important; }
          .focus-editor .ProseMirror h1, .focus-editor .ProseMirror h2, .focus-editor .ProseMirror h3 { color: #d4c9b8 !important; }
          .focus-editor .ProseMirror blockquote { border-left-color: #4a4038; color: #a89880; }
          .focus-editor .ProseMirror hr { border-top-color: #4a4038; }
        `}</style>
        <button
          onClick={() => setFocusMode(false)}
          style={{
            position: 'absolute', top: 16, right: 20, zIndex: 10,
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#6a6060', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <X size={12} /> Esc — Sair do foco
        </button>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
          <div
            className="focus-editor"
            style={{ width: '100%', maxWidth: 680, padding: '0 24px 48px', fontFamily: font, fontSize: `${fontSize}px` }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    )
  }

  // ── Normal render ────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', width: '100vw',
      overflow: 'hidden', background: P.bg,
    }}>
      <style>{editorStyles}</style>

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: 40, background: P.surface, borderBottom: `1px solid ${P.border}`,
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(`/writer/project/${projectId}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: P.muted, fontSize: 12, padding: 0 }}
        >
          <ArrowLeft size={13} /> Voltar
        </button>

        <span style={{ color: P.border, fontSize: 12 }}>›</span>
        <span style={{ fontSize: 12, color: P.muted, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project?.title ?? '—'}
        </span>
        <span style={{ color: P.border, fontSize: 12 }}>›</span>
        <span style={{ fontSize: 12, color: P.text, fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {titleInput || chapter?.title || '—'}
        </span>

        <div style={{ flex: 1 }} />

        {autosaveStatus === 'saving' && <span style={{ fontSize: 11, color: P.muted }}>Salvando...</span>}
        {autosaveStatus === 'saved' && savedAgoLabel && <span style={{ fontSize: 11, color: P.muted }}>{savedAgoLabel}</span>}
        {autosaveStatus === 'error' && <span style={{ fontSize: 11, color: '#c0392b' }}>Erro ao salvar</span>}

        {/* Buscar */}
        <button
          onClick={handleSearchToggle}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: searchOpen ? P.accentBg : 'none',
            border: `1px solid ${searchOpen ? P.accent : P.border}`,
            borderRadius: 5, cursor: 'pointer',
            color: searchOpen ? P.accent : P.text,
            fontSize: 12, padding: '3px 10px',
          }}
        >
          <Search size={12} /> Buscar
        </button>

        {/* Foco */}
        <button
          onClick={() => setFocusMode(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${P.border}`, borderRadius: 5, cursor: 'pointer', color: P.text, fontSize: 12, padding: '3px 10px' }}
        >
          <Maximize2 size={12} /> Foco
        </button>

        {/* Versões */}
        <button
          onClick={() => sidePanelOpen && sidePanelTab === 'versions' ? setSidePanelOpen(false) : openPanel('versions')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: sidePanelOpen && sidePanelTab === 'versions' ? P.accentBg : 'none',
            border: `1px solid ${sidePanelOpen && sidePanelTab === 'versions' ? P.accent : P.border}`,
            borderRadius: 5, cursor: 'pointer',
            color: sidePanelOpen && sidePanelTab === 'versions' ? P.accent : P.text,
            fontSize: 12, padding: '3px 10px',
          }}
        >
          <Clock size={12} /> Versões
        </button>

        {/* Exportar */}
        <button
          onClick={handleExport}
          disabled={exportStatus === 'exporting'}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: P.accent, border: 'none', borderRadius: 5,
            cursor: exportStatus === 'exporting' ? 'not-allowed' : 'pointer',
            color: '#fff', fontSize: 12, padding: '3px 12px',
            opacity: exportStatus === 'exporting' ? 0.7 : 1,
          }}
        >
          <FileDown size={12} /> {exportStatus === 'exporting' ? 'Exportando...' : 'Exportar'}
        </button>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      {searchOpen && (
        <SearchBar
          editor={editor}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          replaceTerm={replaceTerm}
          setReplaceTerm={setReplaceTerm}
          onClose={() => {
            setSearchOpen(false)
            editor?.commands.setSearchHighlight('')
            setSearchTerm('')
          }}
        />
      )}

      {/* ── Main body ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── Left content ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Toolbar */}
          <div style={{
            height: 42, flexShrink: 0, borderBottom: `1px solid ${P.border}`,
            display: 'flex', alignItems: 'center', gap: 1, padding: '0 12px',
            background: P.surface, overflowX: 'auto',
          }}>
            {/* Font selector */}
            <select
              value={font}
              onChange={(e) => handleFontChange(e.target.value)}
              title="Fonte"
              style={{
                border: `1px solid ${P.border}`, borderRadius: 4, fontSize: 11,
                padding: '2px 4px', background: '#fff', color: P.text,
                cursor: 'pointer', height: 24, maxWidth: 120, flexShrink: 0,
              }}
            >
              {FONTS.map((f) => (
                <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
              ))}
            </select>

            {/* Font size selector */}
            <select
              value={fontSize}
              onChange={(e) => handleFontSizeChange(e.target.value)}
              title="Tamanho da fonte"
              style={{
                border: `1px solid ${P.border}`, borderRadius: 4, fontSize: 11,
                padding: '2px 4px', background: '#fff', color: P.text,
                cursor: 'pointer', height: 24, width: 46, flexShrink: 0, marginLeft: 2,
              }}
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <Sep />

            <ToolBtn title="Negrito (Ctrl+B)" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
              <Bold size={13} />
            </ToolBtn>
            <ToolBtn title="Itálico (Ctrl+I)" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
              <Italic size={13} />
            </ToolBtn>
            <ToolBtn title="Sublinhado (Ctrl+U)" active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
              <UnderlineIcon size={13} />
            </ToolBtn>

            {/* Text color */}
            <ColorBtn
              title="Cor do texto"
              color={textColor}
              icon={Type}
              onChange={(c) => {
                setTextColor(c)
                editor?.chain().focus().setColor(c).run()
              }}
            />

            {/* Highlight color */}
            <ColorBtn
              title="Destaque"
              color={highlightColor}
              icon={Highlighter}
              onChange={(c) => {
                setHighlightColor(c)
                editor?.chain().focus().toggleHighlight({ color: c }).run()
              }}
            />

            <Sep />

            <ToolBtn title="Parágrafo" active={editor?.isActive('paragraph')} onClick={() => editor?.chain().focus().setParagraph().run()}>
              <Pilcrow size={13} />
            </ToolBtn>
            <ToolBtn title="Título 1" active={editor?.isActive('heading', { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
              <Heading1 size={13} />
            </ToolBtn>
            <ToolBtn title="Título 2" active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
              <Heading2 size={13} />
            </ToolBtn>
            <ToolBtn title="Título 3" active={editor?.isActive('heading', { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
              <Heading3 size={13} />
            </ToolBtn>

            <Sep />

            <ToolBtn title="Lista com marcadores" active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
              <List size={13} />
            </ToolBtn>
            <ToolBtn title="Lista numerada" active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
              <ListOrdered size={13} />
            </ToolBtn>
            <ToolBtn title="Citação" active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
              <Quote size={13} />
            </ToolBtn>

            <Sep />

            <ToolBtn title="Alinhar à esquerda" active={editor?.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
              <AlignLeft size={13} />
            </ToolBtn>
            <ToolBtn title="Centralizar" active={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
              <AlignCenter size={13} />
            </ToolBtn>
            <ToolBtn title="Justificar" active={editor?.isActive({ textAlign: 'justify' })} onClick={() => editor?.chain().focus().setTextAlign('justify').run()}>
              <AlignJustify size={13} />
            </ToolBtn>

            <Sep />

            {/* Horizontal rule */}
            <ToolBtn title="Separador de cena" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
              <Minus size={13} />
            </ToolBtn>

            {/* Author note */}
            <ToolBtn title="Nota do autor (não exportada)" onClick={() => editor?.commands.insertAuthorNote()}>
              <StickyNote size={13} />
            </ToolBtn>

            <div style={{ flex: 1 }} />

            {/* AI correction placeholder */}
            <button
              onClick={() => {
                // toast "Em breve" — inline fallback sem lib de toast
                const el = document.createElement('div')
                el.textContent = '✦ Corrigir com IA — Em breve'
                Object.assign(el.style, {
                  position: 'fixed', bottom: 48, right: 24, zIndex: 9999,
                  background: P.text, color: '#fff', padding: '8px 16px',
                  borderRadius: 8, fontSize: 12, pointerEvents: 'none',
                  transition: 'opacity 0.3s',
                })
                document.body.appendChild(el)
                setTimeout(() => { el.style.opacity = '0' }, 1800)
                setTimeout(() => document.body.removeChild(el), 2100)
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: `1px solid ${P.border}`,
                borderRadius: 5, cursor: 'pointer', color: P.muted,
                fontSize: 11, padding: '3px 10px', flexShrink: 0,
              }}
            >
              ✦ Corrigir com IA
            </button>
          </div>

          {/* Chapter meta */}
          <div style={{
            padding: '10px 24px 10px', borderBottom: `1px solid ${P.border}`,
            flexShrink: 0, background: P.surface,
          }}>
            <div style={{ fontSize: 10, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Capítulo {(chapter?.order ?? 0) + 1}
            </div>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Título do capítulo..."
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 20, fontWeight: 600, color: P.text,
                width: '100%', fontFamily: 'Georgia, serif',
              }}
            />
            <div style={{ fontSize: 11, color: P.muted, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span>{wordCount.toLocaleString('pt-BR')} palavras</span>
              <span>·</span>
              <span>{readTime} min de leitura</span>
              <span>·</span>
              <span>Última edição: {formatTime(chapter?.updated_at)}</span>
              {selectionWords > 0 && (
                <>
                  <span>·</span>
                  <span style={{ color: P.accent }}>{selectionWords} palavras selecionadas</span>
                </>
              )}
            </div>
          </div>

          {/* Editor area */}
          <div
            style={{
              flex: 1, overflowY: 'auto', padding: '24px 48px',
              fontFamily: font, fontSize: `${fontSize}px`,
            }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* ── Side panel ────────────────────────────────────────────────── */}
        <div style={{
          width: sidePanelOpen ? 220 : 0,
          flexShrink: 0,
          background: P.surface,
          borderLeft: sidePanelOpen ? `1px solid ${P.border}` : 'none',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.2s ease',
        }}>
          {/* Panel header with tabs */}
          <div style={{
            padding: '8px 12px 0', flexShrink: 0,
            borderBottom: `1px solid ${P.border}`,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 0 }}>
                {['toc', 'versions'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setSidePanelTab(tab); if (tab === 'versions' && versions.length === 0) openPanel('versions') }}
                    style={{
                      fontSize: 11, fontWeight: 500, padding: '3px 10px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: sidePanelTab === tab ? P.accent : P.muted,
                      borderBottom: `2px solid ${sidePanelTab === tab ? P.accent : 'transparent'}`,
                    }}
                  >
                    {tab === 'toc' ? 'Índice' : 'Versões'}
                  </button>
                ))}
              </div>
              <button onClick={() => setSidePanelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: P.muted, padding: 2 }}>
                <X size={13} />
              </button>
            </div>
          </div>

          {/* TOC tab */}
          {sidePanelTab === 'toc' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
              {tocItems.length === 0 ? (
                <div style={{ fontSize: 11, color: P.muted, padding: '8px 4px' }}>
                  Use H1, H2, H3 para gerar o índice
                </div>
              ) : tocItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => scrollToHeading(item.pos)}
                  title={item.text}
                  style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    padding: `4px 4px 4px ${4 + (item.level - 1) * 10}px`,
                    cursor: 'pointer', borderRadius: 4, fontSize: 11,
                    color: item.level === 1 ? P.text : P.muted,
                    fontWeight: item.level === 1 ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = P.accentBg}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  {item.text || '(sem título)'}
                </button>
              ))}
            </div>
          )}

          {/* Versions tab */}
          {sidePanelTab === 'versions' && (
            <>
              <div style={{ padding: '8px 12px', flexShrink: 0 }}>
                <button
                  onClick={handleSaveVersionNow}
                  disabled={savingVersion}
                  style={{
                    width: '100%', padding: '6px 0', fontSize: 11, fontWeight: 500,
                    background: P.accentBg, border: `1px solid ${P.accent}`,
                    color: P.accent, borderRadius: 5, cursor: 'pointer',
                    opacity: savingVersion ? 0.6 : 1,
                  }}
                >
                  {savingVersion ? 'Salvando...' : 'Salvar versão agora'}
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 8px' }}>
                {versionsLoading ? (
                  <div style={{ fontSize: 11, color: P.muted, padding: '8px 4px' }}>Carregando...</div>
                ) : versions.length === 0 ? (
                  <div style={{ fontSize: 11, color: P.muted, padding: '8px 4px' }}>Nenhuma versão salva.</div>
                ) : versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setPendingRestore(v)}
                    style={{
                      width: '100%', textAlign: 'left', background: 'none', border: 'none',
                      padding: '8px 4px', cursor: 'pointer', borderRadius: 4,
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = P.accentBg}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontSize: 11, color: P.text }}>{formatVersionDate(v.saved_at)}</span>
                    <span style={{
                      fontSize: 10, color: v.label === 'autosave' ? P.muted : P.accent,
                      background: v.label === 'autosave' ? 'transparent' : P.accentBg,
                      padding: v.label === 'autosave' ? 0 : '1px 6px', borderRadius: 3,
                    }}>
                      {v.label === 'autosave' ? 'autosave' : v.label}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <div style={{
        height: 28, flexShrink: 0,
        background: P.surface, borderTop: `1px solid ${P.border}`,
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
        fontSize: 11, color: P.muted,
      }}>
        <span>Autosave ativo</span>
        <span>·</span>
        <span>{wordCount.toLocaleString('pt-BR')} palavras</span>
        <span>·</span>
        <span>Projeto: {project?.title ?? '—'}</span>
        {/* TOC toggle from status bar */}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => sidePanelOpen && sidePanelTab === 'toc' ? setSidePanelOpen(false) : openPanel('toc')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: sidePanelOpen && sidePanelTab === 'toc' ? P.accent : P.muted,
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: 0,
          }}
        >
          <ListIcon size={11} /> Índice
        </button>
      </div>

      {/* ── Restore modal ──────────────────────────────────────────────────── */}
      {pendingRestore && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10,
            width: 360, padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <RotateCcw size={16} style={{ color: P.accent }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: P.text }}>Restaurar versão</span>
            </div>
            <p style={{ fontSize: 13, color: P.muted, lineHeight: 1.5, marginBottom: 20 }}>
              Restaurar a versão de <strong style={{ color: P.text }}>{formatVersionDate(pendingRestore.saved_at)}</strong>?
              O conteúdo atual será substituído.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setPendingRestore(null)}
                style={{ padding: '6px 16px', fontSize: 12, background: 'none', border: `1px solid ${P.border}`, borderRadius: 5, cursor: 'pointer', color: P.text }}
              >
                Cancelar
              </button>
              <button
                onClick={handleRestore}
                style={{ padding: '6px 16px', fontSize: 12, background: P.accent, border: 'none', borderRadius: 5, cursor: 'pointer', color: '#fff' }}
              >
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
