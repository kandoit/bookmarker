import { useState, useMemo, useRef } from 'react'
import { Plus, Search, Sparkles, X, Download, Upload, FileDown, Trash2, Tag, ChevronDown } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import {
  addBookmark, deleteBookmark, updateBookmark, addBookmarkToWorkspace,
  removeBookmarkFromWorkspace, textSearch, searchBookmarks,
  exportBookmarksHTML, parseNetscapeHTML, createBookmark, createWorkspace,
  addWorkspace, getFavicon,
} from '@bookmarker/shared'
import type { Bookmark, ParsedBookmarkFile } from '@bookmarker/shared'
import { useStore } from '../store'
import { useSync } from '../hooks/useSync'
import BookmarkCard from '../components/BookmarkCard'
import AddBookmarkModal from '../components/AddBookmarkModal'
import EditBookmarkModal from '../components/EditBookmarkModal'

type SortKey = 'newest' | 'oldest' | 'az' | 'za'

export default function BookmarksPage() {
  const { bookmarks, workspaces, settings } = useStore()
  const { schedulePush } = useSync()
  const setBookmarks = useStore(s => s.setBookmarks)
  const setWorkspaces = useStore(s => s.setWorkspaces)

  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Bookmark | null>(null)
  const [aiResults, setAiResults] = useState<{ bookmark: Bookmark; reason: string }[] | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Sort + tag filter
  const [sortBy, setSortBy] = useState<SortKey>('newest')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [tagsExpanded, setTagsExpanded] = useState(false)

  // Selection
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Import
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importData, setImportData] = useState<ParsedBookmarkFile | null>(null)
  const [importWithFolders, setImportWithFolders] = useState(true)

  // Top tags by frequency
  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    bookmarks.forEach(b => b.tags.forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag]) => tag)
  }, [bookmarks])

  const displayed = useMemo(() => {
    let list: Bookmark[]

    if (aiResults) {
      list = aiResults.map(r => r.bookmark)
    } else {
      list = query ? textSearch(bookmarks, query) : [...bookmarks]
    }

    if (activeTag) list = list.filter(b => b.tags.includes(activeTag))

    if (!aiResults) {
      switch (sortBy) {
        case 'oldest': list = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt)); break
        case 'az': list = [...list].sort((a, b) => (a.title || a.url).localeCompare(b.title || b.url)); break
        case 'za': list = [...list].sort((a, b) => (b.title || b.url).localeCompare(a.title || a.url)); break
        default: break // newest first (addBookmark prepends)
      }
    }

    return list
  }, [bookmarks, query, aiResults, sortBy, activeTag])

  const handleAiSearch = async () => {
    if (!query || !settings.openaiApiKey) return
    setAiLoading(true)
    try {
      const results = await searchBookmarks(query, bookmarks, settings.openaiApiKey)
      setAiResults(results)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI search failed')
    } finally {
      setAiLoading(false)
    }
  }

  const clearSearch = () => { setQuery(''); setAiResults(null) }

  const handleSave = (newBookmarks: Bookmark[], workspaceIds: string[]) => {
    let bData = { version: 1, updatedAt: '', items: bookmarks }
    for (const b of newBookmarks) bData = addBookmark(bData, b)

    let wData = { version: 1, updatedAt: '', items: workspaces }
    for (const wsId of workspaceIds) {
      for (const b of newBookmarks) wData = addBookmarkToWorkspace(wData, wsId, b.id)
    }

    setBookmarks(bData.items)
    setWorkspaces(wData.items)
    schedulePush(bData, wData)
    const wsNames = workspaceIds.map(id => workspaces.find(w => w.id === id)?.name).filter(Boolean)
    toast.success(`${newBookmarks.length} bookmark${newBookmarks.length > 1 ? 's' : ''} saved${wsNames.length ? ` → ${wsNames.join(', ')}` : ''}`)
  }

  const handleEdit = (id: string, updates: Partial<Bookmark>) => {
    const bData = updateBookmark({ version: 1, updatedAt: '', items: bookmarks }, id, updates)
    setBookmarks(bData.items)
    schedulePush(bData)
    setEditTarget(null)
    toast.success('Bookmark updated')
  }

  const handleDelete = (id: string) => {
    const bData = deleteBookmark({ version: 1, updatedAt: '', items: bookmarks }, id)
    setBookmarks(bData.items)
    schedulePush(bData)
    toast.success('Bookmark deleted')
  }

  const handleAddToWorkspace = (bookmarkId: string, workspaceId: string) => {
    const wData = addBookmarkToWorkspace({ version: 1, updatedAt: '', items: workspaces }, workspaceId, bookmarkId)
    setWorkspaces(wData.items)
    schedulePush(undefined, wData)
    const ws = workspaces.find(w => w.id === workspaceId)
    toast.success(`Added to "${ws?.name}"`)
  }

  // ── Selection ────────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === displayed.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(displayed.map(b => b.id)))
  }

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()) }

  const handleBulkDelete = () => {
    const count = selectedIds.size
    let bData = { version: 1, updatedAt: '', items: bookmarks }
    for (const id of selectedIds) bData = deleteBookmark(bData, id)

    // Remove from all workspaces too
    let wData = { version: 1, updatedAt: '', items: workspaces }
    for (const id of selectedIds) {
      for (const ws of workspaces) {
        if (ws.bookmarkIds.includes(id)) wData = removeBookmarkFromWorkspace(wData, ws.id, id)
      }
    }

    setBookmarks(bData.items)
    setWorkspaces(wData.items)
    schedulePush(bData, wData)
    toast.success(`${count} bookmark${count > 1 ? 's' : ''} deleted`)
    exitSelectMode()
  }

  // ── Export ───────────────────────────────────────────────────────────────────

  const doExport = (ids?: string[]) => {
    const html = exportBookmarksHTML(bookmarks, workspaces, ids ? { bookmarkIds: ids } : {})
    const blob = new Blob([html], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bookmarks-${new Date().toISOString().slice(0, 10)}.html`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('Bookmarks exported')
    exitSelectMode()
  }

  // ── Import ───────────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const parsed = parseNetscapeHTML(ev.target?.result as string)
        setImportData(parsed)
      } catch {
        toast.error('Could not parse bookmark file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImport = () => {
    if (!importData) return
    let bData = { version: 1, updatedAt: '', items: bookmarks }
    let wData = { version: 1, updatedAt: '', items: workspaces }

    const allImported: Bookmark[] = []

    for (const ib of importData.bookmarks) {
      const b = createBookmark({ url: ib.url, title: ib.title, description: ib.description, tags: ib.tags, favicon: getFavicon(ib.url) })
      bData = addBookmark(bData, b)
      allImported.push(b)
    }

    if (importWithFolders) {
      for (const folder of importData.folders) {
        const folderBookmarks: Bookmark[] = []
        for (const ib of folder.bookmarks) {
          const b = createBookmark({ url: ib.url, title: ib.title, description: ib.description, tags: ib.tags, favicon: getFavicon(ib.url) })
          bData = addBookmark(bData, b)
          folderBookmarks.push(b)
          allImported.push(b)
        }
        const ws = createWorkspace(folder.name, '')
        wData = addWorkspace(wData, ws)
        for (const b of folderBookmarks) wData = addBookmarkToWorkspace(wData, ws.id, b.id)
      }
    } else {
      for (const folder of importData.folders) {
        for (const ib of folder.bookmarks) {
          const b = createBookmark({ url: ib.url, title: ib.title, description: ib.description, tags: ib.tags, favicon: getFavicon(ib.url) })
          bData = addBookmark(bData, b)
          allImported.push(b)
        }
      }
    }

    setBookmarks(bData.items)
    setWorkspaces(wData.items)
    schedulePush(bData, wData)
    toast.success(`Imported ${allImported.length} bookmarks${importWithFolders && importData.folders.length ? ` in ${importData.folders.length} folders` : ''}`)
    setImportData(null)
  }

  const totalImportCount = importData
    ? importData.bookmarks.length + importData.folders.reduce((s, f) => s + f.bookmarks.length, 0)
    : 0

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Bookmarks</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{bookmarks.length} saved</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Import from browser HTML"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Upload size={14} />
            <span className="hidden sm:inline">Import</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".html,.htm" className="hidden" onChange={handleFileChange} />

          <button
            onClick={() => selectMode ? doExport([...selectedIds]) : setSelectMode(true)}
            title="Export bookmarks"
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
            <span className="hidden sm:inline">Add bookmark</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Select mode bar */}
      {selectMode && (
        <div className="flex items-center justify-between mb-4 px-4 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800">
          <div className="flex items-center gap-3">
            <button onClick={toggleSelectAll} className="text-sm text-violet-700 dark:text-violet-300 hover:underline">
              {selectedIds.size === displayed.length ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-sm text-violet-600 dark:text-violet-400">{selectedIds.size} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-40"
            >
              <Trash2 size={14} />
              Delete {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </button>
            <button
              onClick={() => doExport(selectedIds.size ? [...selectedIds] : undefined)}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-40"
            >
              <FileDown size={14} />
              Export {selectedIds.size > 0 ? `(${selectedIds.size})` : 'all'}
            </button>
            <button onClick={exitSelectMode} className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-900">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Search + sort row */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setAiResults(null) }}
            onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
            placeholder="Search bookmarks…"
            className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          {query && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
        {settings.openaiApiKey && query && (
          <button
            onClick={handleAiSearch}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Sparkles size={14} className={aiLoading ? 'animate-pulse' : ''} />
            AI search
          </button>
        )}
        {!aiResults && (
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
          </select>
        )}
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && !aiResults && (
        <div className="mb-4">
          <div className={`flex gap-1.5 ${tagsExpanded ? 'flex-wrap' : 'overflow-x-auto scrollbar-hide'}`}>
            {activeTag && (
              <button
                onClick={() => setActiveTag(null)}
                className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-600 text-white"
              >
                {activeTag}<X size={10} />
              </button>
            )}
            {allTags.filter(t => t !== activeTag).map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className="inline-flex shrink-0 items-center px-2.5 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-violet-100 dark:hover:bg-violet-900 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
              >
                {tag}
              </button>
            ))}
            <button
              onClick={() => setTagsExpanded(v => !v)}
              className="inline-flex shrink-0 items-center gap-0.5 px-2 py-1 rounded-full text-xs text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronDown size={12} className={`transition-transform ${tagsExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* AI result header */}
      {aiResults && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-violet-600 dark:text-violet-400 font-medium flex items-center gap-1.5">
            <Sparkles size={14} />
            AI found {aiResults.length} relevant bookmark{aiResults.length !== 1 ? 's' : ''}
          </p>
          <button onClick={clearSearch} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Clear</button>
        </div>
      )}
      {aiResults && (
        <div className="mb-4 space-y-1">
          {aiResults.map(r => (
            <div key={r.bookmark.id} className="text-xs text-slate-500 dark:text-slate-400 flex gap-2">
              <span className="text-violet-500">·</span>
              <span><strong className="text-slate-700 dark:text-slate-300">{r.bookmark.title}:</strong> {r.reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {displayed.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          {activeTag ? `No bookmarks tagged "${activeTag}"` : query ? 'No bookmarks match your search' : 'No bookmarks yet — add your first one!'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map(b => (
            <BookmarkCard
              key={b.id}
              bookmark={b}
              workspaces={workspaces}
              onDelete={handleDelete}
              onEdit={setEditTarget}
              onAddToWorkspace={handleAddToWorkspace}
              onTagClick={tag => { setActiveTag(tag); clearSearch() }}
              selectable={selectMode}
              selected={selectedIds.has(b.id)}
              onSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      <AddBookmarkModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        workspaces={workspaces}
        openaiKey={settings.openaiApiKey}
        onSave={handleSave}
      />

      <EditBookmarkModal
        bookmark={editTarget}
        onSave={handleEdit}
        onClose={() => setEditTarget(null)}
      />

      {/* Import preview dialog */}
      <Dialog.Root open={!!importData} onOpenChange={v => !v && setImportData(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 p-6">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-white">Import Bookmarks</Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>

            {importData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalImportCount}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">bookmarks</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{importData.folders.length}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">folders</p>
                  </div>
                </div>

                {importData.folders.length > 0 && (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importWithFolders}
                      onChange={e => setImportWithFolders(e.target.checked)}
                      className="mt-0.5 accent-violet-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Create workspaces from folders</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Each browser folder becomes a workspace with its bookmarks</p>
                    </div>
                  </label>
                )}

                {importData.folders.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importData.folders.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-sm px-2 py-1 rounded">
                        <span className="text-slate-700 dark:text-slate-300 truncate">{f.name}</span>
                        <span className="text-xs text-slate-400 shrink-0 ml-2">{f.bookmarks.length} bookmarks</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Dialog.Close asChild>
                    <button className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
                  </Dialog.Close>
                  <button
                    onClick={handleImport}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors"
                  >
                    Import {totalImportCount} bookmarks
                  </button>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
