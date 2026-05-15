import { NavLink } from 'react-router-dom'
import { Bookmark, FolderOpen, MessageSquare, Settings, Moon, Sun, RefreshCw } from 'lucide-react'
import { useStore } from '../store'
import { useSync } from '../hooks/useSync'

const nav = [
  { to: '/', icon: Bookmark, label: 'Bookmarks' },
  { to: '/workspaces', icon: FolderOpen, label: 'Workspaces' },
  { to: '/chat', icon: MessageSquare, label: 'AI Chat' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { darkMode, toggleDarkMode, isSyncing, syncError, sync } = useStore()
  const { pull } = useSync()

  const lastSync = sync.lastSyncedAt
    ? new Date(sync.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="px-4 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔖</span>
            <span className="font-semibold text-slate-900 dark:text-white">Bookmarker</span>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-slate-200 dark:border-slate-800 space-y-0.5">
          {/* Sync status */}
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

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`
            }
          >
            <Settings size={16} />
            Settings
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

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
