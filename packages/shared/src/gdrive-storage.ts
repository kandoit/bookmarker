import type { BookmarkData, WorkspaceData, SyncMeta } from './types'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

const BOOKMARKS_FILE = 'bookmarks.json'
const WORKSPACES_FILE = 'workspaces.json'

const EMPTY_BOOKMARKS: BookmarkData = { version: 1, updatedAt: new Date().toISOString(), items: [] }
const EMPTY_WORKSPACES: WorkspaceData = { version: 1, updatedAt: new Date().toISOString(), items: [] }

export class GDriveStorage {
  private headers: Record<string, string>

  constructor(private accessToken: string) {
    this.headers = { Authorization: `Bearer ${accessToken}` }
  }

  async testConnection(): Promise<void> {
    const res = await fetch(`${DRIVE_API}/about?fields=user`, { headers: this.headers })
    if (res.status === 401) throw new Error('Google Drive token expired — please reconnect')
    if (!res.ok) throw new Error(`Google Drive connection failed: ${res.status}`)
  }

  private async findFile(name: string): Promise<string | null> {
    const q = encodeURIComponent(`name='${name}'`)
    const res = await fetch(
      `${DRIVE_API}/files?spaces=appDataFolder&q=${q}&fields=files(id)`,
      { headers: this.headers }
    )
    if (!res.ok) throw new Error(`GDrive list failed: ${res.status}`)
    const data = await res.json()
    return (data.files as { id: string }[])?.[0]?.id ?? null
  }

  private async readFile(fileId: string): Promise<string> {
    const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, { headers: this.headers })
    if (!res.ok) throw new Error(`GDrive read failed: ${res.status}`)
    return res.text()
  }

  private async createFile(name: string, content: string): Promise<string> {
    const boundary = 'bookmarker-gdrive-boundary'
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name, parents: ['appDataFolder'] }),
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      content,
      `--${boundary}--`,
    ].join('\r\n')

    const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    })
    if (!res.ok) throw new Error(`GDrive create failed: ${res.status} ${await res.text()}`)
    const data = await res.json()
    return data.id as string
  }

  private async updateFile(fileId: string, content: string): Promise<void> {
    const res = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { ...this.headers, 'Content-Type': 'application/json; charset=UTF-8' },
      body: content,
    })
    if (!res.ok) throw new Error(`GDrive update failed: ${res.status} ${await res.text()}`)
  }

  async fetchAll(): Promise<{ bookmarks: BookmarkData; workspaces: WorkspaceData; meta: SyncMeta }> {
    const [bId, wId] = await Promise.all([
      this.findFile(BOOKMARKS_FILE),
      this.findFile(WORKSPACES_FILE),
    ])

    const [bContent, wContent] = await Promise.all([
      bId ? this.readFile(bId) : Promise.resolve(null),
      wId ? this.readFile(wId) : Promise.resolve(null),
    ])

    const bookmarks: BookmarkData = bContent ? JSON.parse(bContent) : { ...EMPTY_BOOKMARKS }
    const workspaces: WorkspaceData = wContent ? JSON.parse(wContent) : { ...EMPTY_WORKSPACES }

    return {
      bookmarks,
      workspaces,
      meta: {
        bookmarksSha: bId ?? '',
        workspacesSha: wId ?? '',
        lastSyncedAt: new Date().toISOString(),
      },
    }
  }

  async saveBookmarks(data: BookmarkData, fileId: string): Promise<string> {
    data.updatedAt = new Date().toISOString()
    const content = JSON.stringify(data, null, 2)
    if (fileId) {
      await this.updateFile(fileId, content)
      return fileId
    }
    return this.createFile(BOOKMARKS_FILE, content)
  }

  async saveWorkspaces(data: WorkspaceData, fileId: string): Promise<string> {
    data.updatedAt = new Date().toISOString()
    const content = JSON.stringify(data, null, 2)
    if (fileId) {
      await this.updateFile(fileId, content)
      return fileId
    }
    return this.createFile(WORKSPACES_FILE, content)
  }
}
