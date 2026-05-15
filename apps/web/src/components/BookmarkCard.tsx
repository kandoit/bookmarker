import { useState } from 'react'
import { ExternalLink, Trash2, FolderPlus, Tag } from 'lucide-react'
import type { Bookmark, Workspace } from '@bookmarker/shared'

interface Props {
  bookmark: Bookmark
  workspaces: Workspace[]
  onDelete: (id: string) => void
  onAddToWorkspace: (bookmarkId: string, workspaceId: string) => void
}

export default function BookmarkCard({ bookmark, workspaces, onDelete, onAddToWorkspace }: Props) {
  const [showActions, setShowActions] = useState(false)
  const [showWsMenu, setShowWsMenu] = useState(false)

  const domain = (() => {
    try { return new URL(bookmark.url).hostname.replace('www.', '') }
    catch { return bookmark.url }
  })()

  return (
    <div
      className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowWsMenu(false) }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
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
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            >
              <Tag size={10} />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 shadow-sm"
            title="Open"
          >
            <ExternalLink size={14} />
          </a>

          <div className="relative">
            <button
              onClick={() => setShowWsMenu(!showWsMenu)}
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
                    onClick={() => { onAddToWorkspace(bookmark.id, ws.id); setShowWsMenu(false) }}
                    className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 truncate"
                  >
                    {ws.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => onDelete(bookmark.id)}
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
