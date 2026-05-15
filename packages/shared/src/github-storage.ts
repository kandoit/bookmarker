import type { BookmarkData, WorkspaceData, SyncMeta } from './types'

const API = 'https://api.github.com'

const BOOKMARKS_FILE = 'data/bookmarks.json'
const WORKSPACES_FILE = 'data/workspaces.json'

const EMPTY_BOOKMARKS: BookmarkData = { version: 1, updatedAt: new Date().toISOString(), items: [] }
const EMPTY_WORKSPACES: WorkspaceData = { version: 1, updatedAt: new Date().toISOString(), items: [] }

export class GitHubStorage {
  private headers: Record<string, string>

  constructor(
    private token: string,
    private owner: string,
    private repo: string,
    private branch: string = 'main'
  ) {
    this.headers = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    }
  }

  private async readFile(path: string): Promise<{ content: string; sha: string } | null> {
    const res = await fetch(
      `${API}/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`,
      { headers: this.headers }
    )
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`GitHub read failed: ${res.status} ${await res.text()}`)
    const data = await res.json()
    const content = decodeURIComponent(
      Array.from(atob(data.content.replace(/\n/g, '')))
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    return { content, sha: data.sha }
  }

  private async writeFile(path: string, content: string, message: string, sha?: string) {
    const encoded = btoa(
      encodeURIComponent(content).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    )
    const body: Record<string, unknown> = { message, content: encoded, branch: this.branch }
    if (sha) body.sha = sha

    const res = await fetch(`${API}/repos/${this.owner}/${this.repo}/contents/${path}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`GitHub write failed: ${res.status} ${await res.text()}`)
    const data = await res.json()
    return data.content.sha as string
  }

  async testConnection(): Promise<void> {
    const res = await fetch(`${API}/repos/${this.owner}/${this.repo}`, { headers: this.headers })
    if (!res.ok) throw new Error(`Cannot access repo: ${res.status}`)
  }

  async fetchAll(): Promise<{ bookmarks: BookmarkData; workspaces: WorkspaceData; meta: SyncMeta }> {
    const [bFile, wFile] = await Promise.all([
      this.readFile(BOOKMARKS_FILE),
      this.readFile(WORKSPACES_FILE),
    ])

    const bookmarks: BookmarkData = bFile ? JSON.parse(bFile.content) : EMPTY_BOOKMARKS
    const workspaces: WorkspaceData = wFile ? JSON.parse(wFile.content) : EMPTY_WORKSPACES

    const meta: SyncMeta = {
      bookmarksSha: bFile?.sha ?? '',
      workspacesSha: wFile?.sha ?? '',
      lastSyncedAt: new Date().toISOString(),
    }

    return { bookmarks, workspaces, meta }
  }

  async saveBookmarks(data: BookmarkData, sha: string): Promise<string> {
    data.updatedAt = new Date().toISOString()
    return this.writeFile(BOOKMARKS_FILE, JSON.stringify(data, null, 2), 'chore: update bookmarks', sha || undefined)
  }

  async saveWorkspaces(data: WorkspaceData, sha: string): Promise<string> {
    data.updatedAt = new Date().toISOString()
    return this.writeFile(WORKSPACES_FILE, JSON.stringify(data, null, 2), 'chore: update workspaces', sha || undefined)
  }

  async initRepo(): Promise<SyncMeta> {
    const bSha = await this.writeFile(
      BOOKMARKS_FILE,
      JSON.stringify(EMPTY_BOOKMARKS, null, 2),
      'chore: init bookmarks'
    )
    const wSha = await this.writeFile(
      WORKSPACES_FILE,
      JSON.stringify(EMPTY_WORKSPACES, null, 2),
      'chore: init workspaces'
    )
    return { bookmarksSha: bSha, workspacesSha: wSha, lastSyncedAt: new Date().toISOString() }
  }
}
