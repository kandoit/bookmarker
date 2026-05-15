import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Plus, Trash2, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import {
  removeBookmarkFromWorkspace,
  addBookmark,
  addBookmarkToWorkspace,
  updateWorkspace,
} from '@bookmarker/shared'
import { useStore } from '../store'
import { useSync } from '../hooks/useSync'
import AddBookmarkModal from '../components/AddBookmarkModal'
import { useState } from 'react'
import type { Bookmark } from '@bookmarker/shared'

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { workspaces, bookmarks, settings } = useStore()
  const setWorkspaces = useStore(s => s.setWorkspaces)
  const setBookmarks = useStore(s => s.setBookmarks)
  const { schedulePush } = useSync()
  const [modalOpen, setModalOpen] = useState(false)

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

  const handleOpenAll = () => {
    wsBookmarks.forEach(b => window.open(b.url, '_blank'))
    const wData = updateWorkspace(
      { version: 1, updatedAt: '', items: workspaces },
      workspace.id,
      { lastOpenedAt: new Date().toISOString() }
    )
    setWorkspaces(wData.items)
    schedulePush(undefined, wData)
    toast.success(`Opened ${wsBookmarks.length} tabs`)
  }

  const handleRemove = (bookmarkId: string) => {
    const wData = removeBookmarkFromWorkspace(
      { version: 1, updatedAt: '', items: workspaces },
      workspace.id,
      bookmarkId
    )
    setWorkspaces(wData.items)
    schedulePush(undefined, wData)
    toast.success('Removed from workspace')
  }

  const handleSave = (newBookmarks: Bookmark[], _wsId?: string) => {
    let bData = { version: 1, updatedAt: '', items: bookmarks }
    for (const b of newBookmarks) bData = addBookmark(bData, b)

    let wData = { version: 1, updatedAt: '', items: workspaces }
    for (const b of newBookmarks) wData = addBookmarkToWorkspace(wData, workspace.id, b.id)

    setBookmarks(bData.items)
    setWorkspaces(wData.items)
    schedulePush(bData, wData)
    toast.success(`${newBookmarks.length} bookmark${newBookmarks.length > 1 ? 's' : ''} added`)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
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
              Add
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

      {wsBookmarks.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          No bookmarks in this workspace — add some!
        </div>
      ) : (
        <div className="space-y-2">
          {wsBookmarks.map((b, i) => (
            <div
              key={b.id}
              className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-sm transition-all group"
            >
              <span className="text-xs text-slate-400 w-5 text-center shrink-0">{i + 1}</span>
              {b.favicon && (
                <img
                  src={b.favicon}
                  alt=""
                  className="w-5 h-5 rounded shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <div className="flex-1 min-w-0">
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm text-slate-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 line-clamp-1"
                >
                  {b.title || b.url}
                </a>
                {b.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{b.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  onClick={() => handleRemove(b.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                >
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
        anthropicKey={settings.anthropicApiKey}
        onSave={handleSave}
      />
    </div>
  )
}
