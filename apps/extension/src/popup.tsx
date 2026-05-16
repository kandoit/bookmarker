import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster, toast } from 'sonner'
import { Bookmark, CheckCircle2, Search, Settings, Loader2, Sparkles, ExternalLink, X } from 'lucide-react'
import {
  GitHubStorage,
  analyzeUrl,
  createBookmark,
  addBookmark,
  textSearch,
  getFavicon,
} from '@bookmarker/shared'
import type { Settings as AppSettings, Bookmark as BM } from '@bookmarker/shared'
import './popup.css'

type View = 'save' | 'search'

function getStorage(): AppSettings | null {
  const raw = localStorage.getItem('ext-settings')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function setStorage(s: AppSettings) {
  localStorage.setItem('ext-settings', JSON.stringify(s))
}

async function getChromeSettings(): Promise<AppSettings | null> {
  return new Promise(resolve => {
    chrome.storage.local.get('settings', r => resolve(r.settings ?? null))
  })
}

async function saveSettings(s: AppSettings) {
  return new Promise<void>(resolve => {
    chrome.storage.local.set({ settings: s }, resolve)
  })
}

async function getCachedBookmarks(): Promise<BM[]> {
  return new Promise(resolve => {
    chrome.storage.local.get('bookmarks', r => resolve(r.bookmarks ?? []))
  })
}

async function setCachedBookmarks(items: BM[]) {
  return new Promise<void>(resolve => {
    chrome.storage.local.set({ bookmarks: items }, resolve)
  })
}

async function getCachedMeta() {
  return new Promise<{ bookmarksSha: string; workspacesSha: string }>(resolve => {
    chrome.storage.local.get('syncMeta', r =>
      resolve(r.syncMeta ?? { bookmarksSha: '', workspacesSha: '' })
    )
  })
}

async function getPageContent(tabId: number): Promise<string> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body.innerText.slice(0, 5000),
    })
    return result.result as string
  } catch {
    return ''
  }
}

function Popup() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null)
  const [view, setView] = useState<View>('save')
  const [bookmarks, setBookmarks] = useState<BM[]>([])
  const [isSaved, setIsSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<BM[]>([])
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([])
  const [selectedWs, setSelectedWs] = useState('')

  useEffect(() => {
    async function init() {
      const [s, [currentTab], cached] = await Promise.all([
        getChromeSettings(),
        chrome.tabs.query({ active: true, currentWindow: true }),
        getCachedBookmarks(),
      ])

      setSettings(s)
      setTab(currentTab)
      setBookmarks(cached)
      setIsSaved(cached.some(b => b.url === currentTab?.url))

      // Pull pending URL from context menu
      chrome.storage.local.get('pendingUrl', ({ pendingUrl }) => {
        if (pendingUrl && pendingUrl !== currentTab?.url) {
          chrome.storage.local.remove('pendingUrl')
        }
      })

      // Sync bookmarks from GitHub
      if (s?.githubToken && s.githubOwner && s.githubRepo) {
        try {
          setLoading(true)
          const storage = new GitHubStorage(s.githubToken, s.githubOwner, s.githubRepo, s.githubBranch)
          const { bookmarks: bData, workspaces: wData } = await storage.fetchAll()
          setBookmarks(bData.items)
          setWorkspaces(wData.items.map(w => ({ id: w.id, name: w.name })))
          setIsSaved(bData.items.some(b => b.url === currentTab?.url))
          await setCachedBookmarks(bData.items)
        } catch { /* offline */ } finally {
          setLoading(false)
        }
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!query) { setSearchResults([]); return }
    setSearchResults(textSearch(bookmarks, query).slice(0, 6))
  }, [query, bookmarks])

  const handleSave = async () => {
    if (!settings || !tab?.url) return
    setSaving(true)
    try {
      const pageContent = tab.id ? await getPageContent(tab.id) : ''
      let info = { title: tab.title ?? '', description: '', tags: [] as string[] }

      if (settings.openaiApiKey) {
        const ai = await analyzeUrl(tab.url, pageContent, settings.openaiApiKey)
        info = { title: ai.title || tab.title || tab.url, description: ai.description, tags: ai.tags }
      }

      const bookmark = createBookmark({
        url: tab.url,
        title: info.title,
        description: info.description,
        tags: info.tags,
        favicon: getFavicon(tab.url),
      })

      const meta = await getCachedMeta()
      const storage = new GitHubStorage(settings.githubToken, settings.githubOwner, settings.githubRepo, settings.githubBranch)
      const bData = addBookmark({ version: 1, updatedAt: '', items: bookmarks }, bookmark)

      if (selectedWs) {
        const { workspaces: wData } = await storage.fetchAll()
        const updated = wData.items.map(w =>
          w.id === selectedWs ? { ...w, bookmarkIds: [...w.bookmarkIds, bookmark.id] } : w
        )
        const newWMeta = await storage.saveWorkspaces({ ...wData, items: updated }, meta.workspacesSha)
        await chrome.storage.local.set({ syncMeta: { ...meta, workspacesSha: newWMeta } })
      }

      const newSha = await storage.saveBookmarks(bData, meta.bookmarksSha)
      await chrome.storage.local.set({ syncMeta: { ...meta, bookmarksSha: newSha } })
      await setCachedBookmarks(bData.items)
      setBookmarks(bData.items)
      setIsSaved(true)
      toast.success('Bookmarked!')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const isConfigured = !!(settings?.githubToken && settings.githubOwner && settings.githubRepo)

  if (!isConfigured) {
    return (
      <div className="p-4 text-center">
        <div className="text-2xl mb-2">🔖</div>
        <p className="text-sm text-slate-600 mb-3">Setup required</p>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          Open Settings
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔖</span>
          <span className="font-semibold text-sm text-slate-900">Bookmarker</span>
          {loading && <Loader2 size={12} className="animate-spin text-slate-400" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('save')}
            className={`p-1.5 rounded-lg transition-colors ${view === 'save' ? 'bg-violet-50 text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Bookmark size={15} />
          </button>
          <button
            onClick={() => setView('search')}
            className={`p-1.5 rounded-lg transition-colors ${view === 'search' ? 'bg-violet-50 text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Search size={15} />
          </button>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {view === 'save' && (
        <div className="p-4 space-y-3 flex-1">
          {/* Current tab */}
          {tab && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
              {tab.favIconUrl && (
                <img src={tab.favIconUrl} alt="" className="w-4 h-4 rounded mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 line-clamp-1">{tab.title}</p>
                <p className="text-xs text-slate-400 truncate">{tab.url}</p>
              </div>
              {isSaved && <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />}
            </div>
          )}

          {/* Workspace */}
          {workspaces.length > 0 && (
            <select
              value={selectedWs}
              onChange={e => setSelectedWs(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">No workspace</option>
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          )}

          {isSaved ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 size={15} />
              Already bookmarked
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !tab?.url}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-40"
            >
              {saving ? (
                <><Loader2 size={14} className="animate-spin" /> {settings?.openaiApiKey ? 'Analyzing…' : 'Saving…'}</>
              ) : (
                <>{settings?.openaiApiKey ? <><Sparkles size={14} /> Save with AI</> : 'Save bookmark'}</>
              )}
            </button>
          )}

          {settings?.webAppUrl && (
            <a
              href={settings.webAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors"
            >
              <ExternalLink size={12} />
              Open web app
            </a>
          )}
        </div>
      )}

      {view === 'search' && (
        <div className="p-4 flex-1 flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search bookmarks…"
              autoFocus
              className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="space-y-1 flex-1 overflow-y-auto">
            {searchResults.length === 0 && query && (
              <p className="text-xs text-slate-400 text-center py-4">No results</p>
            )}
            {searchResults.length === 0 && !query && (
              <p className="text-xs text-slate-400 text-center py-4">Type to search {bookmarks.length} bookmarks</p>
            )}
            {searchResults.map(b => (
              <a
                key={b.id}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 group"
              >
                {b.favicon && <img src={b.favicon} alt="" className="w-4 h-4 rounded shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 line-clamp-1">{b.title || b.url}</p>
                  <p className="text-xs text-slate-400 truncate">{new URL(b.url).hostname}</p>
                </div>
                <ExternalLink size={12} className="text-slate-300 group-hover:text-violet-500 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      <Toaster position="bottom-center" richColors />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Popup /></React.StrictMode>
)
