import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2, Github, Key, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { GitHubStorage } from '@bookmarker/shared'
import { useStore, isConfigured } from '../store'
import { useSync } from '../hooks/useSync'

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

  const update = (k: keyof typeof form, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
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
      const storage = new GitHubStorage(
        form.githubToken,
        form.githubOwner,
        form.githubRepo,
        form.githubBranch
      )
      await storage.testConnection()
      setTestResult('ok')
      toast.success('GitHub connection successful!')
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

  const configured = isConfigured(form)

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
  const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"

  return (
    <div className={onboarding ? '' : 'p-6 max-w-2xl mx-auto'}>
      {!onboarding && (
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Configure GitHub storage and AI integration
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* GitHub */}
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

        {/* Anthropic */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Key size={16} className="text-slate-600 dark:text-slate-400" />
            <h2 className="font-medium text-slate-900 dark:text-white">AI Integration</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">(optional)</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Enables AI-powered summaries, tags, and chat.{' '}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 dark:text-violet-400 hover:underline"
            >
              Get a key
            </a>
          </p>
          <div>
            <label className={labelCls}>Anthropic API Key</label>
            <input
              type="password"
              value={form.anthropicApiKey}
              onChange={e => update('anthropicApiKey', e.target.value)}
              placeholder="sk-ant-xxxxxxxxxxxxxxxxxxxx"
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
      </div>
    </div>
  )
}
