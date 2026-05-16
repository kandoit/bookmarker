import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { createWorkspace, addWorkspace, deleteWorkspace, updateWorkspace } from '@bookmarker/shared'
import { useStore } from '../store'
import { useSync } from '../hooks/useSync'
import WorkspaceCard from '../components/WorkspaceCard'

export default function WorkspacesPage() {
  const { workspaces, bookmarks } = useStore()
  const { schedulePush } = useSync()
  const setWorkspaces = useStore(s => s.setWorkspaces)

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleCreate = () => {
    if (!name.trim()) return
    const ws = createWorkspace(name.trim(), description.trim())
    const wData = addWorkspace({ version: 1, updatedAt: '', items: workspaces }, ws)
    setWorkspaces(wData.items)
    schedulePush(undefined, wData)
    toast.success(`Workspace "${ws.name}" created`)
    setName('')
    setDescription('')
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
    const wsBookmarks = ws.bookmarkIds
      .map(bid => bookmarks.find(b => b.id === bid))
      .filter(Boolean)

    wsBookmarks.forEach(b => window.open(b!.url, '_blank'))

    const wData = updateWorkspace(
      { version: 1, updatedAt: '', items: workspaces },
      id,
      { lastOpenedAt: new Date().toISOString() }
    )
    setWorkspaces(wData.items)
    schedulePush(undefined, wData)
    toast.success(`Opened ${wsBookmarks.length} tabs`)
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Workspaces</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Group bookmarks by project or task
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New workspace
        </button>
      </div>

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
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 p-6">
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Name
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="e.g. Work Project, Research"
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What's this workspace for?"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
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
                Create workspace
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
