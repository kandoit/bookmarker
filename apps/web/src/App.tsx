import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore, isConfigured } from './store'
import { useSync } from './hooks/useSync'
import { addBookmark } from '@bookmarker/shared'
import Layout from './components/Layout'
import BookmarksPage from './pages/BookmarksPage'
import WorkspacesPage from './pages/WorkspacesPage'
import WorkspaceDetailPage from './pages/WorkspaceDetailPage'
import ChatPage from './pages/ChatPage'
import SettingsPage from './pages/SettingsPage'
import AddBookmarkModal from './components/AddBookmarkModal'

export default function App() {
  const { settings, darkMode, bookmarks, workspaces } = useStore()
  const { pull, schedulePush } = useSync()
  const configured = isConfigured(settings)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    if (configured) pull()
  }, [configured]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect Web Share Target params (?url=...&title=...&text=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const url = params.get('url') || params.get('text') || ''
    if (url) {
      setShareUrl(url)
      // Clean up the query string without re-navigating
      window.history.replaceState({}, '', window.location.pathname + window.location.hash)
    }
  }, [])

  const handleShareSave = (newBookmarks: import('@bookmarker/shared').Bookmark[]) => {
    let bData = { version: 1, updatedAt: '', items: bookmarks }
    for (const b of newBookmarks) bData = addBookmark(bData, b)
    schedulePush(bData)
  }

  if (!configured) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔖</div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">AI Bookmarker</h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Connect your GitHub repo to get started
            </p>
          </div>
          <SettingsPage onboarding />
        </div>
      </div>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<BookmarksPage />} />
        <Route path="/workspaces" element={<WorkspacesPage />} />
        <Route path="/workspaces/:id" element={<WorkspaceDetailPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Web Share Target: auto-open add modal when app is launched via share */}
      <AddBookmarkModal
        open={!!shareUrl}
        onClose={() => setShareUrl(null)}
        workspaces={workspaces}
        openaiKey={settings.openaiApiKey}
        initialUrl={shareUrl ?? undefined}
        onSave={(bms) => { handleShareSave(bms); setShareUrl(null) }}
      />
    </Layout>
  )
}
