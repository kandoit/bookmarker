import { useState, useMemo } from 'react'
import { Plus, Search, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { addBookmark, deleteBookmark, addBookmarkToWorkspace, textSearch, searchBookmarks } from '@bookmarker/shared'
import type { Bookmark } from '@bookmarker/shared'
import { useStore } from '../store'
import { useSync } from '../hooks/useSync'
import BookmarkCard from '../components/BookmarkCard'
import AddBookmarkModal from '../components/AddBookmarkModal'

export default function BookmarksPage() {
  const { bookmarks, workspaces, settings } = useStore()
  const { schedulePush } = useSync()
  const setBookmarks = useStore(s => s.setBookmarks)
  const setWorkspaces = useStore(s => s.setWorkspaces)

  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [aiResults, setAiResults] = useState<{ bookmark: Bookmark; reason: string }[] | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const displayed = useMemo(() => {
    if (aiResults) return aiResults.map(r => r.bookmark)
    if (!query) return bookmarks
    return textSearch(bookmarks, query)
  }, [bookmarks, query, aiResults])

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

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Bookmarks</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {bookmarks.length} saved
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add bookmark
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-6">
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
      </div>

      {/* AI result header */}
      {aiResults && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-violet-600 dark:text-violet-400 font-medium flex items-center gap-1.5">
            <Sparkles size={14} />
            AI found {aiResults.length} relevant bookmark{aiResults.length !== 1 ? 's' : ''}
          </p>
          <button onClick={clearSearch} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            Clear
          </button>
        </div>
      )}

      {/* AI reasons */}
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
          {query ? 'No bookmarks match your search' : 'No bookmarks yet — add your first one!'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map(b => (
            <BookmarkCard
              key={b.id}
              bookmark={b}
              workspaces={workspaces}
              onDelete={handleDelete}
              onAddToWorkspace={handleAddToWorkspace}
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
    </div>
  )
}
