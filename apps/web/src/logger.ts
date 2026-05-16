export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  ts: string
  level: LogLevel
  msg: string
  detail?: string
}

const KEY = 'bookmarker-logs'
const MAX = 500

function load(): LogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function append(level: LogLevel, msg: string, detail?: unknown) {
  const entries = load()
  entries.push({
    ts: new Date().toISOString(),
    level,
    msg,
    detail: detail !== undefined
      ? typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)
      : undefined,
  })
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX)))
  } catch { /* storage full */ }
}

export const logger = {
  info:  (msg: string, detail?: unknown) => append('info',  msg, detail),
  warn:  (msg: string, detail?: unknown) => append('warn',  msg, detail),
  error: (msg: string, detail?: unknown) => append('error', msg, detail),
  getLogs: load,
  clear: () => localStorage.removeItem(KEY),
  errorCount: () => load().filter(e => e.level === 'error').length,
}

// Capture unhandled runtime errors automatically
if (typeof window !== 'undefined') {
  window.addEventListener('error', e => {
    append('error', e.message || 'Uncaught error', {
      source: e.filename,
      line: e.lineno,
      col: e.colno,
    })
  })
  window.addEventListener('unhandledrejection', e => {
    const reason = e.reason instanceof Error
      ? e.reason.message
      : String(e.reason)
    append('error', `Unhandled promise rejection: ${reason}`)
  })
}
