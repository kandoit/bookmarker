import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Plus, Trash2, FolderOpen, Search, Sparkles, X, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useState, useMemo } from 'react'
import {
  removeBookmarkFromWorkspace,
  addBookmark,
  addBookmarkToWorkspace,
  updateWorkspace,
  searchBookmarks,
  textSearch,
} from '@bookmarker/shared'
import type { Bookmark } from '@bookmarker/shared'
import { useStore } from '../store'
import { useSync } from '../hooks/useSync'
import AddBookmarkModal from '../components/AddBookmarkModal'

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { workspaces, bookmarks, settings } = useStore()
  const setWorkspaces = useStore(s => s.setWorkspaces)
  const setBookmarks = useStore(s => s.setBookmarks)
  const { schedulePush } = useSync()

  const [modalOpen, setModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ bookmark: Bookmark; reason: string }[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const workspace = workspaces.find(w => w.id === id)
  if (!workspace) return (
    <div className="p-6">
      <p className="text-slate-500">Workspace not found.</p>
      <Link to="/workspaces" className="text-violet-600 text-sm mt-2 inline-block">← Back</Link>
    </div>
  )

  const wsBookmarks = workspace.bookmarkIds
    .map(bid => bookmarks.find(b => b.id === bid))
    .filter(Boolean) as Bookmark[]

  const outsideBookmarks = bookmarks.filter(b => !workspace.bookmarkIds.includes(b.id))

  const textResults = useMemo(() => {
    if (!searchQuery || searchResults) return null
    return textSearch(outsideBookmarks, searchQuery)
  }, [searchQuery, searchResults, outsideBookmarks])

  const handleOpenAll = () => {
    wsBookmarks.forEach(b => window.open(b.url, '_blank'))
    const wData = updateWorkspace({ version: 1, updatedAt: '', items: workspaces }, workspace.id, { lastOpenedAt: new Date().toISOString() })
    setWorkspaces(wData.items)
    schedulePush(undefined, wData)
    toast.success(`Opened ${wsBookmarks.length} tabs`)
  }

  const handleRemove = (bookmarkId: string) => {
    const wData = removeBookmarkFromWorkspace({ version: 1, updatedAt: '', items: workspaces }, workspace.id, bookmarkId)
    setWorkspaces(wData.items)
    schedulePush(undefined, wData)
    toast.success('Removed from workspace')
  }

  const handleSave = (newBookmarks: Bookmark[], workspaceIds: string[]) => {
    let bData = { version: 1, updatedAt: '', items: bookmarks }
    for (const b of newBookmarks) bData = addBookmark(bData, b)

    const wsIds = new Set([workspace.id, ...workspaceIds])
    let wData = { version: 1, updatedAt: '', items: workspaces }
    for (const wsId of wsIds) {
      for (const b of newBookmarks) wData = addBookmarkToWorkspace(wData, wsId, b.id)
    }

    setBookmarks(bData.items)
    setWorkspaces(wData.items)
    schedulePush(bData, wData)
    toast.success(`${newBookmarks.length} bookmark${newBookmarks.length > 1 ? 's' : ''} added`)
  }

  const handleAddExisting = (bookmark: Bookmark) => {
    const wData = addBookmarkToWorkspace({ version: 1, updatedAt: '', items: workspaces }, workspace.id, bookmark.id)
    setWorkspaces(wData.items)
    schedulePush(undefined, wData)
    setAddedIds(prev => new Set([...prev, bookmark.id]))
    toast.success(`"${bookmark.title}" added`)
  }

  const handleAiSearch = async () => {
    if (!searchQuery.trim() || !settings.openaiApiKey) return
    setSearching(true)
    try {
      const results = await searchBookmarks(searchQuery, outsideBookmarks, settings.openaiApiKey)
      setSearchResults(results)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const clearSearch = () => { setSearchQuery(''); setSearchResults(null); setAddedIds(new Set()) }

  const displayedResults = searchResults?.map(r => r.bookmark) ?? textResults ?? []

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          to="/workspaces"
          className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4 w-fit"
        >
          <ArrowLeft size={14} />
          Workspaces
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
              <FolderOpen size={20} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{workspace.name}</h1>
              {workspace.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{workspace.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Plus size={14} />
              Add URL
            </button>
            <button
              onClick={handleOpenAll}
              disabled={wsBookmarks.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-40"
            >
              <ExternalLink size={14} />
              Open all ({wsBookmarks.length})
            </button>
          </div>
        </div>
      </div>

      {/* AI search to find existing bookmarks to add */}
      {outsideBookmarks.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2.5">
            Add from your saved bookmarks
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchResults(null) }}
                onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
                placeholder="Search by topic, keyword, or description…"
                className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              {searchQuery && (
                <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
            {settings.openaiApiKey && searchQuery && (
              <button
                onClick={handleAiSearch}
                disabled={searching}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900 text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
              >
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                AI search
              </button>
            )}
          </div>

          {displayedResults.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {searchResults && (
                <p className="text-xs text-violet-600 dark:text-violet-400 flex items-center gap-1 mb-1.5">
                  <Sparkles size={11} />
                  {searchResults.length} matching bookmark{searchResults.length !== 1 ? 's' : ''} from your collection
                </p>
              )}
              {displayedResults.map(b => {
                const alreadyAdded = addedIds.has(b.id) || workspace.bookmarkIds.includes(b.id)
                const reason = searchResults?.find(r => r.bookmark.id === b.id)?.reason
                return (
                  <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    {b.favicon && (
                      <img src={b.favicon} alt="" className="w-4 h-4 rounded shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{b.title || b.url}</p>
                      {reason && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{reason}</p>}
                    </div>
                    <button
                      onClick={() => !alreadyAdded && handleAddExisting(b)}
                      disabled={alreadyAdded}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:cursor-default bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900 disabled:opacity-60"
                    >
                      {alreadyAdded
                        ? <><CheckCircle2 size={12} className="text-green-500" /> Added</>
                        : <><Plus size={12} /> Add</>
                      }
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {searchQuery && !searching && displayedResults.length === 0 && (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">No bookmarks found outside this workspace</p>
          )}
        </div>
      )}

      {/* Workspace bookmarks */}
      {wsBookmarks.length > 0 && (
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          In this workspace ({wsBookmarks.length})
        </p>
      )}

      {wsBookmarks.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          No bookmarks yet — add a URL or search your collection above
        </div>
      ) : (
        <div className="space-y-2">
          {wsBookmarks.map((b, i) => (
            <div key={b.id} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-sm transition-all group">
              <span className="text-xs text-slate-400 w-5 text-center shrink-0">{i + 1}</span>
              {b.favicon && (
                <img src={b.favicon} alt="" className="w-5 h-5 rounded shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
              <div className="flex-1 min-w-0">
                <a href={b.url} target="_blank" rel="noopener noreferrer"
                  className="font-medium text-sm text-slate-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 line-clamp-1">
                  {b.title || b.url}
                </a>
                {b.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{b.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <a href={b.url} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                  <ExternalLink size={14} />
                </a>
                <button onClick={() => handleRemove(b.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddBookmarkModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        workspaces={workspaces}
        openaiKey={settings.openaiApiKey}
        defaultWorkspaceId={workspace.id}
        onSave={handleSave}
      />
    </div>
  )
}
