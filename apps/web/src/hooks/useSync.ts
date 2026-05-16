import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { GitHubStorage, GDriveStorage } from '@bookmarker/shared'
import type { BookmarkData, WorkspaceData } from '@bookmarker/shared'
import { useStore } from '../store'
import { logger } from '../logger'

export function useSync() {
  const { settings, sync, setBookmarks, setWorkspaces, setSync, setSyncing, setSyncError } = useStore()
  const pendingRef = useRef<{ bookmarks?: BookmarkData; workspaces?: WorkspaceData }>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getStorage = useCallback(() => {
    if (settings.storageBackend === 'gdrive') {
      return new GDriveStorage(settings.gdriveAccessToken)
    }
    return new GitHubStorage(
      settings.githubToken,
      settings.githubOwner,
      settings.githubRepo,
      settings.githubBranch
    )
  }, [settings])

  const pull = useCallback(async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      const storage = getStorage()
      const { bookmarks, workspaces, meta } = await storage.fetchAll()
      setBookmarks(bookmarks.items)
      setWorkspaces(workspaces.items)
      setSync(meta)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync failed'
      logger.error('Storage pull failed', msg)
      setSyncError(msg)
      toast.error(msg)
    } finally {
      setSyncing(false)
    }
  }, [getStorage, setBookmarks, setWorkspaces, setSync, setSyncing, setSyncError])

  const pushBookmarks = useCallback(
    async (data: BookmarkData) => {
      const storage = getStorage()
      const sha = await storage.saveBookmarks(data, sync.bookmarksSha)
      setSync({ ...sync, bookmarksSha: sha, lastSyncedAt: new Date().toISOString() })
    },
    [getStorage, sync, setSync]
  )

  const pushWorkspaces = useCallback(
    async (data: WorkspaceData) => {
      const storage = getStorage()
      const sha = await storage.saveWorkspaces(data, sync.workspacesSha)
      setSync({ ...sync, workspacesSha: sha, lastSyncedAt: new Date().toISOString() })
    },
    [getStorage, sync, setSync]
  )

  const schedulePush = useCallback(
    (bookmarks?: BookmarkData, workspaces?: WorkspaceData) => {
      if (bookmarks) pendingRef.current.bookmarks = bookmarks
      if (workspaces) pendingRef.current.workspaces = workspaces

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        const { bookmarks: b, workspaces: w } = pendingRef.current
        pendingRef.current = {}
        setSyncing(true)
        try {
          if (b) await pushBookmarks(b)
          if (w) await pushWorkspaces(w)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Push failed'
          logger.error('Storage push failed', msg)
          setSyncError(msg)
          toast.error(msg)
        } finally {
          setSyncing(false)
        }
      }, 600)
    },
    [pushBookmarks, pushWorkspaces, setSyncing, setSyncError]
  )

  return { pull, schedulePush, pushBookmarks, pushWorkspaces }
}
