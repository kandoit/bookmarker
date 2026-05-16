import { Link } from 'react-router-dom'
import { FolderOpen, ExternalLink, Trash2 } from 'lucide-react'
import type { Workspace } from '@bookmarker/shared'

interface Props {
  workspace: Workspace
  bookmarkCount: number
  onDelete: (id: string) => void
  onOpenAll: (id: string) => void
  selectable?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
}

export default function WorkspaceCard({ workspace, bookmarkCount, onDelete, onOpenAll, selectable, selected, onSelect }: Props) {
  const lastOpened = workspace.lastOpenedAt
    ? new Date(workspace.lastOpenedAt).toLocaleDateString()
    : null

  return (
    <div
      onClick={selectable ? () => onSelect?.(workspace.id) : undefined}
      className={`group relative bg-white dark:bg-slate-800 border rounded-xl p-5 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all
        ${selectable ? 'cursor-pointer' : ''}
        ${selected ? 'border-violet-400 dark:border-violet-500 ring-2 ring-violet-200 dark:ring-violet-900' : 'border-slate-200 dark:border-slate-700'}
      `}
    >
      {selectable && (
        <div className={`absolute top-3 right-3 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
          ${selected ? 'bg-violet-600 border-violet-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}`}>
          {selected && <svg viewBox="0 0 10 8" className="w-2.5 h-2 text-white" fill="currentColor"><path d="M1 4l3 3 5-6"/></svg>}
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
            <FolderOpen size={18} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <Link
              to={`/workspaces/${workspace.id}`}
              className="font-semibold text-slate-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
            >
              {workspace.name}
            </Link>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {bookmarkCount} bookmark{bookmarkCount !== 1 ? 's' : ''}
              {lastOpened && ` · opened ${lastOpened}`}
            </div>
          </div>
        </div>
      </div>

      {workspace.description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
          {workspace.description}
        </p>
      )}

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onOpenAll(workspace.id)}
          disabled={bookmarkCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900 transition-colors disabled:opacity-40"
        >
          <ExternalLink size={12} />
          Open all
        </button>
        <Link
          to={`/workspaces/${workspace.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          View
        </Link>
        <button
          onClick={() => onDelete(workspace.id)}
          className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
