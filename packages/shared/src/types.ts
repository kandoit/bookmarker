export interface Bookmark {
  id: string
  url: string
  title: string
  description: string
  tags: string[]
  favicon: string
  createdAt: string
}

export interface Workspace {
  id: string
  name: string
  description: string
  bookmarkIds: string[]
  createdAt: string
  lastOpenedAt: string | null
}

export interface Settings {
  githubToken: string
  githubOwner: string
  githubRepo: string
  githubBranch: string
  openaiApiKey: string
  webAppUrl: string
  storageBackend: 'github' | 'gdrive'
  gdriveClientId: string
  gdriveAccessToken: string
  gdriveTokenExpiry: string
}

export interface BookmarkData {
  version: number
  updatedAt: string
  items: Bookmark[]
}

export interface WorkspaceData {
  version: number
  updatedAt: string
  items: Workspace[]
}

export interface SyncMeta {
  bookmarksSha: string
  workspacesSha: string
  lastSyncedAt: string
}

export interface AIBookmarkInfo {
  title: string
  description: string
  tags: string[]
}

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  bookmarkRefs?: string[]
}

export interface AgentTool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required?: string[]
  }
  execute: (args: Record<string, unknown>) => Promise<string>
}

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_start'; name: string; args: Record<string, unknown> }
  | { type: 'tool_done'; name: string; result: string }
