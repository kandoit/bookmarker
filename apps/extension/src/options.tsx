import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster, toast } from 'sonner'
import { CheckCircle2, XCircle, Loader2, Github, Key, Globe } from 'lucide-react'
import { GitHubStorage } from '@bookmarker/shared'
import type { Settings } from '@bookmarker/shared'
import './options.css'

const defaultSettings: Settings = {
  githubToken: '',
  githubOwner: '',
  githubRepo: '',
  githubBranch: 'main',
  openaiApiKey: '',
  webAppUrl: '',
}

function Options() {
  const [form, setForm] = useState<Settings>(defaultSettings)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    chrome.storage.local.get('settings', r => {
      if (r.settings) setForm({ ...defaultSettings, ...r.settings })
    })
  }, [])

  const update = (k: keyof Settings, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    setTestResult(null)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const storage = new GitHubStorage(form.githubToken, form.githubOwner, form.githubRepo, form.githubBranch)
      await storage.testConnection()
      setTestResult('ok')
      toast.success('Connected!')
    } catch (e) {
      setTestResult('error')
      toast.error(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await new Promise<void>(resolve => chrome.storage.local.set({ settings: form }, resolve))
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
  const labelCls = "block text-sm font-medium text-slate-700 mb-1.5"

  return (
    <div className="max-w-xl mx-auto p-8">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">🔖</span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">AI Bookmarker</h1>
          <p className="text-sm text-slate-500">Extension Settings</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* GitHub */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Github size={16} className="text-slate-600" />
            <h2 className="font-medium text-slate-900">GitHub Storage</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Same repo as your web app.{' '}
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=Bookmarker"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline"
            >
              Create a token
            </a>{' '}
            with <code className="bg-slate-100 px-1 rounded text-xs">repo</code> scope.
          </p>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Personal Access Token</label>
              <input type="password" value={form.githubToken} onChange={e => update('githubToken', e.target.value)} placeholder="ghp_xxxxxxxxxxxx" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Owner</label>
                <input value={form.githubOwner} onChange={e => update('githubOwner', e.target.value)} placeholder="username" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Repository</label>
                <input value={form.githubRepo} onChange={e => update('githubRepo', e.target.value)} placeholder="my-bookmarks" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Branch</label>
              <input value={form.githubBranch} onChange={e => update('githubBranch', e.target.value)} placeholder="main" className={inputCls} />
            </div>
            <button
              onClick={handleTest}
              disabled={!form.githubToken || !form.githubOwner || !form.githubRepo || testing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
            >
              {testing && <Loader2 size={14} className="animate-spin" />}
              Test connection
              {testResult === 'ok' && <CheckCircle2 size={14} className="text-green-500" />}
              {testResult === 'error' && <XCircle size={14} className="text-red-500" />}
            </button>
          </div>
        </div>

        {/* OpenAI */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Key size={16} className="text-slate-600" />
            <h2 className="font-medium text-slate-900">AI Integration</h2>
            <span className="text-xs text-slate-400">(optional)</span>
          </div>
          <div>
            <label className={labelCls}>OpenAI API Key</label>
            <input type="password" value={form.openaiApiKey} onChange={e => update('openaiApiKey', e.target.value)} placeholder="sk-xxxxxxxxxxxx" className={inputCls} />
          </div>
        </div>

        {/* Web App URL */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={16} className="text-slate-600" />
            <h2 className="font-medium text-slate-900">Web App URL</h2>
          </div>
          <div>
            <label className={labelCls}>Your GitHub Pages URL</label>
            <input value={form.webAppUrl} onChange={e => update('webAppUrl', e.target.value)} placeholder="https://username.github.io/bookmarker" className={inputCls} />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-40"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save settings
        </button>
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Options /></React.StrictMode>
)
