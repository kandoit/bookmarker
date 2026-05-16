import { useState } from 'react'
import { Plus, X, Sparkles, Loader2, CheckSquare, Square, Download, FileDown } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { createWorkspace, addWorkspace, deleteWorkspace, updateWorkspace, addBookmarkToWorkspace, suggestWorkspaceBookmarks, exportBookmarksHTML } from '@bookmarker/shared'
import type { Bookmark } from '@bookmarker/shared'
import { useStore } from '../store'
import { useSync } from '../hooks/useSync'
import WorkspaceCard from '../components/WorkspaceCard'
import { logger } from '../logger'

interface Suggestion { bookmark: Bookmark; reason: string; selected: boolean }

export default function WorkspacesPage() {
  const { workspaces, bookmarks, settings } = useStore()
  const { schedulePush } = useSync()
  const setWorkspaces = useStore(s => s.setWorkspaces)

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  // Selection + export
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const exitSelect = () => { setSelectMode(false); setSelectedIds(new Set()) }

  const doExport = (wsIds?: string[]) => {
    const html = exportBookmarksHTML(bookmarks, workspaces, wsIds ? { workspaceIds: wsIds } : {})
    const blob = new Blob([html], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `workspaces-${new Date().toISOString().slice(0, 10)}.html`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('Workspaces exported')
    exitSelect()
  }

  const resetModal = () => {
    setName('')
    setDescription('')
    setSuggestions([])
  }

  const handleAiFill = async () => {
    if (!name.trim() || !settings.openaiApiKey) return
    setSuggesting(true)
    try {
      const results = await suggestWorkspaceBookmarks(name.trim(), description.trim(), bookmarks, settings.openaiApiKey)
      setSuggestions(results.map(r => ({ ...r, selected: true })))
      if (!results.length) toast.info('No matching bookmarks found for this workspace')
      else logger.info('AI workspace suggestions', { workspace: name, count: results.length })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI suggestion failed'
      logger.error('suggestWorkspaceBookmarks failed', msg)
      toast.error(msg)
    } finally {
      setSuggesting(false)
    }
  }

  const toggleSuggestion = (id: string) => {
    setSuggestions(prev => prev.map(s => s.bookmark.id === id ? { ...s, selected: !s.selected } : s))
  }

  const handleCreate = () => {
    if (!name.trim()) return
    const ws = createWorkspace(name.trim(), description.trim())
    let wData = addWorkspace({ version: 1, updatedAt: '', items: workspaces }, ws)

    const selected = suggestions.filter(s => s.selected)
    for (const s of selected) {
      wData = addBookmarkToWorkspace(wData, ws.id, s.bookmark.id)
    }

    setWorkspaces(wData.items)
    schedulePush(undefined, wData)
    toast.success(`Workspace "${ws.name}" created${selected.length ? ` with ${selected.length} bookmark${selected.length > 1 ? 's' : ''}` : ''}`)
    resetModal()
    setModalOpen(false)
  }

  const handleDelete = (id: string) => {
    const ws = workspaces.find(w => w.id === id)
    const wData = deleteWorkspace({ version: 1, updatedAt: '', items: workspaces }, id)
    setWorkspaces(wData.items)
    schedulePush(undefined, wData)
    toast.success(`Workspace "${ws?.name}" deleted`)
  }

  const handleOpenAll = (id: string) => {
    const ws = workspaces.find(w => w.id === id)
    if (!ws) return
    const wsBookmarks = ws.bookmarkIds.map(bid => bookmarks.find(b => b.id === bid)).filter(Boolean)
    wsBookmarks.forEach(b => window.open(b!.url, '_blank'))
    const wData = updateWorkspace({ version: 1, updatedAt: '', items: workspaces }, id, { lastOpenedAt: new Date().toISOString() })
    setWorkspaces(wData.items)
    schedulePush(undefined, wData)
    toast.success(`Opened ${wsBookmarks.length} tabs`)
  }

  const canAiFill = !!name.trim() && !!settings.openaiApiKey && bookmarks.length > 0

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Workspaces</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Group bookmarks by project or task</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectMode ? doExport([...selectedIds]) : setSelectMode(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New workspace</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Select mode bar */}
      {selectMode && (
        <div className="flex items-center justify-between mb-4 px-4 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => selectedIds.size === workspaces.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(workspaces.map(w => w.id)))}
              className="text-sm text-violet-700 dark:text-violet-300 hover:underline"
            >
              {selectedIds.size === workspaces.length ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-sm text-violet-600 dark:text-violet-400">{selectedIds.size} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => doExport(selectedIds.size ? [...selectedIds] : undefined)}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-40"
            >
              <FileDown size={14} />
              Export {selectedIds.size > 0 ? `(${selectedIds.size})` : 'all'}
            </button>
            <button onClick={exitSelect} className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-900">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {workspaces.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          No workspaces yet — create one to group your bookmarks
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map(ws => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              bookmarkCount={ws.bookmarkIds.length}
              onDelete={handleDelete}
              onOpenAll={handleOpenAll}
              selectable={selectMode}
              selected={selectedIds.has(ws.id)}
              onSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Dialog.Root open={modalOpen} onOpenChange={v => { if (!v) resetModal(); setModalOpen(v) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-white">
                New Workspace
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Name</label>
                <input
                  value={name}
                  onChange={e => { setName(e.target.value); setSuggestions([]) }}
                  onKeyDown={e => e.key === 'Enter' && !suggestions.length && handleCreate()}
                  placeholder="e.g. Work Project, Research"
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Description <span className="text-slate-400 font-normal">(optional — helps AI pick better)</span>
                </label>
                <input
                  value={description}
                  onChange={e => { setDescription(e.target.value); setSuggestions([]) }}
                  placeholder="What's this workspace for?"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* AI Fill button */}
              {canAiFill && !suggestions.length && (
                <button
                  onClick={handleAiFill}
                  disabled={suggesting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {suggesting
                    ? <><Loader2 size={15} className="animate-spin" /> Finding matching bookmarks…</>
                    : <><Sparkles size={15} /> AI fill from my bookmarks</>
                  }
                </button>
              )}

              {/* Suggestions list */}
              {suggestions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Suggested bookmarks ({suggestions.filter(s => s.selected).length} selected)
                    </p>
                    <div className="flex gap-2 text-xs text-violet-600 dark:text-violet-400">
                      <button onClick={() => setSuggestions(p => p.map(s => ({ ...s, selected: true })))}>All</button>
                      <button onClick={() => setSuggestions(p => p.map(s => ({ ...s, selected: false })))}>None</button>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {suggestions.map(s => (
                      <button
                        key={s.bookmark.id}
                        onClick={() => toggleSuggestion(s.bookmark.id)}
                        className="w-full flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-colors
                          border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700
                          bg-white dark:bg-slate-800"
                      >
                        <span className="mt-0.5 shrink-0 text-violet-600 dark:text-violet-400">
                          {s.selected ? <CheckSquare size={15} /> : <Square size={15} className="text-slate-400" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                            {s.bookmark.title || s.bookmark.url}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.reason}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleAiFill}
                    disabled={suggesting}
                    className="mt-2 flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50"
                  >
                    <Sparkles size={11} />
                    Re-run AI suggestion
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Dialog.Close asChild>
                <button className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-40"
              >
                {suggestions.filter(s => s.selected).length > 0
                  ? `Create with ${suggestions.filter(s => s.selected).length} bookmark${suggestions.filter(s => s.selected).length > 1 ? 's' : ''}`
                  : 'Create workspace'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
