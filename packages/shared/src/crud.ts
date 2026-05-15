import { v4 as uuid } from 'uuid'
import type { Bookmark, Workspace, BookmarkData, WorkspaceData } from './types'

export function createBookmark(fields: Omit<Bookmark, 'id' | 'createdAt'>): Bookmark {
  return { ...fields, id: uuid(), createdAt: new Date().toISOString() }
}

export function createWorkspace(name: string, description: string = ''): Workspace {
  return {
    id: uuid(),
    name: name.trim(),
    description: description.trim(),
    bookmarkIds: [],
    createdAt: new Date().toISOString(),
    lastOpenedAt: null,
  }
}

export function addBookmark(data: BookmarkData, bookmark: Bookmark): BookmarkData {
  const exists = data.items.find(b => b.url === bookmark.url)
  if (exists) return data
  return { ...data, items: [bookmark, ...data.items] }
}

export function updateBookmark(data: BookmarkData, id: string, updates: Partial<Bookmark>): BookmarkData {
  return {
    ...data,
    items: data.items.map(b => (b.id === id ? { ...b, ...updates } : b)),
  }
}

export function deleteBookmark(data: BookmarkData, id: string): BookmarkData {
  return { ...data, items: data.items.filter(b => b.id !== id) }
}

export function addWorkspace(data: WorkspaceData, workspace: Workspace): WorkspaceData {
  const exists = data.items.find(w => w.name === workspace.name)
  if (exists) return data
  return { ...data, items: [workspace, ...data.items] }
}

export function updateWorkspace(data: WorkspaceData, id: string, updates: Partial<Workspace>): WorkspaceData {
  return {
    ...data,
    items: data.items.map(w => (w.id === id ? { ...w, ...updates } : w)),
  }
}

export function deleteWorkspace(data: WorkspaceData, id: string): WorkspaceData {
  return { ...data, items: data.items.filter(w => w.id !== id) }
}

export function addBookmarkToWorkspace(data: WorkspaceData, workspaceId: string, bookmarkId: string): WorkspaceData {
  return {
    ...data,
    items: data.items.map(w =>
      w.id === workspaceId && !w.bookmarkIds.includes(bookmarkId)
        ? { ...w, bookmarkIds: [...w.bookmarkIds, bookmarkId] }
        : w
    ),
  }
}

export function removeBookmarkFromWorkspace(data: WorkspaceData, workspaceId: string, bookmarkId: string): WorkspaceData {
  return {
    ...data,
    items: data.items.map(w =>
      w.id === workspaceId
        ? { ...w, bookmarkIds: w.bookmarkIds.filter(id => id !== bookmarkId) }
        : w
    ),
  }
}

export function textSearch(bookmarks: Bookmark[], query: string): Bookmark[] {
  const q = query.toLowerCase()
  return bookmarks.filter(
    b =>
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q) ||
      b.tags.some(t => t.toLowerCase().includes(q))
  )
}

export function getFavicon(url: string): string {
  try {
    const { hostname } = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
  } catch {
    return ''
  }
}
