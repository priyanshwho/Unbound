import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { WorkspaceLayout } from './components/WorkspaceLayout'
import { AlertTriangle, ArrowDown, ArrowLeftRight, Check, Database, FileSpreadsheet, LoaderCircle, Plus, Trash2, Upload, X } from 'lucide-react'
import { askDataset } from '../analysis-chat/api'

type ColumnProfile = { name: string; type: string; nulls: number; distinct: number; samples: string[] }
type DatasetProfile = { id: string; name: string; rows: number; columns: ColumnProfile[]; size: number }
type ColumnRole = 'Auto' | 'Date' | 'Measure' | 'Category' | 'Identifier' | 'Ignore'
type JoinResult = { left_rows: number; right_rows: number; matched_left_rows: number; unmatched_left_rows: number; matched_keys: number; joined_rows: number; duplicate_left_keys: number; duplicate_right_keys: number }
type UploadEntry = { file?: File; name: string; size: number; status: 'queued' | 'uploading' | 'ready' | 'error'; profile?: DatasetProfile; message?: string; controller?: AbortController }

const MAX_FILES = 5
const MAX_BYTES = 50 * 1024 * 1024
const roleOptions: ColumnRole[] = ['Auto', 'Date', 'Measure', 'Category', 'Identifier', 'Ignore']

function formatSize(size: number) {
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${(size / 1024).toFixed(0)} KB`
}

function schemaRole(type: string): ColumnRole {
  if (/date|time/i.test(type)) return 'Date'
  if (/int|float|double|decimal|numeric/i.test(type)) return 'Measure'
  return 'Auto'
}

async function readApiResponse(response: Response): Promise<unknown> {
  const body = await response.text()
  if (!body.trim()) throw new Error(`The local API returned an empty response (${response.status}). Check that the backend is running.`)
  let result: unknown
  try {
    result = JSON.parse(body)
  } catch {
    throw new Error(`The local API returned an unreadable response (${response.status}). Check that the backend is running.`)
  }
  if (!response.ok) {
    const detail = typeof result === 'object' && result !== null && 'detail' in result ? result.detail : undefined
    throw new Error(typeof detail === 'string' ? detail : `The local API request failed (${response.status}).`)
  }
  return result
}

function requestError(reason: unknown, fallback: string) {
  if (reason instanceof TypeError) return 'Local API is offline. Start the FastAPI backend, then retry.'
  return reason instanceof Error ? reason.message : fallback
}

export default function Workspace({ initialChatId }: { initialChatId?: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const joinRequestId = useRef(0)
  const [entries, setEntries] = useState<UploadEntry[]>([])
  const [dragging, setDragging] = useState(false)
  const [apiOnline, setApiOnline] = useState(false)
  const [ollamaOnline, setOllamaOnline] = useState(false)
  const [persistenceAvailable, setPersistenceAvailable] = useState(false)
  const [roleMap, setRoleMap] = useState<Record<string, ColumnRole>>({})
  const [leftDatasetId, setLeftDatasetId] = useState('')
  const [rightDatasetId, setRightDatasetId] = useState('')
  const [leftColumn, setLeftColumn] = useState('')
  const [rightColumn, setRightColumn] = useState('')
  const [join, setJoin] = useState<JoinResult | null>(null)
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [notice, setNotice] = useState('')
  const previouslyOnline = useRef(false)

  const datasets = useMemo(() => entries.flatMap(entry => entry.profile ? [entry.profile] : []), [entries])
  const leftDataset = datasets.find(dataset => dataset.id === leftDatasetId)
  const rightDataset = datasets.find(dataset => dataset.id === rightDatasetId)
  const pending = entries.some(entry => entry.status === 'uploading')

  useEffect(() => {
    let active = true
    async function checkHealth() {
      try {
        const response = await fetch('/api/v1/health')
        if (!response.ok) throw new Error('Local API is offline')
        if (active) setApiOnline(true)
      } catch {
        if (active) setApiOnline(false)
      }
    }
    void checkHealth()
    const interval = window.setInterval(() => void checkHealth(), 5000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])

  useEffect(() => {
    if (!apiOnline) return
    let active = true
    async function restoreDatasets() {
      try {
        const response = await fetch('/api/v1/datasets')
        const stored = await readApiResponse(response)
        if (!Array.isArray(stored)) return
        const profiles = stored as DatasetProfile[]
        if (!active || profiles.length === 0) return
        setEntries(current => {
          const existingIds = new Set(current.flatMap(entry => entry.profile ? [entry.profile.id] : []))
          const recovered = profiles.filter(profile => !existingIds.has(profile.id)).map(profile => ({ name: profile.name, size: profile.size, status: 'ready' as const, profile }))
          return [...current, ...recovered]
        })
        setLeftDatasetId(current => current || profiles[0].id)
      } catch {
        // Keep the workspace usable while the local companion starts.
      }
    }
    void restoreDatasets()
    return () => { active = false }
  }, [apiOnline])

  useEffect(() => {
    if (!apiOnline) return
    let active = true
    async function checkPersistence() {
      try {
        const response = await fetch('/api/v1/persistence/status')
        const status = await readApiResponse(response)
        if (active && typeof status === 'object' && status !== null && 'available' in status) setPersistenceAvailable(status.available === true)
      } catch {
        if (active) setPersistenceAvailable(false)
      }
    }
    void checkPersistence()
    const interval = window.setInterval(() => void checkPersistence(), 15000)
    return () => { active = false; window.clearInterval(interval) }
  }, [apiOnline])

  useEffect(() => {
    if (!apiOnline) return
    let active = true
    async function checkOllama() {
      try {
        const response = await fetch('/api/v1/ollama/status')
        const status = await readApiResponse(response)
        if (active && typeof status === 'object' && status !== null && 'available' in status) setOllamaOnline(status.available === true)
      } catch {
        if (active) setOllamaOnline(false)
      }
    }
    void checkOllama()
    return () => { active = false }
  }, [apiOnline])

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList)
    const available = Math.max(0, MAX_FILES - entries.length)
    const selected = incoming.slice(0, available)
    const rejected = incoming.length - selected.length
    if (rejected) setNotice(`You can add ${MAX_FILES} files to one workspace. ${rejected} ${rejected === 1 ? 'file was' : 'files were'} skipped.`)
    if (!selected.length) return
    const next = selected.map(file => ({ file, name: file.name, size: file.size, status: 'queued' as const }))
    setEntries(current => [...current, ...next])
    void processFiles(next)
  }

  async function processFiles(queue: UploadEntry[]) {
    for (const entry of queue) {
      const file = entry.file
      if (!file) continue
      const validation = file.name.toLowerCase().endsWith('.csv')
        ? file.size > MAX_BYTES ? 'CSV files must be 50 MB or smaller.' : file.size === 0 ? 'This file is empty.' : ''
        : 'Choose a CSV file.'
      if (validation) {
        setEntries(current => current.map(item => item.file === entry.file ? { ...item, status: 'error', message: validation } : item))
        continue
      }
      const controller = new AbortController()
      setEntries(current => current.map(item => item.file === entry.file ? { ...item, status: 'uploading', message: undefined, controller } : item))
      try {
        const form = new FormData()
        form.append('file', file)
        const response = await fetch('/api/v1/datasets/upload', { method: 'POST', body: form, signal: controller.signal })
        const result = await readApiResponse(response)
        const profile = result as DatasetProfile
        setEntries(current => current.map(item => item.file === entry.file ? { ...item, status: 'ready', profile } : item))
        setLeftDatasetId(current => current || profile.id)
        setNotice(`${profile.name} is ready for schema review.`)
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === 'AbortError') {
          setEntries(current => current.filter(item => item.file !== entry.file))
          continue
        }
        setEntries(current => current.map(item => item.file === entry.file ? { ...item, status: 'error', message: requestError(reason, 'Upload failed.') } : item))
      }
    }
  }

  useEffect(() => {
    const justConnected = apiOnline && !previouslyOnline.current
    previouslyOnline.current = apiOnline
    if (!justConnected) return
    const interrupted = entries.filter(entry => entry.status === 'error' && /Unexpected end of JSON input|Local API is offline|local API returned an empty response/i.test(entry.message ?? ''))
    if (interrupted.length) void processFiles(interrupted)
  }, [apiOnline, entries])

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files)
    event.target.value = ''
  }

  function cancelUpload(entry: UploadEntry) {
    entry.controller?.abort()
    setEntries(current => current.filter(item => item !== entry))
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    addFiles(event.dataTransfer.files)
  }

  async function removeDataset(datasetId: string) {
    joinRequestId.current += 1
    setJoinBusy(false)
    setJoin(null)
    let response: Response
    try {
      response = await fetch(`/api/v1/datasets/${datasetId}`, { method: 'DELETE' })
    } catch {
      setNotice('Could not remove this file from local storage. Try again.')
      return
    }
    if (!response.ok) {
      setNotice('Could not remove this file from local storage. Try again.')
      return
    }
    const removed = datasets.find(dataset => dataset.id === datasetId)
    setEntries(current => current.filter(entry => entry.profile?.id !== datasetId))
    setRoleMap(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${datasetId}:`))))
    if (leftDatasetId === datasetId) setLeftDatasetId(datasets.find(dataset => dataset.id !== datasetId)?.id ?? '')
    if (rightDatasetId === datasetId) setRightDatasetId(datasets.find(dataset => dataset.id !== datasetId)?.id ?? '')
    setJoin(null)
    setNotice(`${removed?.name ?? 'File'} was removed from this workspace and local storage.`)
  }

  async function previewJoin() {
    if (!leftDataset || !rightDataset || !leftColumn || !rightColumn) return
    const requestId = ++joinRequestId.current
    setJoinBusy(true)
    setJoinError('')
    setJoin(null)
    try {
      const response = await fetch('/api/v1/datasets/join-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ left_dataset_id: leftDataset.id, left_column: leftColumn, right_dataset_id: rightDataset.id, right_column: rightColumn }),
      })
      const result = await readApiResponse(response)
      if (requestId === joinRequestId.current) setJoin(result as JoinResult)
    } catch (reason) {
      if (requestId === joinRequestId.current) setJoinError(requestError(reason, 'The join preview could not be calculated.'))
    } finally {
      if (requestId === joinRequestId.current) setJoinBusy(false)
    }
  }

  function updateDataset(nextId: string, side: 'left' | 'right') {
    joinRequestId.current += 1
    setJoinBusy(false)
    if (side === 'left') {
      setLeftDatasetId(nextId)
      setLeftColumn('')
      if (rightDatasetId === nextId) {
        setRightDatasetId('')
        setRightColumn('')
      }
    } else {
      setRightDatasetId(nextId)
      setRightColumn('')
    }
    setJoin(null)
    setJoinError('')
  }

  const matchRate = join && join.left_rows ? (join.matched_left_rows / join.left_rows) * 100 : 0
  const hasMultiplication = Boolean(join && join.joined_rows > join.matched_left_rows)

  async function askQuestion(question: string, datasetId: string) {
    return askDataset(datasetId, question)
  }

  return <WorkspaceLayout initialChatId={initialChatId} apiOnline={apiOnline} ollamaOnline={apiOnline && ollamaOnline} persistenceAvailable={apiOnline && persistenceAvailable} datasets={datasets} selectedDatasetId={datasets[0]?.id ?? ''} onAskQuestion={askQuestion}>
      <main className="min-w-0 px-5 py-8 md:px-10 md:py-11">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="font-mono text-[10px] tracking-[1.2px] text-muted">LOCAL WORKSPACE / NEW CHAT</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-1.3px] md:text-4xl">Start with your data.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-text-soft">Bring up to five CSV files together. Review their columns, then check how a proposed join changes the row count.</p></div>
            <span className="rounded-full border border-line-strong bg-surface-1 px-3 py-1.5 font-mono text-[10px] text-text-soft">{datasets.length} / {MAX_FILES} datasets</span>
          </div>

          <section id="datasets" className="mt-8 scroll-mt-24">
            <div className={`motion-state rounded-xl border bg-surface-1 p-5 md:p-7 ${dragging ? 'border-[#658272] bg-accent-soft' : 'border-dashed border-line-strong'}`} onDragEnter={event => { event.preventDefault(); setDragging(true) }} onDragOver={event => event.preventDefault()} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }} onDrop={onDrop}>
              <div className="flex flex-col items-center py-5 text-center">
                <span className="grid size-12 place-items-center rounded-xl bg-accent-soft text-accent"><Upload size={20}/></span>
                <h2 className="mt-4 font-display text-lg font-bold">{dragging ? 'Drop your CSV files' : datasets.length ? 'Add another CSV file' : 'Drop CSV files here'}</h2>
                <p className="mt-1 max-w-lg text-xs leading-5 text-text-soft">Choose up to five files. Each file can be up to 50 MB. Files are uploaded to the local API on this computer.</p>
                <button type="button" onClick={() => inputRef.current?.click()} disabled={datasets.length >= MAX_FILES || pending} className="motion-state mt-5 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-xs font-semibold text-white hover:bg-accent-soft active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={14}/>Choose CSV files</button>
                <input ref={inputRef} hidden type="file" accept=".csv,text/csv" multiple onChange={onInputChange}/>
                <p className="mt-3 text-[10px] text-muted">CSV only · maximum 5 files · local storage</p>
              </div>
            </div>

            {notice && <div role="status" className="mt-3 flex items-start justify-between gap-4 rounded-md border border-line bg-accent-soft px-4 py-3 text-[11px] leading-5 text-accent"><span className="flex items-start gap-2"><Check size={14} className="mt-0.5 shrink-0"/>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice('')} className="shrink-0 rounded p-0.5 hover:bg-surface-1"><X size={14}/></button></div>}

            {entries.length > 0 && <div className="mt-5 space-y-2" aria-live="polite">
              {entries.map((entry, index) => <article key={`${entry.profile?.id ?? entry.name}-${index}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-1 p-3.5">
                <span className={`grid size-9 shrink-0 place-items-center rounded-md ${entry.status === 'error' ? 'bg-amber-400/10 text-clay' : 'bg-accent-soft text-accent'}`}>{entry.status === 'uploading' ? <LoaderCircle size={17} className="animate-spin"/> : entry.status === 'error' ? <AlertTriangle size={16}/> : <FileSpreadsheet size={17}/>}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{entry.name}</p><p className="mt-0.5 text-[10px] text-muted">{formatSize(entry.size)}{entry.profile ? ` · ${entry.profile.rows.toLocaleString()} rows · ${entry.profile.columns.length} columns` : ''}{entry.status === 'uploading' ? ' · Profiling file…' : ''}</p>{entry.message && <p role="alert" className="mt-1 text-[10px] text-amber-400">{entry.message}</p>}</div>
                {entry.status === 'ready' && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[9px] font-semibold text-accent">Ready</span>}
                {entry.status === 'queued' && <span className="text-[9px] text-muted">Queued</span>}
                {entry.status === 'uploading' && <button type="button" onClick={() => cancelUpload(entry)} className="motion-state rounded-md px-2 py-1 text-[10px] font-semibold text-muted hover:bg-amber-400/10 hover:text-amber-400">Cancel</button>}
                {entry.status === 'error' && entry.file && <button type="button" onClick={() => { setEntries(current => current.map(item => item === entry ? { ...item, status: 'queued', message: undefined } : item)); void processFiles([{ file: entry.file, name: entry.name, size: entry.size, status: 'queued' }]) }} className="motion-state text-[10px] font-semibold text-accent">Retry</button>}
                {(entry.profile || entry.status === 'error') && <button type="button" onClick={() => entry.profile ? void removeDataset(entry.profile.id) : setEntries(current => current.filter(item => item !== entry))} aria-label={`Remove ${entry.name}`} className="motion-state grid size-8 place-items-center rounded-md text-muted hover:bg-amber-400/10 hover:text-amber-400"><Trash2 size={15}/></button>}
              </article>)}
            </div>}
          </section>

          {datasets.map(dataset => <section id={`dataset-${dataset.id}`} key={dataset.id} className="mt-7 scroll-mt-24 overflow-hidden rounded-xl border border-line bg-surface-1">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 md:px-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-md bg-accent-soft text-accent"><FileSpreadsheet size={17}/></span><div><h2 className="text-sm font-bold">{dataset.name}</h2><p className="mt-0.5 text-[10px] text-muted">{dataset.rows.toLocaleString()} rows · {dataset.columns.length} columns · {formatSize(dataset.size)}</p></div></div><span className="flex items-center gap-1.5 text-[10px] text-accent"><Check size={13}/>Schema profiled</span></div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 md:px-5"><div><p className="font-mono text-[9px] tracking-[1px] text-muted">SCHEMA REVIEW</p><p className="mt-1 text-[10px] leading-5 text-text-soft">Set a role for each column. Changes apply to this workspace only.</p></div><span className="text-[10px] text-muted">{dataset.columns.length} fields detected</span></div>
            <div className="mt-3 overflow-x-auto px-4 pb-4 md:px-5"><table className="w-full min-w-[740px] text-left text-[10px]"><thead className="bg-surface-2 font-mono text-[9px] text-text-soft"><tr>{['Column', 'Detected type', 'Role', 'Missing', 'Distinct', 'Sample values'].map(label => <th className="px-3 py-2.5 font-normal" key={label}>{label}</th>)}</tr></thead><tbody>{dataset.columns.map(column => {const key = `${dataset.id}:${column.name}`;const role = roleMap[key] ?? schemaRole(column.type);return <tr className="border-t border-line" key={column.name}><td className="px-3 py-3 font-semibold text-text">{column.name}</td><td className="px-3 py-3 font-mono text-[9px] text-muted">{column.type}</td><td className="px-3 py-2"><select aria-label={`Role for ${column.name}`} value={role} onChange={event => setRoleMap(current => ({ ...current, [key]: event.target.value as ColumnRole }))} className="rounded-md border border-line-strong bg-surface-1 px-2 py-1.5 text-[10px] focus-visible:outline-2 focus-visible:outline-accent">{roleOptions.map(option => <option key={option}>{option}</option>)}</select></td><td className="px-3 py-3 tabular-nums">{column.nulls.toLocaleString()}</td><td className="px-3 py-3 tabular-nums">{column.distinct.toLocaleString()}</td><td className="max-w-[220px] truncate px-3 py-3 text-text-soft">{column.samples.join(', ') || 'No nonempty values'}</td></tr>})}</tbody></table></div>
          </section>)}

          {datasets.length >= 2 && <section className="mt-7 rounded-xl border border-line bg-surface-1 p-5 md:p-6">
            <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-amber-400/10 text-amber-400"><ArrowLeftRight size={17}/></span><div><p className="font-mono text-[9px] tracking-[1px] text-muted">RELATIONSHIP CHECK</p><h2 className="mt-1 font-display text-lg font-bold">Preview a join</h2><p className="mt-1 max-w-2xl text-[11px] leading-5 text-text-soft">Compare keys before combining files. The preview shows match coverage and warns when repeated keys would multiply rows.</p></div></div>
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr]"><div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2"><label className="text-[10px] font-semibold">First file<select value={leftDatasetId} onChange={event => updateDataset(event.target.value, 'left')} disabled={joinBusy} className="form-field mt-1.5 disabled:opacity-50" aria-label="First dataset">{datasets.map(dataset => <option value={dataset.id} key={dataset.id}>{dataset.name}</option>)}</select></label><label className="text-[10px] font-semibold">Join column<select value={leftColumn} onChange={event => { joinRequestId.current += 1; setJoinBusy(false); setLeftColumn(event.target.value); setJoin(null) }} disabled={joinBusy} className="form-field mt-1.5 disabled:opacity-50" aria-label="First join column"><option value="">Choose a column</option>{leftDataset?.columns.map(column => <option key={column.name} value={column.name}>{column.name} · {column.type}</option>)}</select></label></div><span className="hidden self-center text-muted md:grid"><ArrowLeftRight size={16}/></span><div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2"><label className="text-[10px] font-semibold">Second file<select value={rightDatasetId} onChange={event => updateDataset(event.target.value, 'right')} disabled={joinBusy} className="form-field mt-1.5 disabled:opacity-50" aria-label="Second dataset"><option value="">Choose a different file</option>{datasets.filter(dataset => dataset.id !== leftDatasetId).map(dataset => <option value={dataset.id} key={dataset.id}>{dataset.name}</option>)}</select></label><label className="text-[10px] font-semibold">Join column<select value={rightColumn} onChange={event => { joinRequestId.current += 1; setJoinBusy(false); setRightColumn(event.target.value); setJoin(null) }} disabled={!rightDataset || joinBusy} className="form-field mt-1.5 disabled:opacity-50" aria-label="Second join column"><option value="">Choose a column</option>{rightDataset?.columns.map(column => <option key={column.name} value={column.name}>{column.name} · {column.type}</option>)}</select></label></div></div>
            <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void previewJoin()} disabled={!leftDataset || !rightDataset || !leftColumn || !rightColumn || joinBusy} className="motion-state inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-[11px] font-semibold text-white hover:bg-accent-soft active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50">{joinBusy ? <LoaderCircle size={14} className="animate-spin"/> : <ArrowDown size={14}/>} {joinBusy ? 'Calculating preview' : 'Calculate join preview'}</button><span className="text-[10px] text-muted">Exact text match · no rows are combined or changed</span></div>
            {joinError && <p role="alert" className="mt-4 rounded-md border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[11px] text-amber-300">{joinError}</p>}
            {join && <div className="mt-5 rounded-lg border border-line bg-surface-2 p-4 md:p-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Left rows matched" value={`${join.matched_left_rows.toLocaleString()} / ${join.left_rows.toLocaleString()}`} detail={`${matchRate.toFixed(1)}% match rate`}/><Metric label="Left rows unmatched" value={join.unmatched_left_rows.toLocaleString()} detail="These rows would have no partner"/><Metric label="Distinct matched keys" value={join.matched_keys.toLocaleString()} detail="After ignoring empty values"/><Metric label="Rows after join" value={join.joined_rows.toLocaleString()} detail={`Right file has ${join.right_rows.toLocaleString()} rows`}/></div>{hasMultiplication && <p role="status" className="mt-4 flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-[10px] leading-5 text-amber-200"><AlertTriangle size={14} className="mt-0.5 shrink-0"/><span><b>Repeated keys will multiply rows.</b> {join.duplicate_left_keys.toLocaleString()} left keys and {join.duplicate_right_keys.toLocaleString()} right keys repeat. The joined row count includes every matching combination.</span></p>}{!hasMultiplication && <p className="mt-4 flex items-center gap-2 text-[10px] text-accent"><Check size={14}/>This join does not increase the number of matched left rows.</p>}</div>}
          </section>}

          {datasets.length === 1 && <div className="mt-5 rounded-lg border border-line bg-surface-2 p-4 text-[11px] leading-5 text-muted">Add one more CSV to compare possible relationships between files.</div>}
          {datasets.length > 0 && <p className="mt-5 flex items-center gap-2 text-[10px] text-text-soft"><Database size={13} className="text-accent"/>Schema roles stay in this browser session. Dataset files remain in local storage until you remove them.</p>}
        </div>
      </main>
  </WorkspaceLayout>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-md border border-line bg-surface-1 p-3"><p className="font-mono text-[9px] tracking-[.4px] text-muted">{label.toUpperCase()}</p><p className="mt-2 font-display text-xl font-bold tabular-nums">{value}</p><p className="mt-1 text-[9px] text-muted">{detail}</p></div>
}
