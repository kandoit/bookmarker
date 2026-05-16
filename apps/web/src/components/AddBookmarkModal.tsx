import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Loader2, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { analyzeUrl, createBookmark, getFavicon } from '@bookmarker/shared'
import type { Bookmark, Workspace } from '@bookmarker/shared'

interface Props {
  open: boolean
  onClose: () => void
  workspaces: Workspace[]
  openaiKey: string
  onSave: (bookmarks: Bookmark[], workspaceId?: string) => void
}

export default function AddBookmarkModal({ open, onClose, workspaces, openaiKey, onSave }: Props) {
  const [urls, setUrls] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [loading, setLoading] = useState(false)
  const [previews, setPreviews] = useState<Bookmark[]>([])

  const handleAnalyze = async () => {
    const list = urls.split('\n').map(u => u.trim()).filter(Boolean)
    if (!list.length) return
    setLoading(true)
    try {
      const results = await Promise.all(
        list.map(async url => {
          if (openaiKey) {
            const info = await analyzeUrl(url, null, openaiKey)
            return createBookmark({
              url,
              title: info.title || url,
              description: info.description,
              tags: info.tags,
              favicon: getFavicon(url),
            })
          }
          return createBookmark({ url, title: url, description: '', tags: [], favicon: getFavicon(url) })
        })
      )
      setPreviews(results)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to analyze URLs')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (!previews.length) return
    onSave(previews, workspaceId || undefined)
    setUrls('')
    setPreviews([])
    setWorkspaceId('')
    onClose()
  }

  const handleClose = () => {
    setUrls('')
    setPreviews([])
    setWorkspaceId('')
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 p-6 max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-white">
              Add Bookmarks
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* URL input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                URLs <span className="text-slate-400 font-normal">(one per line)</span>
              </label>
              <textarea
                value={urls}
                onChange={e => { setUrls(e.target.value); setPreviews([]) }}
                placeholder="https://example.com&#10;https://another.com"
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
            </div>

            {/* Workspace */}
            {workspaces.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Add to workspace <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <select
                  value={workspaceId}
                  onChange={e => setWorkspaceId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">None</option>
                  {workspaces.map(ws => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Analyze button */}
            {!previews.length && (
              <button
                onClick={handleAnalyze}
                disabled={loading || !urls.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900 font-medium text-sm transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Analyzing with AI...</>
                ) : (
                  <><Sparkles size={16} /> {openaiKey ? 'Analyze with AI' : 'Continue'}</>
                )}
              </button>
            )}

            {/* Preview */}
            {previews.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Preview ({previews.length})
                </p>
                {previews.map(b => (
                  <div key={b.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <div className="font-medium text-sm text-slate-900 dark:text-white mb-0.5">{b.title}</div>
                    <div className="text-xs text-slate-400 mb-1 truncate">{b.url}</div>
                    {b.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{b.description}</p>
                    )}
                    {b.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {b.tags.map(t => (
                          <span key={t} className="px-1.5 py-0.5 rounded text-xs bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!previews.length}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-40"
            >
              <Plus size={16} />
              Save {previews.length > 0 ? `${previews.length} bookmark${previews.length > 1 ? 's' : ''}` : 'bookmarks'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
