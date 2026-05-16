import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Bookmark, FolderOpen, MessageSquare, Settings, Moon, Sun, RefreshCw, X, Menu } from 'lucide-react'
import { useStore } from '../store'
import { useSync } from '../hooks/useSync'

const nav = [
  { to: '/', icon: Bookmark, label: 'Bookmarks' },
  { to: '/workspaces', icon: FolderOpen, label: 'Workspaces' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { darkMode, toggleDarkMode, isSyncing, syncError, sync } = useStore()
  const { pull } = useSync()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const lastSync = sync.lastSyncedAt
    ? new Date(sync.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
    }`

  return (
    <div className="flex h-dvh bg-slate-50 dark:bg-slate-950 overflow-hidden">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="px-4 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔖</span>
            <span className="font-semibold text-slate-900 dark:text-white">Bookmarker</span>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {nav.slice(0, 3).map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} className={navLinkClass}>
              <Icon size={16} />{label}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-slate-200 dark:border-slate-800 space-y-0.5">
          <button
            onClick={pull}
            disabled={isSyncing}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            <span className={syncError ? 'text-red-500' : ''}>
              {syncError ? 'Sync error' : lastSync ? `Synced ${lastSync}` : 'Not synced'}
            </span>
          </button>
          <NavLink to="/settings" className={navLinkClass}>
            <Settings size={16} />Settings
          </NavLink>
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {darkMode ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile slide-in drawer ── */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-50 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-200 md:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔖</span>
            <span className="font-semibold text-slate-900 dark:text-white">Bookmarker</span>
          </div>
          <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to} end={to === '/'}
              className={navLinkClass}
              onClick={() => setDrawerOpen(false)}
            >
              <Icon size={16} />{label}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-slate-200 dark:border-slate-800 space-y-0.5">
          <button
            onClick={pull}
            disabled={isSyncing}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            <span className={syncError ? 'text-red-500' : ''}>
              {syncError ? 'Sync error' : lastSync ? `Synced ${lastSync}` : 'Not synced'}
            </span>
          </button>
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {darkMode ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </aside>

      {/* ── Content column ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top header */}
        <header className="md:hidden shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔖</span>
            <span className="font-semibold text-slate-900 dark:text-white text-sm">Bookmarker</span>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Main scrollable area — pad bottom for mobile tab bar */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          {children}
        </main>

        {/* ── Mobile bottom tab bar ── */}
        <nav className="md:hidden shrink-0 flex items-center border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-violet-600 dark:text-violet-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
