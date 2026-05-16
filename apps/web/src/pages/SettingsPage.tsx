import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, XCircle, Loader2, Github, Key, Globe, ScrollText, Download, Clipboard, Trash2, HardDrive } from 'lucide-react'
import { toast } from 'sonner'
import { GitHubStorage, GDriveStorage } from '@bookmarker/shared'
import { useStore, isConfigured } from '../store'
import { useSync } from '../hooks/useSync'
import { logger } from '../logger'
import type { LogEntry } from '../logger'

interface Props {
  onboarding?: boolean
}

export default function SettingsPage({ onboarding }: Props) {
  const { settings, updateSettings, sync } = useStore()
  const { pull } = useSync()

  const [form, setForm] = useState({ ...settings })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null)
  const [initing, setIniting] = useState(false)
  const [gdriveConnecting, setGdriveConnecting] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])

  const refreshLogs = useCallback(() => setLogs(logger.getLogs()), [])
  useEffect(() => { refreshLogs() }, [])

  const update = (k: keyof typeof form, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    setTestResult(null)
  }

  const setBackend = (backend: 'github' | 'gdrive') => {
    setForm(f => ({ ...f, storageBackend: backend }))
    setTestResult(null)
  }

  const handleSave = () => {
    updateSettings(form)
    toast.success('Settings saved')
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      if (form.storageBackend === 'gdrive') {
        const storage = new GDriveStorage(form.gdriveAccessToken)
        await storage.testConnection()
      } else {
        const storage = new GitHubStorage(
          form.githubToken,
          form.githubOwner,
          form.githubRepo,
          form.githubBranch
        )
        await storage.testConnection()
      }
      setTestResult('ok')
      toast.success('Connection successful!')
    } catch (e) {
      setTestResult('error')
      toast.error(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setTesting(false)
    }
  }

  const handleInit = async () => {
    setIniting(true)
    try {
      updateSettings(form)
      const storage = new GitHubStorage(
        form.githubToken,
        form.githubOwner,
        form.githubRepo,
        form.githubBranch
      )
      const meta = await storage.initRepo()
      useStore.getState().setSync(meta)
      toast.success('Repository initialized!')
      await pull()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Init failed')
    } finally {
      setIniting(false)
    }
  }

  const handleGDriveConnect = () => {
    if (!form.gdriveClientId.trim()) {
      toast.error('Enter your Google OAuth Client ID first')
      return
    }
    setGdriveConnecting(true)

    const params = new URLSearchParams({
      client_id: form.gdriveClientId.trim(),
      redirect_uri: `${window.location.origin}/gdrive-callback.html`,
      response_type: 'token',
      scope: 'https://www.googleapis.com/auth/drive.appdata',
      prompt: 'consent',
    })

    const popup = window.open(
      `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      'gdrive-auth',
      'width=520,height=620,scrollbars=yes,resizable=yes'
    )

    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'gdrive-token') {
        const expiry = new Date(Date.now() + Number(e.data.expires_in) * 1000).toISOString()
        setForm(f => ({ ...f, gdriveAccessToken: e.data.access_token, gdriveTokenExpiry: expiry }))
        toast.success('Connected to Google Drive!')
      } else if (e.data?.type === 'gdrive-error') {
        toast.error(`Google Drive auth failed: ${e.data.error}`)
      }
      window.removeEventListener('message', handleMessage)
      popup?.close()
      setGdriveConnecting(false)
    }

    window.addEventListener('message', handleMessage)

    // Detect if popup was closed without completing auth
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed)
        window.removeEventListener('message', handleMessage)
        setGdriveConnecting(false)
      }
    }, 500)
  }

  const handleGDriveDisconnect = () => {
    setForm(f => ({ ...f, gdriveAccessToken: '', gdriveTokenExpiry: '' }))
    toast.success('Disconnected from Google Drive')
  }

  const configured = isConfigured(form)
  const gdriveConnected = !!form.gdriveAccessToken
  const gdriveExpiry = form.gdriveTokenExpiry ? new Date(form.gdriveTokenExpiry) : null
  const gdriveExpired = gdriveExpiry ? gdriveExpiry < new Date() : false

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
  const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"

  return (
    <div className={onboarding ? '' : 'p-6 max-w-2xl mx-auto'}>
      {!onboarding && (
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Configure storage and AI integration
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Storage backend toggle */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="font-medium text-slate-900 dark:text-white mb-3">Storage backend</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setBackend('github')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors
                ${form.storageBackend !== 'gdrive'
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
            >
              <Github size={15} />
              GitHub
            </button>
            <button
              onClick={() => setBackend('gdrive')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors
                ${form.storageBackend === 'gdrive'
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
            >
              <HardDrive size={15} />
              Google Drive
            </button>
          </div>
        </div>

        {/* GitHub */}
        {form.storageBackend !== 'gdrive' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Github size={16} className="text-slate-600 dark:text-slate-400" />
              <h2 className="font-medium text-slate-900 dark:text-white">GitHub Storage</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Bookmarks are stored as JSON files in a GitHub repository.{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=Bookmarker"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 dark:text-violet-400 hover:underline"
              >
                Create a token
              </a>{' '}
              with <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">repo</code> scope.
            </p>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>Personal Access Token</label>
                <input
                  type="password"
                  value={form.githubToken}
                  onChange={e => update('githubToken', e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Owner</label>
                  <input
                    value={form.githubOwner}
                    onChange={e => update('githubOwner', e.target.value)}
                    placeholder="your-username"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Repository</label>
                  <input
                    value={form.githubRepo}
                    onChange={e => update('githubRepo', e.target.value)}
                    placeholder="my-bookmarks"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Branch</label>
                <input
                  value={form.githubBranch}
                  onChange={e => update('githubBranch', e.target.value)}
                  placeholder="main"
                  className={inputCls}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleTest}
                  disabled={!form.githubToken || !form.githubOwner || !form.githubRepo || testing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                >
                  {testing ? <Loader2 size={14} className="animate-spin" /> : null}
                  Test connection
                  {testResult === 'ok' && <CheckCircle2 size={14} className="text-green-500" />}
                  {testResult === 'error' && <XCircle size={14} className="text-red-500" />}
                </button>
                {testResult === 'ok' && !sync.bookmarksSha && (
                  <button
                    onClick={handleInit}
                    disabled={initing}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-40"
                  >
                    {initing ? <Loader2 size={14} className="animate-spin" /> : null}
                    Initialize repo
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Google Drive */}
        {form.storageBackend === 'gdrive' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <HardDrive size={16} className="text-slate-600 dark:text-slate-400" />
              <h2 className="font-medium text-slate-900 dark:text-white">Google Drive</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Bookmarks are stored in your Google Drive's hidden App Data folder — invisible to you but private to this app.
              You need a{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 dark:text-violet-400 hover:underline"
              >
                Google Cloud OAuth 2.0 Client ID
              </a>{' '}
              (Web application type) with <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">drive.appdata</code> scope.
              Add <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">{window.location.origin}/gdrive-callback.html</code> as an Authorized redirect URI.
            </p>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>OAuth 2.0 Client ID</label>
                <input
                  value={form.gdriveClientId}
                  onChange={e => update('gdriveClientId', e.target.value)}
                  placeholder="xxxxxxxxxx.apps.googleusercontent.com"
                  className={inputCls}
                />
              </div>

              {gdriveConnected && !gdriveExpired ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-green-600 dark:text-green-400" />
                    <span className="text-sm text-green-700 dark:text-green-300 font-medium">Connected</span>
                    {gdriveExpiry && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        · expires {gdriveExpiry.toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleGDriveDisconnect}
                    className="text-xs text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {gdriveExpired && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                      <XCircle size={14} className="text-amber-600 dark:text-amber-400" />
                      <span className="text-xs text-amber-700 dark:text-amber-300">Token expired — reconnect to continue syncing</span>
                    </div>
                  )}
                  <button
                    onClick={handleGDriveConnect}
                    disabled={!form.gdriveClientId.trim() || gdriveConnecting}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
                  >
                    {gdriveConnecting
                      ? <><Loader2 size={15} className="animate-spin" /> Waiting for Google sign-in…</>
                      : <>
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          Sign in with Google
                        </>
                    }
                  </button>
                </div>
              )}

              {gdriveConnected && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleTest}
                    disabled={testing}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                  >
                    {testing ? <Loader2 size={14} className="animate-spin" /> : null}
                    Test connection
                    {testResult === 'ok' && <CheckCircle2 size={14} className="text-green-500" />}
                    {testResult === 'error' && <XCircle size={14} className="text-red-500" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OpenAI */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Key size={16} className="text-slate-600 dark:text-slate-400" />
            <h2 className="font-medium text-slate-900 dark:text-white">AI Integration</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">(optional)</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Enables AI-powered summaries, tags, and chat.{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 dark:text-violet-400 hover:underline"
            >
              Get a key
            </a>
          </p>
          <div>
            <label className={labelCls}>OpenAI API Key</label>
            <input
              type="password"
              value={form.openaiApiKey}
              onChange={e => update('openaiApiKey', e.target.value)}
              placeholder="sk-..."
              className={inputCls}
            />
          </div>
        </div>

        {/* Web App URL (for extension) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={16} className="text-slate-600 dark:text-slate-400" />
            <h2 className="font-medium text-slate-900 dark:text-white">Web App URL</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">(for extension)</span>
          </div>
          <div>
            <label className={labelCls}>Your GitHub Pages URL</label>
            <input
              value={form.webAppUrl}
              onChange={e => update('webAppUrl', e.target.value)}
              placeholder="https://username.github.io/bookmarker"
              className={inputCls}
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!configured}
          className="w-full py-2.5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-40"
        >
          {onboarding ? 'Save & get started' : 'Save settings'}
        </button>

        {/* Logs */}
        {!onboarding && (
          <LogsSection logs={logs} onRefresh={refreshLogs} />
        )}
      </div>
    </div>
  )
}

// ── Logs section ──────────────────────────────────────────────────────────────

function LogsSection({ logs, onRefresh }: { logs: LogEntry[]; onRefresh: () => void }) {
  const errorCount = logs.filter(e => e.level === 'error').length

  const formatLogs = () =>
    logs.map(e => {
      const line = `[${e.ts}] [${e.level.toUpperCase()}] ${e.msg}`
      return e.detail ? `${line}\n  ${e.detail.replace(/\n/g, '\n  ')}` : line
    }).join('\n')

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatLogs())
    toast.success('Logs copied to clipboard')
  }

  const handleDownload = () => {
    const blob = new Blob([formatLogs()], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bookmarker-logs-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleClear = () => {
    logger.clear()
    onRefresh()
    toast.success('Logs cleared')
  }

  const levelColor = (level: LogEntry['level']) => {
    if (level === 'error') return 'text-red-500 dark:text-red-400'
    if (level === 'warn')  return 'text-amber-500 dark:text-amber-400'
    return 'text-slate-400 dark:text-slate-500'
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ScrollText size={16} className="text-slate-600 dark:text-slate-400" />
          <h2 className="font-medium text-slate-900 dark:text-white">Logs</h2>
          {errorCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400">
              {errorCount} error{errorCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-slate-400 dark:text-slate-500">{logs.length} entries</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            disabled={!logs.length}
            title="Copy to clipboard"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <Clipboard size={14} />
          </button>
          <button
            onClick={handleDownload}
            disabled={!logs.length}
            title="Download as .txt"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <Download size={14} />
          </button>
          <button
            onClick={handleClear}
            disabled={!logs.length}
            title="Clear logs"
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">No logs yet</p>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-72 p-3 space-y-2 font-mono">
          {[...logs].reverse().map((entry, i) => (
            <div key={i} className="text-xs leading-relaxed">
              <span className="text-slate-400 dark:text-slate-600 select-none">
                {new Date(entry.ts).toLocaleTimeString()}{' '}
              </span>
              <span className={`font-semibold uppercase ${levelColor(entry.level)}`}>
                [{entry.level}]{' '}
              </span>
              <span className="text-slate-700 dark:text-slate-300">{entry.msg}</span>
              {entry.detail && (
                <pre className="mt-0.5 ml-4 text-slate-500 dark:text-slate-500 whitespace-pre-wrap break-all">
                  {entry.detail}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
