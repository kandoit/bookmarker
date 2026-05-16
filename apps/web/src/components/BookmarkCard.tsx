import { useState } from 'react'
import { ExternalLink, Trash2, FolderPlus, Tag, Pencil } from 'lucide-react'
import type { Bookmark, Workspace } from '@bookmarker/shared'

interface Props {
  bookmark: Bookmark
  workspaces: Workspace[]
  onDelete: (id: string) => void
  onEdit?: (bookmark: Bookmark) => void
  onAddToWorkspace: (bookmarkId: string, workspaceId: string) => void
  onTagClick?: (tag: string) => void
  selectable?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
}

export default function BookmarkCard({
  bookmark, workspaces, onDelete, onEdit, onAddToWorkspace, onTagClick,
  selectable, selected, onSelect,
}: Props) {
  const [showActions, setShowActions] = useState(false)
  const [showWsMenu, setShowWsMenu] = useState(false)

  const domain = (() => {
    try { return new URL(bookmark.url).hostname.replace('www.', '') }
    catch { return bookmark.url }
  })()

  return (
    <div
      className={`group relative bg-white dark:bg-slate-800 border rounded-xl p-4 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all cursor-pointer
        ${selected ? 'border-violet-400 dark:border-violet-500 ring-2 ring-violet-200 dark:ring-violet-900' : 'border-slate-200 dark:border-slate-700'}
      `}
      onClick={selectable ? () => onSelect?.(bookmark.id) : undefined}
      onMouseEnter={() => !selectable && setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowWsMenu(false) }}
    >
      {selectable && (
        <div className={`absolute top-3 left-3 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
          ${selected ? 'bg-violet-600 border-violet-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}`}>
          {selected && <svg viewBox="0 0 10 8" className="w-2.5 h-2 text-white" fill="currentColor"><path d="M1 4l3 3 5-6"/></svg>}
        </div>
      )}

      {/* Header */}
      <div className={`flex items-start gap-3 mb-2 ${selectable ? 'pl-6' : ''}`}>
        {bookmark.favicon && (
          <img
            src={bookmark.favicon}
            alt=""
            className="w-5 h-5 rounded mt-0.5 shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <div className="flex-1 min-w-0">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="font-medium text-slate-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 line-clamp-1 text-sm leading-snug"
          >
            {bookmark.title || bookmark.url}
          </a>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{domain}</div>
        </div>
      </div>

      {/* Description */}
      {bookmark.description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">
          {bookmark.description}
        </p>
      )}

      {/* Tags */}
      {bookmark.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {bookmark.tags.slice(0, 4).map(tag => (
            <button
              key={tag}
              onClick={e => { e.stopPropagation(); onTagClick?.(tag) }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-violet-100 dark:hover:bg-violet-900 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
            >
              <Tag size={10} />
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Hover actions */}
      {showActions && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 shadow-sm"
            title="Open"
          >
            <ExternalLink size={14} />
          </a>

          {onEdit && (
            <button
              onClick={e => { e.stopPropagation(); onEdit(bookmark) }}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 shadow-sm"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
          )}

          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setShowWsMenu(!showWsMenu) }}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 shadow-sm"
              title="Add to workspace"
            >
              <FolderPlus size={14} />
            </button>
            {showWsMenu && workspaces.length > 0 && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1">
                {workspaces.map(ws => (
                  <button
                    key={ws.id}
                    onClick={e => { e.stopPropagation(); onAddToWorkspace(bookmark.id, ws.id); setShowWsMenu(false) }}
                    className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 truncate"
                  >
                    {ws.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={e => { e.stopPropagation(); onDelete(bookmark.id) }}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-red-500 dark:hover:text-red-400 shadow-sm"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
