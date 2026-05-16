import { useState, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Loader2, Plus, Sparkles, CheckSquare, Square, ClipboardPaste, ClipboardCheck, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { analyzeUrl, createBookmark, getFavicon, suggestWorkspacesForBookmark, fetchPageContent } from '@bookmarker/shared'
import type { Bookmark, Workspace } from '@bookmarker/shared'

interface Props {
  open: boolean
  onClose: () => void
  workspaces: Workspace[]
  openaiKey: string
  defaultWorkspaceId?: string
  initialUrl?: string
  onSave: (bookmarks: Bookmark[], workspaceIds: string[]) => void
}

interface EditState {
  title: string
  tagsRaw: string
}

export default function AddBookmarkModal({
  open, onClose, workspaces, openaiKey, defaultWorkspaceId, initialUrl, onSave,
}: Props) {
  const [urls, setUrls] = useState('')
  const [loading, setLoading] = useState(false)
  const autoAnalyzed = useRef(false)
  const [previews, setPreviews] = useState<Bookmark[]>([])
  const [edits, setEdits] = useState<Record<string, EditState>>({})
  const [selectedWsIds, setSelectedWsIds] = useState<Set<string>>(
    () => new Set(defaultWorkspaceId ? [defaultWorkspaceId] : [])
  )
  const [suggestingWs, setSuggestingWs] = useState(false)
  const [wsSuggested, setWsSuggested] = useState(false)
  const [fromClipboard, setFromClipboard] = useState(false)

  useEffect(() => {
    if (!open) { autoAnalyzed.current = false; return }
    if (autoAnalyzed.current || !initialUrl) return
    autoAnalyzed.current = true
    setUrls(initialUrl)
    setPreviews([])
    setEdits({})
    setWsSuggested(false)
    setFromClipboard(false)
    setTimeout(() => handleAnalyzeUrl(initialUrl), 0)
  }, [open, initialUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePasteButton = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const trimmed = text.trim()
      if (/^https?:\/\//i.test(trimmed)) {
        setUrls(trimmed)
        setPreviews([])
        setEdits({})
        setWsSuggested(false)
        setFromClipboard(true)
        setTimeout(() => handleAnalyzeUrl(trimmed), 0)
      } else {
        toast.error('No URL found in clipboard')
      }
    } catch {
      toast.error('Clipboard access denied')
    }
  }

  const handlePasteEvent = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text').trim()
    if (/^https?:\/\//i.test(pasted)) {
      e.preventDefault()
      setUrls(pasted)
      setPreviews([])
      setEdits({})
      setWsSuggested(false)
      setFromClipboard(true)
      setTimeout(() => handleAnalyzeUrl(pasted), 0)
    }
  }

  const reset = () => {
    setUrls('')
    setPreviews([])
    setEdits({})
    setSelectedWsIds(new Set(defaultWorkspaceId ? [defaultWorkspaceId] : []))
    setWsSuggested(false)
    setFromClipboard(false)
  }

  const applyPreviews = (results: Bookmark[]) => {
    setPreviews(results)
    setEdits(Object.fromEntries(
      results.map(b => [b.id, { title: b.title, tagsRaw: b.tags.join(', ') }])
    ))
  }

  const handleAnalyzeUrl = async (urlOverride?: string) => {
    const raw = urlOverride ?? urls
    const list = raw.split('\n').map(u => u.trim()).filter(Boolean)
    if (!list.length) return
    setLoading(true)
    try {
      const results = await Promise.all(
        list.map(async url => {
          if (openaiKey) {
            const pageContent = await fetchPageContent(url)
            const info = await analyzeUrl(url, pageContent, openaiKey)
            return createBookmark({ url, title: info.title || url, description: info.description, tags: info.tags, favicon: getFavicon(url) })
          }
          return createBookmark({ url, title: url, description: '', tags: [], favicon: getFavicon(url) })
        })
      )
      applyPreviews(results)

      if (openaiKey && workspaces.length && results.length) {
        setSuggestingWs(true)
        try {
          const suggested = await suggestWorkspacesForBookmark(results[0], workspaces, openaiKey)
          setSelectedWsIds(prev => {
            const next = new Set(prev)
            suggested.forEach(id => next.add(id))
            return next
          })
          setWsSuggested(true)
        } catch { /* best-effort */ }
        finally { setSuggestingWs(false) }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to analyze URLs')
    } finally {
      setLoading(false)
    }
  }

  const updateEdit = (id: string, field: keyof EditState, value: string) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const toggleWs = (id: string) => {
    setSelectedWsIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = () => {
    if (!previews.length) return
    const finalBookmarks = previews.map(b => {
      const e = edits[b.id]
      return e
        ? { ...b, title: e.title.trim() || b.title, tags: e.tagsRaw.split(',').map(t => t.trim()).filter(Boolean) }
        : b
    })
    onSave(finalBookmarks, [...selectedWsIds])
    reset()
    onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl max-h-[90dvh] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg sm:rounded-2xl sm:max-h-[85vh] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-white">Add Bookmarks</Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* URL input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  URLs <span className="text-slate-400 font-normal">(one per line)</span>
                </label>
                {fromClipboard ? (
                  <span className="flex items-center gap-1 text-xs text-violet-500 dark:text-violet-400">
                    <ClipboardCheck size={12} /> From clipboard
                  </span>
                ) : (
                  <button
                    onClick={handlePasteButton}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ClipboardPaste size={12} /> Paste URL
                  </button>
                )}
              </div>
              <textarea
                value={urls}
                onChange={e => { setUrls(e.target.value); setPreviews([]); setEdits({}); setWsSuggested(false); setFromClipboard(false) }}
                onPaste={handlePasteEvent}
                placeholder="https://example.com&#10;https://another.com"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
            </div>

            {/* Analyze button */}
            {!previews.length && (
              <button
                onClick={() => handleAnalyzeUrl()}
                disabled={loading || !urls.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900 font-medium text-sm transition-colors disabled:opacity-50"
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> Analyzing…</>
                  : <><Sparkles size={16} /> {openaiKey ? 'Analyze with AI' : 'Continue'}</>
                }
              </button>
            )}

            {/* Editable preview cards */}
            {previews.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Preview ({previews.length})
                  </p>
                  <button
                    onClick={() => { setPreviews([]); setEdits({}) }}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    Edit URLs
                  </button>
                </div>
                {previews.map(b => {
                  const e = edits[b.id] ?? { title: b.title, tagsRaw: b.tags.join(', ') }
                  return (
                    <div key={b.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2">
                      <div className="text-xs text-slate-400 truncate">{b.url}</div>
                      {b.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{b.description}</p>
                      )}
                      {/* Editable title */}
                      <input
                        value={e.title}
                        onChange={ev => updateEdit(b.id, 'title', ev.target.value)}
                        placeholder="Title"
                        className="w-full px-2 py-1.5 text-sm font-medium border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      {/* Editable tags */}
                      <div className="flex items-center gap-1.5">
                        <Tag size={11} className="shrink-0 text-slate-400" />
                        <input
                          value={e.tagsRaw}
                          onChange={ev => updateEdit(b.id, 'tagsRaw', ev.target.value)}
                          placeholder="tag1, tag2, tag3"
                          className="flex-1 px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Workspace selector — always shown when workspaces exist */}
            {workspaces.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide flex-1">
                    Add to workspaces
                  </p>
                  {suggestingWs && (
                    <span className="flex items-center gap-1 text-xs text-violet-500">
                      <Loader2 size={11} className="animate-spin" /> AI suggesting…
                    </span>
                  )}
                  {wsSuggested && !suggestingWs && (
                    <span className="flex items-center gap-1 text-xs text-violet-500">
                      <Sparkles size={11} /> AI suggested
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {workspaces.map(ws => {
                    const checked = selectedWsIds.has(ws.id)
                    const isDefault = ws.id === defaultWorkspaceId
                    return (
                      <button
                        key={ws.id}
                        onClick={() => !isDefault && toggleWs(ws.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors
                          ${checked
                            ? 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950'
                            : 'border-slate-200 dark:border-slate-700 hover:border-violet-200 dark:hover:border-violet-800'
                          }
                          ${isDefault ? 'opacity-75 cursor-default' : 'cursor-pointer'}`}
                      >
                        <span className={checked ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'}>
                          {checked ? <CheckSquare size={15} /> : <Square size={15} />}
                        </span>
                        <span className="text-sm text-slate-800 dark:text-slate-200 flex-1">{ws.name}</span>
                        {isDefault && <span className="text-xs text-slate-400">current</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!previews.length}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-40"
            >
              <Plus size={16} />
              Save{selectedWsIds.size > 0 ? ` to ${selectedWsIds.size} workspace${selectedWsIds.size > 1 ? 's' : ''}` : ''}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
