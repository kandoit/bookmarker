import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, BookmarkIcon } from 'lucide-react'
import { streamChat } from '@bookmarker/shared'
import type { ChatMessage, Bookmark } from '@bookmarker/shared'
import { useStore } from '../store'
import { v4 as uuid } from 'uuid'

function BookmarkRef({ bookmark }: { bookmark: Bookmark }) {
  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-xs hover:bg-violet-100 dark:hover:bg-violet-900 transition-colors"
    >
      {bookmark.favicon && (
        <img src={bookmark.favicon} alt="" className="w-3.5 h-3.5 rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      )}
      <BookmarkIcon size={10} />
      {bookmark.title || bookmark.url}
    </a>
  )
}

function MessageBubble({ message, bookmarks }: { message: ChatMessage; bookmarks: Bookmark[] }) {
  const isUser = message.role === 'user'

  const parts = message.content.split(/\[\[BOOKMARK:([^\]]+)\]\]/)

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-violet-600 text-white rounded-tr-sm'
            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm'
        }`}
      >
        {parts.map((part, i) => {
          if (i % 2 === 0) return <span key={i}>{part}</span>
          const bookmark = bookmarks.find(b => b.id === part)
          return bookmark ? <BookmarkRef key={i} bookmark={bookmark} /> : null
        })}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { bookmarks, settings } = useStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming || !settings.anthropicApiKey) return

    const userMsg: ChatMessage = { id: uuid(), role: 'user', content: text }
    const assistantMsg: ChatMessage = { id: uuid(), role: 'assistant', content: '' }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setStreaming(true)

    try {
      const allMessages = [...messages, userMsg]
      for await (const chunk of streamChat(allMessages, bookmarks, settings.anthropicApiKey)) {
        setMessages(prev =>
          prev.map(m => m.id === assistantMsg.id ? { ...m, content: m.content + chunk } : m)
        )
      }
    } catch (e) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsg.id
            ? { ...m, content: `Error: ${e instanceof Error ? e.message : 'Something went wrong'}` }
            : m
        )
      )
    } finally {
      setStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  if (!settings.anthropicApiKey) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-slate-400 dark:text-slate-500 p-8 max-w-sm">
          <Sparkles size={32} className="mx-auto mb-3 opacity-50" />
          <p className="font-medium mb-1">Anthropic API key required</p>
          <p className="text-sm">Add your key in Settings to enable AI chat</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-violet-600 dark:text-violet-400" />
          <h1 className="font-semibold text-slate-900 dark:text-white">AI Chat</h1>
          <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">
            {bookmarks.length} bookmarks in context
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 dark:text-slate-500 mt-20">
            <Sparkles size={32} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium mb-1">Ask about your bookmarks</p>
            <p className="text-sm max-w-xs mx-auto">
              Try: "Find me something about React", "What did I save about machine learning?"
            </p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} bookmarks={bookmarks} />
        ))}
        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your bookmarks… (Enter to send)"
            rows={1}
            disabled={streaming}
            className="flex-1 px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none disabled:opacity-50"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || streaming}
            className="shrink-0 p-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
