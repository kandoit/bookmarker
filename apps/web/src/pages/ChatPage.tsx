import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, BookmarkIcon, Loader2, CheckCircle2, AlertCircle, Plus } from 'lucide-react'
import { streamChat, analyzeUrl, searchBookmarks, suggestNewBookmarks, fetchPageContent, createBookmark, addBookmark, addBookmarkToWorkspace, getFavicon } from '@bookmarker/shared'
import type { ChatMessage, Bookmark, AgentTool, StreamEvent } from '@bookmarker/shared'
import { useStore } from '../store'
import { useSync } from '../hooks/useSync'
import { logger } from '../logger'
import { v4 as uuid } from 'uuid'

// ── Types ────────────────────────────────────────────────────────────────────

interface ToolEvent {
  id: string
  name: string
  label: string
  status: 'running' | 'done' | 'error'
}

interface SearchResult {
  bookmark: Bookmark
  reason: string
}

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolEvents: ToolEvent[]
  searchResults?: SearchResult[]
}

// ── Sub-components ───────────────────────────────────────────────────────────

function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-xs hover:bg-violet-100 dark:hover:bg-violet-900 transition-colors"
    >
      {bookmark.favicon && (
        <img src={bookmark.favicon} alt="" className="w-3.5 h-3.5 rounded"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      )}
      <BookmarkIcon size={10} />
      {bookmark.title || bookmark.url}
    </a>
  )
}

function ToolBadge({ event }: { event: ToolEvent }) {
  const icon = event.status === 'running'
    ? <Loader2 size={12} className="animate-spin" />
    : event.status === 'done'
      ? <CheckCircle2 size={12} className="text-green-500" />
      : <AlertCircle size={12} className="text-red-500" />

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 w-fit">
      {icon}
      {event.label}
    </div>
  )
}

function SearchResultCard({
  result,
  onAdd,
  added,
}: {
  result: SearchResult
  onAdd: (bookmark: Bookmark) => void
  added: boolean
}) {
  const { bookmark, reason } = result
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="flex-1 min-w-0">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium text-violet-700 dark:text-violet-300 hover:underline truncate"
        >
          {bookmark.favicon && (
            <img src={bookmark.favicon} alt="" className="w-3.5 h-3.5 rounded shrink-0"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          )}
          <span className="truncate">{bookmark.title || bookmark.url}</span>
        </a>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{reason}</p>
        {bookmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {bookmark.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-1.5 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => onAdd(bookmark)}
        disabled={added}
        title={added ? 'Already saved' : 'Save this bookmark'}
        className="shrink-0 p-1.5 rounded-lg text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950 disabled:opacity-40 disabled:cursor-default transition-colors"
      >
        {added ? <CheckCircle2 size={14} className="text-green-500" /> : <Plus size={14} />}
      </button>
    </div>
  )
}

function MessageBubble({
  message,
  bookmarks,
  onAddBookmark,
  savedIds,
}: {
  message: DisplayMessage
  bookmarks: Bookmark[]
  onAddBookmark: (bookmark: Bookmark) => void
  savedIds: Set<string>
}) {
  const isUser = message.role === 'user'
  const parts = message.content.split(/\[\[BOOKMARK:([^\]]+)\]\]/)

  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
      {message.toolEvents.map(ev => <ToolBadge key={ev.id} event={ev} />)}

      {message.content && (
        <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-violet-600 text-white rounded-tr-sm'
            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm'
        }`}>
          {parts.map((part, i) => {
            if (i % 2 === 0) return <span key={i} className="whitespace-pre-wrap">{part}</span>
            const bm = bookmarks.find(b => b.id === part)
            return bm ? <BookmarkCard key={i} bookmark={bm} /> : null
          })}
        </div>
      )}

      {/* Search results with add buttons */}
      {message.searchResults && message.searchResults.length > 0 && (
        <div className="w-full max-w-[85%] sm:max-w-[80%] flex flex-col gap-2 mt-1">
          {message.searchResults.map(result => (
            <SearchResultCard
              key={result.bookmark.id}
              result={result}
              onAdd={onAddBookmark}
              added={savedIds.has(result.bookmark.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { bookmarks, workspaces, settings } = useStore()
  const setBookmarks = useStore(s => s.setBookmarks)
  const setWorkspaces = useStore(s => s.setWorkspaces)
  const { schedulePush } = useSync()

  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)
  const bookmarksRef = useRef(bookmarks)
  const workspacesRef = useRef(workspaces)
  bookmarksRef.current = bookmarks
  workspacesRef.current = workspaces

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Pre-populate savedIds with existing bookmark ids
  useEffect(() => {
    setSavedIds(new Set(bookmarks.map(b => b.id)))
  }, [bookmarks])

  const handleAddBookmark = useCallback((bookmark: Bookmark) => {
    let bData = { version: 1, updatedAt: '', items: bookmarksRef.current }
    bData = addBookmark(bData, bookmark)
    setBookmarks(bData.items)
    schedulePush(bData, undefined)
    setSavedIds(prev => new Set([...prev, bookmark.id]))
  }, [setBookmarks, schedulePush])

  // ── Tool definitions ──────────────────────────────────────────────────────

  const buildTools = useCallback((): AgentTool[] => [
    {
      name: 'add_bookmark',
      description: 'Fetch a URL\'s real page content, analyze it, and save it as a bookmark. Call this immediately whenever the user shares a URL — do not describe the URL, save it.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The full URL to fetch and bookmark (must start with http:// or https://)' },
          workspace_id: { type: 'string', description: 'Optional workspace ID to assign the bookmark to' },
        },
        required: ['url'],
      },
      execute: async (args) => {
        const url = args.url as string
        const workspaceId = args.workspace_id as string | undefined

        // Fetch real page content for accurate title/description/tags
        const pageContent = await fetchPageContent(url)
        if (!pageContent) logger.warn('Could not fetch page content, falling back to AI knowledge', url)

        const info = settings.openaiApiKey
          ? await analyzeUrl(url, pageContent, settings.openaiApiKey)
          : { title: url, description: '', tags: [] }

        logger.info('Bookmark saved via chat', { url, title: info.title })

        const bookmark = createBookmark({
          url,
          title: info.title || url,
          description: info.description,
          tags: info.tags,
          favicon: getFavicon(url),
        })

        let bData = { version: 1, updatedAt: '', items: bookmarksRef.current }
        bData = addBookmark(bData, bookmark)
        setBookmarks(bData.items)

        let wData = { version: 1, updatedAt: '', items: workspacesRef.current }
        if (workspaceId) {
          wData = addBookmarkToWorkspace(wData, workspaceId, bookmark.id)
          setWorkspaces(wData.items)
        }

        schedulePush(bData, workspaceId ? wData : undefined)

        return JSON.stringify({
          id: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
          description: bookmark.description,
          tags: bookmark.tags,
          workspace: workspaceId
            ? workspacesRef.current.find(w => w.id === workspaceId)?.name
            : null,
        })
      },
    },
    {
      name: 'search_bookmarks',
      description: 'Search the user\'s saved bookmarks using natural language keywords. Returns a list of matching bookmarks with relevance reasons. Use this when the user wants to find bookmarks they already saved.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language search query' },
          message_id: { type: 'string', description: 'Internal message ID to attach results to (pass the value provided in the system context)' },
        },
        required: ['query'],
      },
      execute: async (args) => {
        const query = args.query as string
        const msgId = args.message_id as string | undefined

        if (!bookmarksRef.current.length) return JSON.stringify({ results: [], message: 'No bookmarks saved yet.' })

        const results = settings.openaiApiKey
          ? await searchBookmarks(query, bookmarksRef.current, settings.openaiApiKey)
          : []

        // Attach search results to the assistant message so the UI can render them
        if (msgId) {
          setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, searchResults: results } : m
          ))
        }

        if (!results.length) return JSON.stringify({ results: [], message: 'No matching bookmarks found.' })

        return JSON.stringify({
          results: results.map(r => ({
            id: r.bookmark.id,
            title: r.bookmark.title,
            url: r.bookmark.url,
            reason: r.reason,
            tags: r.bookmark.tags,
          })),
        })
      },
    },
    {
      name: 'list_workspaces',
      description: 'List all available workspaces so the agent can assign bookmarks to the right one.',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async () => JSON.stringify(
        workspacesRef.current.map(w => ({
          id: w.id,
          name: w.name,
          description: w.description,
          bookmark_count: w.bookmarkIds.length,
        }))
      ),
    },
    {
      name: 'suggest_bookmarks',
      description: 'Suggest new bookmarks the user might enjoy based on their existing collection. Call this when the user asks for recommendations, suggestions, or wants to discover new resources.',
      parameters: {
        type: 'object',
        properties: {
          message_id: { type: 'string', description: 'Internal message ID (provided by the system)' },
        },
      },
      execute: async (args) => {
        const msgId = args.message_id as string | undefined

        if (!bookmarksRef.current.length) {
          return JSON.stringify({ message: 'No bookmarks yet — save some first so I can learn your interests.' })
        }

        const suggestions = settings.openaiApiKey
          ? await suggestNewBookmarks(bookmarksRef.current, settings.openaiApiKey)
          : []

        if (!suggestions.length) {
          return JSON.stringify({ message: 'Could not generate suggestions right now.' })
        }

        const results: SearchResult[] = suggestions.map(s => ({
          bookmark: createBookmark({
            url: s.url,
            title: s.title,
            description: s.description,
            tags: s.tags,
            favicon: getFavicon(s.url),
          }),
          reason: s.reason,
        }))

        if (msgId) {
          setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, searchResults: results } : m
          ))
        }

        logger.info('Bookmark suggestions generated', { count: results.length })
        return JSON.stringify({ suggestions: suggestions.map(s => ({ title: s.title, url: s.url })) })
      },
    },
  ], [settings.openaiApiKey, setBookmarks, setWorkspaces, schedulePush])

  // ── Send ──────────────────────────────────────────────────────────────────

  const send = async () => {
    const text = input.trim()
    if (!text || streaming || !settings.openaiApiKey) return

    const userChatMsg: ChatMessage = { id: uuid(), role: 'user', content: text }
    const assistantId = uuid()

    const userDisplay: DisplayMessage = { id: userChatMsg.id, role: 'user', content: text, toolEvents: [] }
    const assistantDisplay: DisplayMessage = { id: assistantId, role: 'assistant', content: '', toolEvents: [] }

    setMessages(prev => [...prev, userDisplay, assistantDisplay])
    setChatHistory(prev => [...prev, userChatMsg])
    setInput('')
    setStreaming(true)

    try {
      const history = [...chatHistory, userChatMsg]
      const tools = buildTools()

      // Inject assistant message ID so result-card tools can attach results to the right message
      const toolsWithId = tools.map(t =>
        t.name === 'search_bookmarks' || t.name === 'suggest_bookmarks'
          ? {
              ...t,
              execute: (args: Record<string, unknown>) =>
                t.execute({ ...args, message_id: assistantId }),
            }
          : t
      )

      for await (const event of streamChat(bookmarksRef.current, history, settings.openaiApiKey, toolsWithId)) {
        setMessages(prev => prev.map(m => {
          if (m.id !== assistantId) return m

          if (event.type === 'text') {
            return { ...m, content: m.content + event.text }
          }

          if (event.type === 'tool_start') {
            const label = toolLabel(event.name, event.args)
            return {
              ...m,
              toolEvents: [...m.toolEvents, { id: uuid(), name: event.name, label, status: 'running' }],
            }
          }

          if (event.type === 'tool_done') {
            const events = [...m.toolEvents]
            const idx = events.map(e => e.name).lastIndexOf(event.name)
            if (idx !== -1) {
              const hasError = event.result.startsWith('Error:')
              events[idx] = { ...events[idx], status: hasError ? 'error' : 'done' }
            }
            return { ...m, toolEvents: events }
          }

          return m
        }))
      }

      const finalContent = await new Promise<string>(resolve => {
        setMessages(prev => {
          const msg = prev.find(m => m.id === assistantId)
          resolve(msg?.content ?? '')
          return prev
        })
      })
      setChatHistory(prev => [...prev, { id: assistantId, role: 'assistant', content: finalContent }])

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      logger.error('AI chat error', msg)
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: `Error: ${msg}` }
          : m
      ))
    } finally {
      setStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (!settings.openaiApiKey) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-slate-400 dark:text-slate-500 p-8 max-w-sm">
          <Sparkles size={32} className="mx-auto mb-3 opacity-50" />
          <p className="font-medium mb-1">OpenAI API key required</p>
          <p className="text-sm">Add your key in Settings to enable AI chat</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-violet-600 dark:text-violet-400" />
          <h1 className="font-semibold text-slate-900 dark:text-white">AI Chat</h1>
          <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">
            {bookmarks.length} bookmarks · paste a URL to save it
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 dark:text-slate-500 mt-16 sm:mt-20">
            <Sparkles size={32} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium mb-2">Ask about your bookmarks or share a URL</p>
            <div className="text-xs space-y-1 max-w-xs mx-auto">
              <p className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">"Add https://react.dev to my bookmarks"</p>
              <p className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">"Search for CSS animation tools"</p>
              <p className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">"Suggest new bookmarks I'd like"</p>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            bookmarks={bookmarks}
            onAddBookmark={handleAddBookmark}
            savedIds={savedIds}
          />
        ))}

        {/* Typing indicator */}
        {streaming && messages[messages.length - 1]?.role === 'assistant' &&
          !messages[messages.length - 1]?.content &&
          messages[messages.length - 1]?.toolEvents.length === 0 && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-end gap-2 sm:gap-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask or paste a URL to bookmark…"
            rows={1}
            disabled={streaming}
            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none disabled:opacity-50"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || streaming}
            className="shrink-0 p-2.5 sm:p-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toolLabel(name: string, args: Record<string, unknown>): string {
  if (name === 'add_bookmark') {
    const url = args.url as string
    try { return `Fetching & saving ${new URL(url).hostname}…` } catch { return 'Fetching page…' }
  }
  if (name === 'search_bookmarks') {
    const q = args.query as string
    return `Searching for "${q}"…`
  }
  if (name === 'suggest_bookmarks') return 'Finding suggestions for you…'
  if (name === 'list_workspaces') return 'Checking workspaces…'
  return `Running ${name}…`
}
