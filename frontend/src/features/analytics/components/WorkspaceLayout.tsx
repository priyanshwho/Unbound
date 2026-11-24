import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Database, FileText, LayoutDashboard, Menu, MessageSquareText, Plus, Sparkles, X } from 'lucide-react'
import { BrandMark } from '../../../components/ui/BrandMark'
import type { AnalysisContextTurn, AnalysisResponse, GeneratedDashboard } from '../../analysis-chat/types'
import { listDashboards, saveDashboard } from '../dashboard-types'

const DashboardChart = lazy(() => import('./DashboardChart').then(module => ({ default: module.DashboardChart })))

type DatasetLink = { id: string; name: string }

type WorkspaceLayoutProps = {
  initialChatId?: string
  apiOnline: boolean
  ollamaOnline: boolean
  persistenceAvailable: boolean
  datasets: DatasetLink[]
  selectedDatasetId: string
  onSelectDataset: (datasetId: string) => void
  onAskQuestion: (question: string, datasetId: string, context: AnalysisContextTurn[]) => Promise<AnalysisResponse>
  onGenerateDashboard: (datasetId: string) => Promise<GeneratedDashboard>
  children: ReactNode
}

type ChatTurn = { question: string; result: AnalysisResponse }
type ChatSummary = { id: string; title: string; lastQuestion?: string; lastResult?: AnalysisResponse; turns?: ChatTurn[] }
type DashboardLink = { id: string; title: string }
const CHAT_STORAGE_KEY = 'unbound-recent-chats'

function getSavedChats(): ChatSummary[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is ChatSummary => typeof item?.id === 'string' && typeof item?.title === 'string') : []
  } catch {
    return []
  }
}

export function WorkspaceLayout({ initialChatId, apiOnline, ollamaOnline, persistenceAvailable, datasets, selectedDatasetId, onSelectDataset, onAskQuestion, onGenerateDashboard, children }: WorkspaceLayoutProps) {
  const navigate = useNavigate()
  const [leftOpen, setLeftOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [dataManagerOpen, setDataManagerOpen] = useState(false)
  const [mode, setMode] = useState<'ask' | 'edit'>('ask')
  const [chats, setChats] = useState<ChatSummary[]>(getSavedChats)
  const [dashboards, setDashboards] = useState<DashboardLink[]>(() => listDashboards().map(({ id, title }) => ({ id, title })))
  const [activeChatId, setActiveChatId] = useState(chats[0]?.id ?? '')
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<ChatTurn[]>(chats[0]?.turns ?? (chats[0]?.lastQuestion && chats[0]?.lastResult ? [{ question: chats[0].lastQuestion, result: chats[0].lastResult }] : []))
  const [askError, setAskError] = useState('')
  const [asking, setAsking] = useState(false)
  const [buildingDashboard, setBuildingDashboard] = useState(false)
  const [feedScrollNode, setFeedScrollNode] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!persistenceAvailable) return
    let active = true
    void fetch('/api/v1/conversations').then(response => response.ok ? response.json() : []).then((remote: unknown) => {
      if (!active) return
      if (!Array.isArray(remote)) return
      setChats(current => {
        const known = new Set(current.map(chat => chat.id))
        const restored = remote.filter((item): item is { id: string; title: string } => typeof item?.id === 'string' && typeof item?.title === 'string' && !known.has(item.id)).map(item => ({ id: item.id, title: item.title }))
        const next = [...restored, ...current]
        try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next)) } catch { /* In-memory history still works. */ }
        return next
      })
    }).catch(() => { /* Keep local chat history available when Neon is offline. */ })
    return () => { active = false }
  }, [persistenceAvailable])

  useEffect(() => {
    if (!persistenceAvailable) return
    let active = true
    void fetch('/api/v1/dashboards').then(response => response.ok ? response.json() : []).then((remote: unknown) => {
      if (!active || !Array.isArray(remote)) return
      setDashboards(current => {
        const merged = new Map(current.map(dashboard => [dashboard.id, dashboard]))
        for (const item of remote) {
          if (typeof item?.id === 'string' && typeof item?.title === 'string') merged.set(item.id, { id: item.id, title: item.title })
        }
        return [...merged.values()]
      })
    }).catch(() => { /* Keep browser-saved dashboards available. */ })
    return () => { active = false }
  }, [persistenceAvailable])

  useEffect(() => {
    if (turns.length) feedScrollNode?.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [turns.length, feedScrollNode])

  async function createDashboard(openReport = false) {
    if (!selectedDatasetId || buildingDashboard) return
    setBuildingDashboard(true)
    setAskError('')
    try {
      const generated = await onGenerateDashboard(selectedDatasetId)
      const source = generated.charts[0] ?? generated.kpis[0]
      if (!source) throw new Error('This file does not have enough usable data to build a dashboard yet.')
      const dashboardId = crypto.randomUUID()
      const charts = generated.charts.map(result => ({ id: crypto.randomUUID(), title: result.plan.title, source: result, chartType: result.plan.chart_type }))
      saveDashboard({ version: 1, id: dashboardId, revision: 0, title: generated.title, createdAt: new Date().toISOString(), source, chartType: charts[0]?.chartType ?? source.plan.chart_type, charts, kpis: generated.kpis })
      navigate(openReport ? `/analytics/reports/${dashboardId}` : `/analytics/dashboards/${dashboardId}`)
    } catch (reason) {
      setAskError(reason instanceof Error ? reason.message : 'Could not build a dashboard from this file.')
    } finally {
      setBuildingDashboard(false)
    }
  }

  function openDataManager() {
    setLeftOpen(false)
    if (datasets.length === 0) {
      document.getElementById('datasets')?.scrollIntoView({ block: 'start' })
      return
    }
    setDataManagerOpen(true)
  }

  function createChat() {
    const chat = { id: crypto.randomUUID(), title: 'New chat' }
    const next = [chat, ...chats]
    setChats(next)
    setActiveChatId(chat.id)
    setQuestion('')
    setTurns([])
    setAskError('')
    navigate('/analytics')
    try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next)) } catch { /* Keep this chat in memory when storage is unavailable. */ }
    setLeftOpen(false)
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const prompt = question.trim()
    if (!selectedDatasetId || asking) return
    if (prompt.length < 3) {
      setAskError('Please enter a question with at least 3 characters.')
      return
    }
    setAskError('')
    setAsking(true)
    try {
      const context = turns
        .filter(turn => turn.result.dataset_id === selectedDatasetId)
        .slice(-4)
        .map(turn => ({ question: turn.question, plan: turn.result.plan }))
      const result = await onAskQuestion(prompt, selectedDatasetId, context)
      const id = activeChatId || crypto.randomUUID()
      const title = prompt.length > 46 ? `${prompt.slice(0, 43)}…` : prompt
      const previous = chats.find(chat => chat.id === id)
      const previousTurns = previous?.turns ?? (previous?.lastQuestion && previous.lastResult ? [{ question: previous.lastQuestion, result: previous.lastResult }] : [])
      const nextTurns = [...previousTurns, { question: prompt, result }]
      const nextChat: ChatSummary = { id, title: previous && previous.title !== 'New chat' ? previous.title : title, lastQuestion: prompt, lastResult: result, turns: nextTurns }
      const next = [nextChat, ...chats.filter(chat => chat.id !== id)]
      setChats(next)
      setActiveChatId(id)
      setTurns(nextTurns)
      setQuestion('')
      try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next)) } catch { /* Keep this result in memory when storage is unavailable. */ }
      if (persistenceAvailable) {
        void (async () => {
          try {
            if (!previous) {
              const created = await fetch('/api/v1/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, title: nextChat.title }) })
              if (!created.ok) return
            }
            for (const message of [
              { id: crypto.randomUUID(), role: 'user', content: prompt },
              { id: crypto.randomUUID(), role: 'assistant', content: result.answer, result },
            ]) {
              await fetch(`/api/v1/conversations/${id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) })
            }
          } catch { /* Keep the local copy when private persistence is unavailable. */ }
        })()
      }
    } catch (reason) {
      setAskError(reason instanceof Error ? reason.message : 'The question could not be answered.')
    } finally {
      setAsking(false)
    }
  }

  const openChat = useCallback(async (chat: ChatSummary) => {
    setActiveChatId(chat.id)
    setQuestion('')
    const cachedTurns = chat.turns ?? (chat.lastQuestion && chat.lastResult ? [{ question: chat.lastQuestion, result: chat.lastResult }] : [])
    setTurns(cachedTurns)
    setLeftOpen(false)
    navigate(`/analytics/chats/${chat.id}`)
    if (!persistenceAvailable || (chat.turns?.length ?? 0) > 0) return
    try {
      const response = await fetch(`/api/v1/conversations/${chat.id}`)
      if (!response.ok) return
      const detail: unknown = await response.json()
      if (typeof detail !== 'object' || detail === null || !('messages' in detail) || !Array.isArray(detail.messages)) return
      const history = detail.messages as Array<{ role?: string; content?: string; result?: unknown }>
      const restoredTurns: ChatTurn[] = []
      let pendingQuestion = ''
      for (const message of history) {
        if (message.role === 'user' && typeof message.content === 'string') pendingQuestion = message.content
        if (message.role === 'assistant' && pendingQuestion && typeof message.result === 'object' && message.result !== null && 'answer' in message.result) {
          restoredTurns.push({ question: pendingQuestion, result: message.result as AnalysisResponse })
          pendingQuestion = ''
        }
      }
      const latest = restoredTurns.at(-1)
      if (latest) {
        setTurns(restoredTurns)
        const updated = chats.map(item => item.id === chat.id ? { ...item, lastQuestion: latest.question, lastResult: latest.result, turns: restoredTurns } : item)
        setChats(updated)
        try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(updated)) } catch { /* Keep restored turns in memory. */ }
      }
    } catch {
      // Recent chat titles remain usable if Neon disconnects.
    }
  }, [chats, navigate, persistenceAvailable])

  // Route parameters select the corresponding saved conversation when opening a deep link.
  useEffect(() => {
    if (!initialChatId || activeChatId === initialChatId) return
    const chat = chats.find(item => item.id === initialChatId)
    // oxlint-disable-next-line react/set-state-in-effect
    if (chat) void openChat(chat)
  }, [initialChatId, activeChatId, chats, openChat])

  const sidebar = <>
    <button type="button" onClick={createChat} className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-accent px-3 text-left text-xs font-bold text-white shadow-lg shadow-accent/15 transition hover:bg-accent-strong"><Plus size={16}/> New chat</button>
    <div className="mt-7 flex items-center justify-between font-mono text-[9px] tracking-wider text-muted"><span>RECENT CHATS</span><span>{chats.length}</span></div>
    <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">{chats.length ? chats.map(chat => <button type="button" key={chat.id} onClick={() => void openChat(chat)} className={`w-full truncate rounded-lg px-3 py-2.5 text-left text-[11px] transition ${chat.id === activeChatId ? 'bg-accent-soft text-accent' : 'text-text-soft hover:bg-surface-2'}`}>{chat.title}</button>) : <p className="px-1 py-2 text-[11px] leading-5 text-muted">Your conversations will appear here.</p>}</div>
    <div className="mt-7 flex items-center justify-between font-mono text-[9px] tracking-wider text-muted"><span>DATASETS</span><span>{datasets.length}</span></div>
    <div className="mt-2 space-y-1">{datasets.map(dataset => <button type="button" key={dataset.id} onClick={() => { onSelectDataset(dataset.id); setLeftOpen(false) }} aria-pressed={selectedDatasetId === dataset.id} className={`flex min-h-9 w-full items-center gap-2 truncate rounded-lg px-3 text-left text-[10px] ${selectedDatasetId === dataset.id ? 'bg-accent-soft text-accent' : 'text-text-soft hover:bg-surface-2'}`}><Database size={13} className="shrink-0 text-accent"/><span className="truncate">{dataset.name}</span></button>)}</div>
    <button type="button" onClick={openDataManager} className="mt-2 flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-[10px] font-semibold text-accent hover:bg-accent-soft"><Plus size={13}/>Upload or review files</button>
    <div className="mt-7 flex items-center justify-between font-mono text-[9px] tracking-wider text-muted"><span>DASHBOARDS</span><span>{dashboards.length}</span></div>
    <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">{dashboards.length ? dashboards.map(dashboard => <Link key={dashboard.id} to={`/analytics/dashboards/${dashboard.id}`} onClick={() => setLeftOpen(false)} className="flex min-h-9 items-center gap-2 truncate rounded-lg px-3 text-[10px] text-text-soft hover:bg-surface-2"><LayoutDashboard size={13} className="shrink-0 text-accent"/><span className="truncate">{dashboard.title}</span></Link>) : <p className="px-1 py-2 text-[10px] leading-5 text-muted">Create a dashboard from an analysis answer.</p>}</div>
    <div className="mt-auto rounded-xl border border-line bg-surface-1 p-3"><span className="inline-flex items-center gap-2 text-[10px] text-text-soft"><i className={`size-1.5 rounded-full ${apiOnline ? 'bg-lime' : 'bg-amber-400'}`}/>{apiOnline ? 'Local service connected' : 'Local service offline'}</span><p className="mb-0 mt-2 text-[10px] leading-5 text-muted">CSV files stay on this device. Remove a dataset to delete its local copy.</p></div>
  </>

  const assistant = <>
    <div className="grid grid-cols-2 rounded-xl border border-line bg-background-deep p-1" role="tablist" aria-label="Assistant mode">
      <button type="button" role="tab" aria-selected={mode === 'ask'} onClick={() => setMode('ask')} className={`min-h-9 rounded-lg text-[10px] font-bold transition ${mode === 'ask' ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text'}`}>Ask questions</button>
      <button type="button" role="tab" aria-selected={mode === 'edit'} onClick={() => setMode('edit')} className={`min-h-9 rounded-lg text-[10px] font-bold transition ${mode === 'edit' ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text'}`}>Edit dashboard</button>
    </div>
    {mode === 'ask' ? <>
      <label className="mt-4 grid gap-1.5 text-[9px] font-semibold text-text-soft">Ask about this CSV<select value={selectedDatasetId} onChange={event => { onSelectDataset(event.target.value); setAskError('') }} disabled={!datasets.length} className="form-field min-h-10"><option value="">Choose a CSV file</option>{datasets.map(dataset => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}</select></label>
      <p className="mt-1 text-[9px] leading-4 text-muted">Each question uses one CSV. Choose the file that contains the fields you want to analyze.</p>
      <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {!turns.length && !asking && <div className="rounded-xl border border-line bg-background-deep p-4"><span className="inline-flex items-center gap-2 text-[10px] font-semibold text-text-soft"><Sparkles size={14} className="text-accent"/>{selectedDatasetId ? 'Ready to analyze' : 'Waiting for a dataset'}</span><p className="mb-0 mt-2 text-[11px] leading-5 text-muted">{selectedDatasetId ? 'Ask a question. The answer will appear here and its chart will be added to the center.' : 'Upload a CSV, then ask a question about its columns.'}</p></div>}
        {turns.map((turn, index) => <div key={`${turn.result.dataset_id}-${index}`} className="space-y-2.5"><p className="ml-auto max-w-[94%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2.5 text-[10px] leading-5 text-white">{turn.question}</p><article className="rounded-2xl rounded-tl-sm border border-line bg-surface-1 p-3"><p className="mb-0 whitespace-pre-wrap text-[10px] leading-5 text-text-soft">{turn.result.answer}</p>{turn.result.quality_issues?.length > 0 && <ul className="mb-0 mt-2 space-y-1">{turn.result.quality_issues.slice(0, 3).map((issue, issueIndex) => <li key={`${issue.kind}-${issue.column}-${issueIndex}`} className="flex gap-1.5 text-[9px] leading-4 text-amber-300"><span aria-hidden="true">⚠</span><span>{issue.message}</span></li>)}</ul>}</article></div>)}
        {asking && <div className="space-y-2.5"><p className="ml-auto max-w-[94%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2.5 text-[10px] leading-5 text-white">{question.trim()}</p><p className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface-1 px-3.5 py-2.5 text-[10px] text-text-soft"><span className="size-1.5 animate-pulse rounded-full bg-accent"/>Checking your data…</p></div>}
        {askError && <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[10px] leading-5 text-amber-200" role="alert">{askError}</p>}
      </div>
      <form onSubmit={submitQuestion} className="mt-4 rounded-xl border border-line-strong bg-surface-1 p-2.5">
        <label className="sr-only" htmlFor="data-question">Ask a question about this data</label>
        <textarea id="data-question" value={question} onChange={event => { setQuestion(event.target.value); setAskError('') }} rows={3} maxLength={1000} minLength={3} placeholder={selectedDatasetId ? 'Ask a question about your data…' : 'Upload a CSV to ask a question'} disabled={!selectedDatasetId || !apiOnline || !ollamaOnline || asking} className="w-full resize-y bg-transparent px-1.5 py-1 text-[11px] leading-5 text-text outline-none placeholder:text-muted disabled:cursor-not-allowed"/>
        <div className="flex items-center justify-between border-t border-line pt-2"><span className="text-[9px] text-muted">{ollamaOnline ? 'Ollama · DuckDB' : 'Connect Ollama to ask'}</span><button type="submit" disabled={!selectedDatasetId || !apiOnline || !ollamaOnline || question.trim().length < 3 || asking} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-accent px-3 text-[10px] font-bold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50">{asking ? 'Thinking…' : 'Ask'} <Sparkles size={13}/></button></div>
      </form>
    </> : <div className="mt-5 min-h-0 flex-1 overflow-y-auto"><div className="rounded-xl border border-line bg-background-deep p-4"><span className="inline-flex items-center gap-2 text-[10px] font-semibold text-text-soft"><LayoutDashboard size={14} className="text-accent"/>Dashboard editing</span><p className="mb-0 mt-2 text-[11px] leading-5 text-muted">Open a saved dashboard to preview chart and metric edits with your local model.</p></div><div className="mt-4 space-y-1">{dashboards.length ? dashboards.map(dashboard => <Link key={dashboard.id} to={`/analytics/dashboards/${dashboard.id}`} onClick={() => setAssistantOpen(false)} className="block truncate rounded-lg px-3 py-2.5 text-[10px] text-text-soft hover:bg-surface-2">{dashboard.title}</Link>) : <p className="px-1 py-2 text-[10px] leading-5 text-muted">No saved dashboards yet.</p>}</div></div>}
    <div className="mt-3 rounded-xl border border-line bg-surface-1 p-3"><p className="mb-0 text-[9px] font-mono tracking-wider text-muted">{mode === 'ask' ? 'TRY ASKING' : 'SUPPORTED EDITS'}</p><p className="mb-0 mt-2 text-[10px] leading-5 text-text-soft">{mode === 'ask' ? selectedDatasetId && datasets.find(dataset => dataset.id === selectedDatasetId)?.name.toLowerCase().includes('sales') ? 'Which product had the highest sales last month?' : 'Which category has the highest value in this file?' : 'Replace a chart, change a metric, or add a filter.'}</p></div>
  </>

  const selectedDataset = datasets.find(dataset => dataset.id === selectedDatasetId)
  const analysisCanvas = datasets.length === 0 ? children : <main className="min-w-0 px-4 py-6 sm:px-6 md:px-8 md:py-8">
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[9px] tracking-[1.2px] text-accent">ANALYSIS / {selectedDataset?.name ?? 'SELECT A FILE'}</p><h1 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">Your analysis</h1><p className="mt-1 text-[11px] leading-5 text-text-soft">Each answer stays with its chart and supporting calculation.</p></div><button type="button" onClick={openDataManager} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line-strong px-3 text-[10px] font-semibold text-text-soft hover:border-accent hover:text-accent"><Database size={13}/>Manage files</button></div>
      {!turns.length && !asking && <section className="grid min-h-[42svh] place-items-center rounded-2xl border border-dashed border-line-strong bg-surface-1/50 p-6 text-center"><div className="max-w-sm"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent"><Sparkles size={20}/></span><h2 className="mt-4 font-display text-lg font-bold">Ask your first question</h2><p className="mb-0 mt-2 text-xs leading-6 text-text-soft">Your answer will show in the chat panel. Its chart and explanation will appear here, ready for your next question.</p><button type="button" onClick={() => setAssistantOpen(true)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-[10px] font-bold text-white xl:hidden">Open chat <MessageSquareText size={13}/></button></div></section>}
      <div className="space-y-5">{asking && <article className="rounded-2xl border border-line bg-surface-1 p-5"><div className="h-4 w-40 animate-pulse rounded bg-surface-2"/><div className="mt-5 h-56 animate-pulse rounded-xl bg-surface-2"/><p className="mb-0 mt-4 text-[10px] text-muted">Calculating from {selectedDataset?.name ?? 'the selected CSV'}…</p></article>}{turns.slice().reverse().map((turn, index) => {const result = turn.result;const value = result.rows[0]?.value;return <article key={`${result.dataset_id}-${turn.question}-${index}`} className="scroll-mt-20 overflow-hidden rounded-2xl border border-line bg-surface-1"><header className="border-b border-line px-4 py-4 md:px-6"><p className="mb-1 font-mono text-[9px] tracking-widest text-accent">QUESTION {turns.length - index} · {datasets.find(dataset => dataset.id === result.dataset_id)?.name ?? 'CSV DATA'}</p><h2 className="mb-0 font-display text-base font-bold md:text-lg">{result.plan.title}</h2><p className="mb-0 mt-1 text-[10px] text-text-soft">{turn.question}</p></header><div className="p-3 md:p-5">{result.plan.group_by ? <Suspense fallback={<div className="grid h-72 place-items-center rounded-xl bg-background-deep text-[10px] text-muted">Drawing chart…</div>}><DashboardChart result={result} type={result.plan.chart_type}/></Suspense> : <div className="rounded-xl border border-line bg-background-deep px-5 py-6"><p className="mb-1 font-mono text-[9px] tracking-widest text-muted">{result.plan.measure ?? 'ROWS ANALYZED'}</p><p className="mb-0 font-display text-4xl font-extrabold tabular-nums">{typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value ?? '—')}</p></div>}<p className="mb-0 mt-4 text-xs leading-6 text-text-soft">{result.answer}</p>{result.quality_issues?.length > 0 && <ul className="mb-0 mt-3 space-y-1.5 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3">{result.quality_issues.map((issue, issueIndex) => <li key={`${issue.kind}-${issue.column}-${issueIndex}`} className="flex gap-2 text-[10px] leading-5 text-amber-200"><span aria-hidden="true">⚠</span><span>{issue.message} This could affect the result.</span></li>)}</ul>}<details className="mt-4 border-t border-line pt-3"><summary className="cursor-pointer text-[10px] font-semibold text-text-soft">Calculation and result rows</summary><p className="mb-2 mt-2 text-[10px] leading-5 text-muted">{result.plan.aggregation} of {result.plan.measure ?? 'rows'}{result.plan.group_by ? ` grouped by ${result.plan.group_by}` : ''}; period: {result.plan.period.replaceAll('_', ' ')}. DuckDB calculated these values from the selected CSV.</p>{result.sql && <div className="mb-3"><pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-background-deep p-3 text-[11px] text-text-soft"><code>{result.sql}</code></pre>{Boolean(result.parameters?.length) && <p className="mb-0 mt-1 break-words font-mono text-[10px] text-muted">Parameters: {JSON.stringify(result.parameters)}</p>}</div>}<div className="max-h-52 overflow-auto">{result.rows.slice(0, 25).map((row, rowIndex) => <div key={`${String(row.category ?? 'total')}-${rowIndex}`} className="flex justify-between gap-3 border-t border-line py-2 text-[10px]"><span className="truncate text-text-soft">{String(row.category ?? 'Total')}</span><b className="font-mono tabular-nums">{String(row.value ?? '—')}</b></div>)}</div></details></div></article>})}</div>
    </div>
  </main>

  return <div className="min-h-screen bg-background text-text">
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-background/90 px-4 backdrop-blur-xl md:px-6">
      <button type="button" aria-label="Open chat history" onClick={() => setLeftOpen(true)} className="grid size-10 place-items-center rounded-xl border border-line-strong bg-surface-1 text-text-soft hover:text-accent lg:hidden"><Menu size={17}/></button>
      <Link to="/" aria-label="Unbound home" className="inline-flex items-center gap-2 font-display text-sm font-extrabold tracking-tight"><BrandMark/> unbound<span className="text-accent">.</span></Link>
      <span className="hidden h-5 w-px bg-line-strong sm:block"/>
      <span className="hidden text-[10px] font-medium text-muted sm:inline">Local analytics</span>
      <div className="ml-auto flex items-center gap-2">
      <span className="mr-1 hidden items-center gap-2 text-[10px] text-muted sm:inline-flex"><i className={`size-1.5 rounded-full ${apiOnline && ollamaOnline ? 'bg-lime' : 'bg-amber-400'}`}/>{!apiOnline ? 'API offline' : ollamaOnline ? 'Ollama ready' : 'Ollama offline'}</span>
        <button type="button" onClick={() => void createDashboard()} disabled={!selectedDatasetId || !apiOnline || buildingDashboard} title="Build a dashboard from the selected CSV" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line-strong px-3 text-[10px] font-bold text-text-soft hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-45"><LayoutDashboard size={14}/>{buildingDashboard ? 'Building…' : 'Build dashboard'}</button>
        <button type="button" onClick={() => void createDashboard(true)} disabled={!selectedDatasetId || !apiOnline || buildingDashboard} title="Generate a report from the selected CSV" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3 text-[10px] font-bold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-45"><FileText size={14}/><span className="hidden sm:inline">Generate report</span></button>
        <button type="button" onClick={openDataManager} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line-strong px-3 text-[10px] font-bold text-text-soft hover:border-accent hover:text-accent"><Database size={14}/><span className="hidden sm:inline">Manage files</span></button>
        <button type="button" aria-label="Open assistant" onClick={() => setAssistantOpen(true)} className="grid size-10 place-items-center rounded-xl border border-line-strong bg-surface-1 text-accent hover:bg-accent-soft xl:hidden"><MessageSquareText size={16}/></button>
        <Link to="/" className="hidden min-h-10 items-center rounded-xl px-3 text-[10px] font-semibold text-text-soft hover:bg-surface-2 sm:inline-flex">Exit</Link>
      </div>
    </header>
    <div className="grid min-h-[calc(100svh-4rem)] lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_320px]">
      <aside className="hidden flex-col border-r border-line bg-background-deep p-4 lg:flex">{sidebar}</aside>
      <div ref={setFeedScrollNode} className="min-w-0 overflow-y-auto">{analysisCanvas}</div>
      <aside className="hidden flex-col border-l border-line bg-background-deep p-4 xl:flex">{assistant}</aside>
    </div>
    {leftOpen && <div className="fixed inset-0 z-50 bg-black/45 lg:hidden" onClick={() => setLeftOpen(false)}><aside className="flex h-full w-[min(86vw,320px)] flex-col border-r border-line bg-background-deep p-4 shadow-2xl" onClick={event => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><span className="font-display text-sm font-bold">Workspace</span><button type="button" aria-label="Close chat history" onClick={() => setLeftOpen(false)} className="grid size-10 place-items-center rounded-xl hover:bg-surface-2"><X size={17}/></button></div>{sidebar}</aside></div>}
    {assistantOpen && <div className="fixed inset-0 z-50 bg-black/45 xl:hidden" onClick={() => setAssistantOpen(false)}><aside className="ml-auto flex h-full w-[min(90vw,360px)] flex-col border-l border-line bg-background-deep p-4 shadow-2xl" onClick={event => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><span className="font-display text-sm font-bold">Unbound assistant</span><button type="button" aria-label="Close assistant" onClick={() => setAssistantOpen(false)} className="grid size-10 place-items-center rounded-xl hover:bg-surface-2"><X size={17}/></button></div>{assistant}</aside></div>}
    {dataManagerOpen && datasets.length > 0 && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" onClick={() => setDataManagerOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="dataset-manager-title" className="flex max-h-[94svh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line-strong bg-background shadow-2xl" onClick={event => event.stopPropagation()}><header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 md:px-6"><div className="min-w-0 flex-1"><h2 id="dataset-manager-title" className="mb-0 font-display text-sm font-bold">Manage CSV file</h2><p className="mb-0 mt-0.5 text-[10px] text-muted">One file at a time. Remove it from local storage before choosing another.</p></div><button type="button" aria-label="Close file manager" onClick={() => setDataManagerOpen(false)} className="grid size-9 place-items-center rounded-lg border border-line text-text-soft hover:text-accent"><X size={15}/></button></header><div className="min-h-0 overflow-y-auto">{children}</div></section></div>}
  </div>
}
