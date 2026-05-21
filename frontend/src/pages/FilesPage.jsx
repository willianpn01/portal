import { useEffect, useRef, useState } from 'react'
import {
  ChevronRight, Home, Upload, FolderPlus, Search,
  Download, Pencil, Copy, Scissors, Trash2, Eye,
  Folder, FileText, Image, Film, Archive, Music,
  File, ArrowUp, Loader2, PackagePlus, PackageOpen,
} from 'lucide-react'
import useFileManagerStore from '@/stores/fileManagerStore'
import { fileManagerService } from '@/services/fileManagerService'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/utils/cn'
import { PageHeader } from '@/components/ui/PageHeader'

// ── type icon ─────────────────────────────────────────────────────────────────

const EXT_ICONS = {
  pdf: { icon: FileText, color: 'text-red-400' },
  doc: { icon: FileText, color: 'text-blue-400' },
  docx: { icon: FileText, color: 'text-blue-400' },
  xls: { icon: FileText, color: 'text-green-400' },
  xlsx: { icon: FileText, color: 'text-green-400' },
  txt: { icon: FileText, color: 'text-gray-400' },
  md: { icon: FileText, color: 'text-purple-400' },
  json: { icon: FileText, color: 'text-yellow-400' },
  csv: { icon: FileText, color: 'text-green-400' },
  log: { icon: FileText, color: 'text-gray-400' },
  png: { icon: Image, color: 'text-pink-400' },
  jpg: { icon: Image, color: 'text-pink-400' },
  jpeg: { icon: Image, color: 'text-pink-400' },
  gif: { icon: Image, color: 'text-pink-400' },
  webp: { icon: Image, color: 'text-pink-400' },
  svg: { icon: Image, color: 'text-orange-400' },
  mp4: { icon: Film, color: 'text-blue-300' },
  mkv: { icon: Film, color: 'text-blue-300' },
  avi: { icon: Film, color: 'text-blue-300' },
  mov: { icon: Film, color: 'text-blue-300' },
  mp3: { icon: Music, color: 'text-yellow-300' },
  wav: { icon: Music, color: 'text-yellow-300' },
  flac: { icon: Music, color: 'text-yellow-300' },
  zip: { icon: Archive, color: 'text-orange-400' },
  tar: { icon: Archive, color: 'text-orange-400' },
  gz: { icon: Archive, color: 'text-orange-400' },
  rar: { icon: Archive, color: 'text-orange-400' },
}

function FileIcon({ item, size = 16 }) {
  if (item.type === 'directory') return <Folder size={size} style={{ color: 'var(--gold)', flexShrink: 0 }} />
  const { icon: Icon, color } = EXT_ICONS[item.extension] ?? { icon: File, color: 'text-gray-400' }
  return <Icon size={size} className={cn(color, 'shrink-0')} />
}

// ── format helpers ────────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function joinPath(...parts) {
  return parts.filter(Boolean).join('/')
}

// ── breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ rootLabel, currentPath, onNavigate }) {
  const segments = currentPath ? currentPath.split('/') : []
  return (
    <nav className="flex items-center gap-1 text-sm flex-wrap">
      <button
        onClick={() => onNavigate('')}
        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
      >
        <Home size={14} />
        <span>{rootLabel}</span>
      </button>
      {segments.map((seg, i) => {
        const path = segments.slice(0, i + 1).join('/')
        const isLast = i === segments.length - 1
        return (
          <span key={path} className="flex items-center gap-1">
            <ChevronRight size={13} className="text-gray-600" />
            {isLast ? (
              <span className="text-gray-200 font-medium">{seg}</span>
            ) : (
              <button
                onClick={() => onNavigate(path)}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                {seg}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}

// ── modals ───────────────────────────────────────────────────────────────────

function DeleteModal({ open, item, onClose, onConfirm }) {
  const [typed, setTyped] = useState('')
  useEffect(() => { if (open) setTyped('') }, [open])
  if (!item) return null
  return (
    <Modal open={open} onClose={onClose} title="Confirmar exclusão">
      <p className="text-sm text-gray-300 mb-4">
        Esta ação é irreversível. Digite <strong className="text-white">{item.name}</strong> para confirmar.
      </p>
      <input
        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={item.name}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-100 transition-colors">
          Cancelar
        </button>
        <button
          onClick={() => { if (typed === item.name) onConfirm() }}
          disabled={typed !== item.name}
          className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-md transition-colors"
        >
          Excluir
        </button>
      </div>
    </Modal>
  )
}

function MoveModal({ open, item, title, onClose, onConfirm }) {
  const [dest, setDest] = useState('')
  useEffect(() => { if (open) setDest('') }, [open])
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-gray-400 mb-3">
        Destino (path relativo à raiz):
      </p>
      <input
        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 mb-4 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={dest}
        onChange={(e) => setDest(e.target.value)}
        placeholder="pasta/subpasta/novo_nome.ext"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-100 transition-colors">
          Cancelar
        </button>
        <button
          onClick={() => onConfirm(dest)}
          disabled={!dest.trim()}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-md transition-colors"
        >
          Confirmar
        </button>
      </div>
    </Modal>
  )
}

function NewFolderModal({ open, onClose, onConfirm }) {
  const [name, setName] = useState('')
  useEffect(() => { if (open) setName('') }, [open])
  return (
    <Modal open={open} onClose={onClose} title="Nova pasta">
      <input
        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome da pasta"
        autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onConfirm(name.trim()) }}
      />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-100 transition-colors">
          Cancelar
        </button>
        <button
          onClick={() => onConfirm(name.trim())}
          disabled={!name.trim()}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-md transition-colors"
        >
          Criar
        </button>
      </div>
    </Modal>
  )
}

function PreviewModal({ open, onClose, item, rootId, filePath }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !rootId || !filePath) return
    setLoading(true)
    setData(null)
    fileManagerService.preview(rootId, filePath)
      .then(r => setData(r.data))
      .catch(() => setData({ preview: null, reason: 'error' }))
      .finally(() => setLoading(false))
  }, [open, rootId, filePath])

  return (
    <Modal open={open} onClose={onClose} title={item?.name ?? 'Preview'} className="max-w-3xl">
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-400" />
        </div>
      )}
      {!loading && data && (
        <>
          {data.type === 'text' && data.preview != null && (
            <pre className="max-h-[60vh] overflow-auto text-xs text-gray-200 bg-gray-950 rounded-md p-4 font-mono whitespace-pre-wrap">
              {data.preview}
            </pre>
          )}
          {data.type === 'text' && data.reason === 'file_too_large' && (
            <p className="text-sm text-gray-400">Arquivo muito grande para preview ({">"} 100 KB).</p>
          )}
          {data.type === 'image' && (
            <div className="flex justify-center">
              <img
                src={data.download_url}
                alt={item?.name}
                className="max-h-[60vh] max-w-full object-contain rounded"
              />
            </div>
          )}
          {(data.type === 'pdf' || data.type === 'other' || data.reason === 'unsupported') && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400 mb-4">Preview não disponível para este tipo de arquivo.</p>
              {data.download_url && (
                <a
                  href={data.download_url}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                >
                  <Download size={15} /> Baixar arquivo
                </a>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

// ── file row ──────────────────────────────────────────────────────────────────

function FileRow({ item, rootId, currentPath, onNavigate, onAction }) {
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(item.name)
  const inputRef = useRef(null)

  const fullPath = joinPath(currentPath, item.name)

  const startRename = () => {
    setNewName(item.name)
    setRenaming(true)
    setTimeout(() => inputRef.current?.select(), 50)
  }

  const commitRename = () => {
    const trimmed = newName.trim()
    if (trimmed && trimmed !== item.name) {
      onAction('rename', item, trimmed)
    }
    setRenaming(false)
  }

  const handleClick = () => {
    if (item.type === 'directory') {
      onNavigate(fullPath)
    } else {
      onAction('preview', item)
    }
  }

  return (
    <tr className="border-b border-gray-800/60 hover:bg-gray-800/30 group transition-colors">
      {/* icon + name */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon item={item} />
          {renaming ? (
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setRenaming(false)
              }}
              className="bg-gray-800 border border-blue-500 rounded px-1.5 py-0.5 text-sm text-gray-100 focus:outline-none min-w-0 flex-1"
              autoFocus
            />
          ) : (
            <button
              onClick={handleClick}
              className={cn(
                'text-sm truncate text-left hover:underline min-w-0 flex-1',
                item.type === 'directory' && 'font-medium',
              )}
              style={{ color: 'var(--text)' }}
              title={item.name}
            >
              {item.name}
            </button>
          )}
        </div>
      </td>

      {/* size */}
      <td className="px-4 py-2.5 text-xs text-gray-500 tabular-nums whitespace-nowrap">
        {item.type === 'file' ? formatSize(item.size_bytes) : '—'}
      </td>

      {/* modified */}
      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap hidden sm:table-cell">
        {formatDate(item.modified_at)}
      </td>

      {/* actions */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {item.type === 'file' && (
            <ActionBtn title="Preview" icon={Eye} onClick={() => onAction('preview', item)} />
          )}
          {item.type === 'file' && (
            <a
              href={fileManagerService.download(rootId, fullPath)}
              download
              title="Download"
              className="p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition-colors"
            >
              <Download size={13} />
            </a>
          )}
          <ActionBtn title="Renomear" icon={Pencil} onClick={startRename} />
          <ActionBtn title="Mover" icon={Scissors} onClick={() => onAction('move', item)} />
          <ActionBtn title="Copiar" icon={Copy} onClick={() => onAction('copy', item)} />
          <ActionBtn
            title="Excluir"
            icon={Trash2}
            className="hover:text-red-400"
            onClick={() => onAction('delete', item)}
          />
        </div>
      </td>
    </tr>
  )
}

function ActionBtn({ icon: Icon, onClick, title, className }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn('p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition-colors', className)}
    >
      <Icon size={13} />
    </button>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function FilesPage() {
  const {
    roots, activeRoot, currentPath, items, isLoading, error,
    fetchRoots, setActiveRoot, navigate, goUp, refresh,
  } = useFileManagerStore()

  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [moveTarget, setMoveTarget] = useState(null)
  const [copyTarget, setCopyTarget] = useState(null)
  const [previewTarget, setPreviewTarget] = useState(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const uploadRef = useRef(null)

  useEffect(() => { fetchRoots() }, [fetchRoots])

  const toast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  const handleAction = (action, item, extra) => {
    const fullPath = joinPath(currentPath, item.name)

    if (action === 'preview') { setPreviewTarget(item); return }
    if (action === 'delete') { setDeleteTarget(item); return }
    if (action === 'move') { setMoveTarget(item); return }
    if (action === 'copy') { setCopyTarget(item); return }

    if (action === 'rename') {
      const newPath = joinPath(currentPath, extra)
      fileManagerService.operation({
        operation: 'rename',
        root: activeRoot.id,
        path: fullPath,
        new_path: newPath,
      }).then(refresh).catch((e) => toast(e.response?.data?.detail ?? 'Erro ao renomear'))
    }
  }

  const confirmDelete = () => {
    const fullPath = joinPath(currentPath, deleteTarget.name)
    fileManagerService.operation({ operation: 'delete', root: activeRoot.id, path: fullPath })
      .then(() => { toast(`"${deleteTarget.name}" excluído.`); setDeleteTarget(null); refresh() })
      .catch((e) => toast(e.response?.data?.detail ?? 'Erro ao excluir'))
  }

  const confirmMove = (dest) => {
    const src = joinPath(currentPath, moveTarget.name)
    fileManagerService.operation({ operation: 'move', root: activeRoot.id, path: src, new_path: dest })
      .then(() => { toast('Movido com sucesso.'); setMoveTarget(null); refresh() })
      .catch((e) => toast(e.response?.data?.detail ?? 'Erro ao mover'))
  }

  const confirmCopy = (dest) => {
    const src = joinPath(currentPath, copyTarget.name)
    fileManagerService.operation({ operation: 'copy', root: activeRoot.id, path: src, new_path: dest })
      .then(() => { toast('Copiado com sucesso.'); setCopyTarget(null); refresh() })
      .catch((e) => toast(e.response?.data?.detail ?? 'Erro ao copiar'))
  }

  const confirmNewFolder = (name) => {
    const path = joinPath(currentPath, name)
    fileManagerService.operation({ operation: 'mkdir', root: activeRoot.id, path })
      .then(() => { toast('Pasta criada.'); setNewFolderOpen(false); refresh() })
      .catch((e) => toast(e.response?.data?.detail ?? 'Erro ao criar pasta'))
  }

  const handleUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    fileManagerService.upload(activeRoot.id, currentPath, file)
      .then(() => { toast(`"${file.name}" enviado.`); refresh() })
      .catch((e) => toast(e.response?.data?.detail ?? 'Erro no upload'))
    e.target.value = ''
  }

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      <PageHeader icon="ti-folder" title="Arquivos" />
      {/* top: root selector + breadcrumb + toolbar */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          {/* root selector */}
          <select
            value={activeRoot?.id ?? ''}
            onChange={(e) => {
              const r = roots.find((x) => x.id === Number(e.target.value))
              if (r) setActiveRoot(r)
            }}
            className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {roots.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>

          {/* go up */}
          <button
            onClick={goUp}
            disabled={!currentPath}
            title="Subir um nível"
            className="p-1.5 rounded border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500 disabled:opacity-30 transition-colors"
          >
            <ArrowUp size={15} />
          </button>

          {/* breadcrumb */}
          {activeRoot && (
            <Breadcrumb
              rootLabel={activeRoot.label}
              currentPath={currentPath}
              onNavigate={navigate}
            />
          )}
        </div>

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por nome…"
              className="bg-gray-800 border border-gray-700 rounded-md pl-8 pr-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
          </div>

          <input ref={uploadRef} type="file" className="hidden" onChange={handleUpload} />
          <ToolbarBtn icon={Upload} label="Upload" onClick={() => uploadRef.current?.click()} />
          <ToolbarBtn icon={FolderPlus} label="Nova pasta" onClick={() => setNewFolderOpen(true)} />
          <button
            onClick={refresh}
            className="ml-auto p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            title="Atualizar"
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={15} className="rotate-90" />}
          </button>
        </div>
      </div>

      {/* error */}
      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md px-4 py-2 shrink-0">
          {error}
        </p>
      )}

      {/* file table */}
      <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
        {isLoading && items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-gray-900 border-b border-gray-800 z-10">
                <tr>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tamanho</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Modificado</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-500">
                      {search ? 'Nenhum resultado para a busca.' : 'Diretório vazio.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <FileRow
                      key={item.name}
                      item={item}
                      rootId={activeRoot?.id}
                      currentPath={currentPath}
                      onNavigate={navigate}
                      onAction={handleAction}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* footer count */}
        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-500 shrink-0">
            {filtered.length} {filtered.length === 1 ? 'item' : 'itens'}
            {search && ` (filtrado de ${items.length})`}
          </div>
        )}
      </Card>

      {/* modals */}
      <DeleteModal
        open={!!deleteTarget}
        item={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <MoveModal
        open={!!moveTarget}
        item={moveTarget}
        title="Mover para…"
        onClose={() => setMoveTarget(null)}
        onConfirm={confirmMove}
      />
      <MoveModal
        open={!!copyTarget}
        item={copyTarget}
        title="Copiar para…"
        onClose={() => setCopyTarget(null)}
        onConfirm={confirmCopy}
      />
      <NewFolderModal
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        onConfirm={confirmNewFolder}
      />
      <PreviewModal
        open={!!previewTarget}
        item={previewTarget}
        rootId={activeRoot?.id}
        filePath={previewTarget ? joinPath(currentPath, previewTarget.name) : ''}
        onClose={() => setPreviewTarget(null)}
      />

      {/* toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 shadow-xl z-50 transition-opacity">
          {toastMsg}
        </div>
      )}
    </div>
  )
}

function ToolbarBtn({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-opacity hover:opacity-85"
      style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}
