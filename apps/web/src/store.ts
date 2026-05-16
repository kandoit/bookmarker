import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Bookmark, Workspace, Settings, SyncMeta } from '@bookmarker/shared'

interface AppState {
  bookmarks: Bookmark[]
  workspaces: Workspace[]
  settings: Settings
  sync: SyncMeta
  isSyncing: boolean
  syncError: string | null
  darkMode: boolean

  setBookmarks: (b: Bookmark[]) => void
  setWorkspaces: (w: Workspace[]) => void
  setSync: (s: SyncMeta) => void
  updateSettings: (s: Partial<Settings>) => void
  setSyncing: (v: boolean) => void
  setSyncError: (e: string | null) => void
  toggleDarkMode: () => void
}

const defaultSettings: Settings = {
  githubToken: '',
  githubOwner: '',
  githubRepo: '',
  githubBranch: 'main',
  openaiApiKey: '',
  webAppUrl: '',
  storageBackend: 'github',
  gdriveClientId: '',
  gdriveAccessToken: '',
  gdriveTokenExpiry: '',
}

const defaultSync: SyncMeta = {
  bookmarksSha: '',
  workspacesSha: '',
  lastSyncedAt: '',
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      bookmarks: [],
      workspaces: [],
      settings: defaultSettings,
      sync: defaultSync,
      isSyncing: false,
      syncError: null,
      darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,

      setBookmarks: (bookmarks) => set({ bookmarks }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      setSync: (sync) => set({ sync }),
      updateSettings: (s) => set((state) => ({ settings: { ...state.settings, ...s } })),
      setSyncing: (isSyncing) => set({ isSyncing }),
      setSyncError: (syncError) => set({ syncError }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
    }),
    {
      name: 'bookmarker-store',
      partialize: (state) => ({
        bookmarks: state.bookmarks,
        workspaces: state.workspaces,
        settings: state.settings,
        sync: state.sync,
        darkMode: state.darkMode,
      }),
      // Deep-merge settings so new fields added to defaultSettings are preserved
      // when loading an older persisted store that doesn't have them yet.
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState>
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...(p.settings ?? {}) },
          sync: { ...current.sync, ...(p.sync ?? {}) },
        }
      },
    }
  )
)

export function isConfigured(settings: Settings): boolean {
  if (settings.storageBackend === 'gdrive') return !!settings.gdriveAccessToken
  return !!(settings.githubToken && settings.githubOwner && settings.githubRepo)
}
