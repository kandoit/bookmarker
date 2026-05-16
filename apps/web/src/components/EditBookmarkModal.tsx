import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { Bookmark } from '@bookmarker/shared'

interface Props {
  bookmark: Bookmark | null
  onSave: (id: string, updates: Partial<Bookmark>) => void
  onClose: () => void
}

export default function EditBookmarkModal({ bookmark, onSave, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')

  useEffect(() => {
    if (bookmark) {
      setTitle(bookmark.title)
      setUrl(bookmark.url)
      setDescription(bookmark.description ?? '')
      setTagsRaw(bookmark.tags.join(', '))
    }
  }, [bookmark])

  if (!bookmark) return null

  const handleSave = () => {
    if (!url.trim()) return
    onSave(bookmark.id, {
      title: title.trim() || url.trim(),
      url: url.trim(),
      description: description.trim(),
      tags: tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
    })
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
  const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"

  return (
    <Dialog.Root open={!!bookmark} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 p-6">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-white">Edit Bookmark</Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelCls}>Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="Page title" />
            </div>
            <div>
              <label className={labelCls}>URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)} className={inputCls} placeholder="https://example.com" />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className={inputCls + ' resize-none'}
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className={labelCls}>Tags <span className="text-slate-400 font-normal">(comma-separated)</span></label>
              <input value={tagsRaw} onChange={e => setTagsRaw(e.target.value)} className={inputCls} placeholder="tag1, tag2, tag3" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Dialog.Close asChild>
              <button className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              disabled={!url.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-40"
            >
              Save changes
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
