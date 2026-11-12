import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Database, LayoutDashboard, Menu, MessageSquareText, Plus, Sparkles, X } from 'lucide-react'
import { BrandMark } from '../../../components/ui/BrandMark'
import type { AnalysisResponse } from '../../analysis-chat/types'

type DatasetLink = { id: string; name: string }

type WorkspaceLayoutProps = {
  apiOnline: boolean
  ollamaOnline: boolean
  datasets: DatasetLink[]
  selectedDatasetId: string
  onAskQuestion: (question: string, datasetId: string) => Promise<AnalysisResponse>
  children: ReactNode
}

type ChatSummary = { id: string; title: string; lastQuestion?: string; lastResult?: AnalysisResponse }
const CHAT_STORAGE_KEY = 'unbound-recent-chats'

function getSavedChats(): ChatSummary[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is ChatSummary => typeof item?.id === 'string' && typeof item?.title === 'string') : []
  } catch {
    return []
  }
}

export function WorkspaceLayout({ apiOnline, ollamaOnline, datasets, selectedDatasetId, onAskQuestion, children }: WorkspaceLayoutProps) {
  const [leftOpen, setLeftOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [mode, setMode] = useState<'ask' | 'edit'>('ask')
  const [chats, setChats] = useState<ChatSummary[]>(getSavedChats)
  const [activeChatId, setActiveChatId] = useState(chats[0]?.id ?? '')
  const [question, setQuestion] = useState(chats[0]?.lastQuestion ?? '')
  const [lastQuestion, setLastQuestion] = useState(chats[0]?.lastQuestion ?? '')
  const [answer, setAnswer] = useState<AnalysisResponse | null>(chats[0]?.lastResult ?? null)
  const [askError, setAskError] = useState('')
  const [asking, setAsking] = useState(false)

  function createChat() {
    const chat = { id: crypto.randomUUID(), title: 'New chat' }
    const next = [chat, ...chats]
    setChats(next)
    setActiveChatId(chat.id)
    setQuestion('')
    setLastQuestion('')
    setAnswer(null)
    setAskError('')
    try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next)) } catch { /* Keep this chat in memory when storage is unavailable. */ }
    setLeftOpen(false)
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const prompt = question.trim()
    if (!prompt || !selectedDatasetId || asking) return
    setAskError('')
    setAsking(true)
    try {
      const result = await onAskQuestion(prompt, selectedDatasetId)
      const id = activeChatId || crypto.randomUUID()
      const title = prompt.length > 46 ? `${prompt.slice(0, 43)}…` : prompt
      const previous = chats.find(chat => chat.id === id)
      const nextChat: ChatSummary = { id, title: previous && previous.title !== 'New chat' ? previous.title : title, lastQuestion: prompt, lastResult: result }
      const next = [nextChat, ...chats.filter(chat => chat.id !== id)]
      setChats(next)
      setActiveChatId(id)
      setAnswer(result)
      setLastQuestion(prompt)
      setQuestion('')
      try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next)) } catch { /* Keep this result in memory when storage is unavailable. */ }
    } catch (reason) {
      setAskError(reason instanceof Error ? reason.message : 'The question could not be answered.')
    } finally {
      setAsking(false)
    }
  }

  const sidebar = <>
    <button type="button" onClick={createChat} className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-accent px-3 text-left text-xs font-bold text-white shadow-lg shadow-accent/15 transition hover:bg-accent-strong"><Plus size={16}/> New chat</button>
    <div className="mt-7 flex items-center justify-between font-mono text-[9px] tracking-wider text-muted"><span>RECENT CHATS</span><span>{chats.length}</span></div>
    <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">{chats.length ? chats.map(chat => <button type="button" key={chat.id} onClick={() => { setActiveChatId(chat.id); setQuestion(''); setLastQuestion(chat.lastQuestion ?? ''); setAnswer(chat.lastResult ?? null); setLeftOpen(false) }} className={`w-full truncate rounded-lg px-3 py-2.5 text-left text-[11px] transition ${chat.id === activeChatId ? 'bg-accent-soft text-accent' : 'text-text-soft hover:bg-surface-2'}`}>{chat.title}</button>) : <p className="px-1 py-2 text-[11px] leading-5 text-muted">Your conversations will appear here.</p>}</div>
    <div className="mt-7 flex items-center justify-between font-mono text-[9px] tracking-wider text-muted"><span>DATASETS</span><span>{datasets.length}</span></div>
    <div className="mt-2 space-y-1">{datasets.map(dataset => <a key={dataset.id} href={`#dataset-${dataset.id}`} onClick={() => setLeftOpen(false)} className="flex min-h-9 items-center gap-2 truncate rounded-lg px-3 text-[10px] text-text-soft hover:bg-surface-2"><Database size={13} className="shrink-0 text-accent"/><span className="truncate">{dataset.name}</span></a>)}</div>
    <div className="mt-auto rounded-xl border border-line bg-surface-1 p-3"><span className="inline-flex items-center gap-2 text-[10px] text-text-soft"><i className={`size-1.5 rounded-full ${apiOnline ? 'bg-lime' : 'bg-amber-400'}`}/>{apiOnline ? 'Local service connected' : 'Local service offline'}</span><p className="mb-0 mt-2 text-[10px] leading-5 text-muted">CSV files stay on this device. Remove a dataset to delete its local copy.</p></div>
  </>

  const assistant = <>
    <div className="grid grid-cols-2 rounded-xl border border-line bg-background-deep p-1" role="tablist" aria-label="Assistant mode">
      <button type="button" role="tab" aria-selected={mode === 'ask'} onClick={() => setMode('ask')} className={`min-h-9 rounded-lg text-[10px] font-bold transition ${mode === 'ask' ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text'}`}>Ask questions</button>
      <button type="button" role="tab" aria-selected={mode === 'edit'} onClick={() => setMode('edit')} className={`min-h-9 rounded-lg text-[10px] font-bold transition ${mode === 'edit' ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text'}`}>Edit dashboard</button>
    </div>
    {mode === 'ask' ? <>
      <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto">
        {!selectedDatasetId && <div className="rounded-xl border border-line bg-background-deep p-4"><span className="inline-flex items-center gap-2 text-[10px] font-semibold text-text-soft"><Sparkles size={14} className="text-accent"/>Waiting for a dataset</span><p className="mb-0 mt-2 text-[11px] leading-5 text-muted">Upload a CSV, then ask a question about its columns.</p></div>}
        {answer && <article className="rounded-xl border border-accent/25 bg-accent-soft/40 p-3.5"><p className="mb-1 font-mono text-[8px] tracking-wider text-accent">YOUR QUESTION</p><p className="mb-3 text-[10px] leading-5 text-text-soft">{lastQuestion}</p><p className="mb-1 font-mono text-[8px] tracking-wider text-accent">ANSWER</p><p className="mb-3 text-[11px] leading-5 text-text">{answer.answer}</p><div className="space-y-1.5">{answer.rows.slice(0, 6).map((row, index) => <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-1/70 px-2.5 py-2 text-[10px]" key={`${String(row.category ?? 'total')}-${index}`}><span className="truncate text-text-soft">{String(row.category ?? 'Total')}</span><b className="shrink-0 font-mono">{String(row.value ?? '—')}</b></div>)}</div><details className="mt-3 border-t border-line pt-2"><summary className="cursor-pointer text-[9px] font-semibold text-text-soft">Calculation details</summary><p className="mb-0 mt-2 text-[9px] leading-4 text-muted">{answer.plan.aggregation} of {answer.plan.measure ?? 'rows'}{answer.plan.group_by ? ` grouped by ${answer.plan.group_by}` : ''}, period: {answer.plan.period.replaceAll('_', ' ')}. DuckDB calculated the result from the selected CSV.</p></details></article>}
        {askError && <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[10px] leading-5 text-amber-200" role="alert">{askError}</p>}
      </div>
      <form onSubmit={submitQuestion} className="mt-4 rounded-xl border border-line-strong bg-surface-1 p-2.5">
        <label className="sr-only" htmlFor="data-question">Ask a question about this data</label>
        <textarea id="data-question" value={question} onChange={event => setQuestion(event.target.value)} rows={3} maxLength={1000} placeholder={selectedDatasetId ? 'Ask a question about your data…' : 'Upload a CSV to ask a question'} disabled={!selectedDatasetId || !apiOnline || !ollamaOnline || asking} className="w-full resize-y bg-transparent px-1.5 py-1 text-[11px] leading-5 text-text outline-none placeholder:text-muted disabled:cursor-not-allowed"/>
        <div className="flex items-center justify-between border-t border-line pt-2"><span className="text-[9px] text-muted">{ollamaOnline ? 'Ollama · DuckDB' : 'Connect Ollama to ask'}</span><button type="submit" disabled={!selectedDatasetId || !apiOnline || !ollamaOnline || !question.trim() || asking} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-accent px-3 text-[10px] font-bold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50">{asking ? 'Thinking…' : 'Ask'} <Sparkles size={13}/></button></div>
      </form>
    </> : <div className="mt-5 rounded-xl border border-line bg-background-deep p-4"><span className="inline-flex items-center gap-2 text-[10px] font-semibold text-text-soft"><LayoutDashboard size={14} className="text-accent"/>Dashboard editing</span><p className="mb-0 mt-3 text-[11px] leading-5 text-muted">Create a dashboard first. Then ask to replace a chart, change a metric, or add a filter.</p></div>}
    <div className="mt-3 rounded-xl border border-line bg-surface-1 p-3"><p className="mb-0 text-[9px] font-mono tracking-wider text-muted">{mode === 'ask' ? 'TRY ASKING' : 'SUPPORTED EDITS'}</p><p className="mb-0 mt-2 text-[10px] leading-5 text-text-soft">{mode === 'ask' ? 'Which product had the highest sales last month?' : 'Replace a chart, change a metric, or add a filter.'}</p></div>
  </>

  return <div className="min-h-screen bg-background text-text">
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-background/90 px-4 backdrop-blur-xl md:px-6">
      <button type="button" aria-label="Open chat history" onClick={() => setLeftOpen(true)} className="grid size-10 place-items-center rounded-xl border border-line-strong bg-surface-1 text-text-soft hover:text-accent lg:hidden"><Menu size={17}/></button>
      <Link to="/" aria-label="Unbound home" className="inline-flex items-center gap-2 font-display text-sm font-extrabold tracking-tight"><BrandMark/> unbound<span className="text-accent">.</span></Link>
      <span className="hidden h-5 w-px bg-line-strong sm:block"/>
      <span className="hidden text-[10px] font-medium text-muted sm:inline">Local analytics</span>
      <div className="ml-auto flex items-center gap-2">
      <span className="mr-1 hidden items-center gap-2 text-[10px] text-muted sm:inline-flex"><i className={`size-1.5 rounded-full ${apiOnline && ollamaOnline ? 'bg-lime' : 'bg-amber-400'}`}/>{!apiOnline ? 'API offline' : ollamaOnline ? 'Ollama ready' : 'Ollama offline'}</span>
        <button type="button" disabled title="Dashboard builder is coming next" className="hidden min-h-10 items-center gap-2 rounded-xl border border-line-strong px-3 text-[10px] font-bold text-muted disabled:cursor-not-allowed sm:inline-flex"><LayoutDashboard size={14}/> Dashboard</button>
        <button type="button" aria-label="Open assistant" onClick={() => setAssistantOpen(true)} className="grid size-10 place-items-center rounded-xl border border-line-strong bg-surface-1 text-accent hover:bg-accent-soft xl:hidden"><MessageSquareText size={16}/></button>
        <Link to="/" className="hidden min-h-10 items-center rounded-xl px-3 text-[10px] font-semibold text-text-soft hover:bg-surface-2 sm:inline-flex">Exit</Link>
      </div>
    </header>
    <div className="grid min-h-[calc(100svh-4rem)] lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_320px]">
      <aside className="hidden flex-col border-r border-line bg-background-deep p-4 lg:flex">{sidebar}</aside>
      <div className="min-w-0 overflow-y-auto">{children}</div>
      <aside className="hidden flex-col border-l border-line bg-background-deep p-4 xl:flex">{assistant}</aside>
    </div>
    {leftOpen && <div className="fixed inset-0 z-50 bg-black/45 lg:hidden" onClick={() => setLeftOpen(false)}><aside className="flex h-full w-[min(86vw,320px)] flex-col border-r border-line bg-background-deep p-4 shadow-2xl" onClick={event => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><span className="font-display text-sm font-bold">Workspace</span><button type="button" aria-label="Close chat history" onClick={() => setLeftOpen(false)} className="grid size-10 place-items-center rounded-xl hover:bg-surface-2"><X size={17}/></button></div>{sidebar}</aside></div>}
    {assistantOpen && <div className="fixed inset-0 z-50 bg-black/45 xl:hidden" onClick={() => setAssistantOpen(false)}><aside className="ml-auto flex h-full w-[min(90vw,360px)] flex-col border-l border-line bg-background-deep p-4 shadow-2xl" onClick={event => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><span className="font-display text-sm font-bold">Unbound assistant</span><button type="button" aria-label="Close assistant" onClick={() => setAssistantOpen(false)} className="grid size-10 place-items-center rounded-xl hover:bg-surface-2"><X size={17}/></button></div>{assistant}</aside></div>}
  </div>
}
