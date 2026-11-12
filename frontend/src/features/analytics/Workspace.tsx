import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Activity, AlertTriangle, ArrowDown, ArrowLeftRight, Check, CircleHelp, Database, FileSpreadsheet, LoaderCircle, Plus, Trash2, Upload, X } from 'lucide-react'
import { Link } from 'react-router-dom'

type ColumnProfile = { name: string; type: string; nulls: number; distinct: number; samples: string[] }
type DatasetProfile = { id: string; name: string; rows: number; columns: ColumnProfile[]; size: number }
type ColumnRole = 'Auto' | 'Date' | 'Measure' | 'Category' | 'Identifier' | 'Ignore'
type JoinResult = { left_rows: number; right_rows: number; matched_left_rows: number; unmatched_left_rows: number; matched_keys: number; joined_rows: number; duplicate_left_keys: number; duplicate_right_keys: number }
type UploadEntry = { file: File; status: 'queued' | 'uploading' | 'ready' | 'error'; profile?: DatasetProfile; message?: string }

const MAX_FILES = 5
const MAX_BYTES = 50 * 1024 * 1024
const roleOptions: ColumnRole[] = ['Auto', 'Date', 'Measure', 'Category', 'Identifier', 'Ignore']

function Brand() {
  return <Link to="/" className="flex items-center gap-2.5 font-display text-[17px] font-extrabold tracking-[-.7px] text-forest"><span className="grid size-8 place-items-center rounded-lg bg-forest text-paper"><Activity size={17}/></span>unbound</Link>
}

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

export default function Workspace() {
  const inputRef = useRef<HTMLInputElement>(null)
  const joinRequestId = useRef(0)
  const [entries, setEntries] = useState<UploadEntry[]>([])
  const [dragging, setDragging] = useState(false)
  const [apiOnline, setApiOnline] = useState(false)
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

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList)
    const available = Math.max(0, MAX_FILES - entries.length)
    const selected = incoming.slice(0, available)
    const rejected = incoming.length - selected.length
    if (rejected) setNotice(`You can add ${MAX_FILES} files to one workspace. ${rejected} ${rejected === 1 ? 'file was' : 'files were'} skipped.`)
    if (!selected.length) return
    const next = selected.map(file => ({ file, status: 'queued' as const }))
    setEntries(current => [...current, ...next])
    void processFiles(next)
  }

  async function processFiles(queue: UploadEntry[]) {
    for (const entry of queue) {
      const validation = entry.file.name.toLowerCase().endsWith('.csv')
        ? entry.file.size > MAX_BYTES ? 'CSV files must be 50 MB or smaller.' : entry.file.size === 0 ? 'This file is empty.' : ''
        : 'Choose a CSV file.'
      if (validation) {
        setEntries(current => current.map(item => item.file === entry.file ? { ...item, status: 'error', message: validation } : item))
        continue
      }
      setEntries(current => current.map(item => item.file === entry.file ? { ...item, status: 'uploading', message: undefined } : item))
      try {
        const form = new FormData()
        form.append('file', entry.file)
        const response = await fetch('/api/v1/datasets/upload', { method: 'POST', body: form })
        const result = await readApiResponse(response)
        const profile = result as DatasetProfile
        setEntries(current => current.map(item => item.file === entry.file ? { ...item, status: 'ready', profile } : item))
        setLeftDatasetId(current => current || profile.id)
        setNotice(`${profile.name} is ready for schema review.`)
      } catch (reason) {
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

  return <div className="min-h-screen bg-paper text-forest">
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#e5e6de] bg-[#fffefa]/95 px-5 backdrop-blur md:px-8">
      <Brand/>
      <div className="flex items-center gap-3 md:gap-5"><span className="flex items-center gap-2 text-[10px] text-[#68746b]"><i className={`size-2 rounded-full ${apiOnline ? 'bg-[#658272]' : 'bg-clay'}`}/>{apiOnline ? 'Local API connected' : 'Local API offline'}</span><Link to="/" className="text-[11px] text-[#68746b] hover:text-forest">Exit workspace</Link></div>
    </header>

    <div className="mx-auto grid max-w-[1440px] md:grid-cols-[248px_1fr]">
      <aside className="hidden min-h-[calc(100vh-64px)] border-r border-[#e5e6de] bg-[#f3f2ec] p-5 md:block">
        <button type="button" disabled={pending} onClick={() => { if (datasets.length) { setNotice('Chat history is not saved in this prototype. Remove each dataset before starting a fresh workspace.') } else { setJoin(null); setRoleMap({}); setNotice('New chat workspace opened. Add up to five CSV files to begin.') } }} className="motion-state flex h-10 w-full items-center justify-center gap-2 rounded-md bg-forest text-xs font-semibold text-white hover:bg-forest-soft disabled:opacity-50"><Plus size={15}/>New chat</button>
        <p className="mt-7 font-mono text-[9px] tracking-[1px] text-[#98a198]">YOUR WORKSPACE</p>
        <button type="button" onClick={() => document.getElementById('datasets')?.scrollIntoView({ behavior: 'smooth' })} className="mt-3 flex w-full items-center gap-2 rounded-md bg-[#e7e9e1] px-3 py-2.5 text-left text-[11px] font-semibold"><Database size={14} className="text-[#658272]"/>Datasets<span className="ml-auto text-[10px] text-[#819087]">{datasets.length}</span></button>
        <div className="mt-2 space-y-1">{datasets.map(dataset => <button key={dataset.id} onClick={() => document.getElementById(`dataset-${dataset.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="motion-state block w-full truncate rounded px-3 py-2 text-left text-[10px] text-[#748078] hover:bg-white">{dataset.name}</button>)}</div>
        <div className="mt-8 rounded-lg border border-[#e1e3da] bg-[#fffefa] p-3"><div className="flex items-center gap-2 text-[10px] font-semibold"><CircleHelp size={14} className="text-[#658272]"/>Local and private</div><p className="mt-2 text-[10px] leading-5 text-[#7b877e]">Files live on this device. Remove a dataset to delete its local copy.</p></div>
        <div className="mt-auto pt-6"><Link to="/product" className="text-[10px] text-[#7b877e] hover:text-forest">About Unbound</Link></div>
      </aside>

      <main className="min-w-0 px-5 py-8 md:px-10 md:py-11">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="font-mono text-[10px] tracking-[1.2px] text-[#77857b]">LOCAL WORKSPACE / NEW CHAT</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-1.3px] md:text-4xl">Start with your data.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#78827a]">Bring up to five CSV files together. Review their columns, then check how a proposed join changes the row count.</p></div>
            <span className="rounded-full border border-[#e1e3da] bg-[#fffefa] px-3 py-1.5 font-mono text-[10px] text-[#68746b]">{datasets.length} / {MAX_FILES} datasets</span>
          </div>

          <section id="datasets" className="mt-8 scroll-mt-24">
            <div className={`motion-state rounded-xl border bg-[#fffefa] p-5 md:p-7 ${dragging ? 'border-[#658272] bg-[#f0f3ee]' : 'border-dashed border-[#cbd2c9]'}`} onDragEnter={event => { event.preventDefault(); setDragging(true) }} onDragOver={event => event.preventDefault()} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }} onDrop={onDrop}>
              <div className="flex flex-col items-center py-5 text-center">
                <span className="grid size-12 place-items-center rounded-xl bg-[#e9eee8] text-[#547361]"><Upload size={20}/></span>
                <h2 className="mt-4 font-display text-lg font-bold">{dragging ? 'Drop your CSV files' : datasets.length ? 'Add another CSV file' : 'Drop CSV files here'}</h2>
                <p className="mt-1 max-w-lg text-xs leading-5 text-[#7b877e]">Choose up to five files. Each file can be up to 50 MB. Files are uploaded to the local API on this computer.</p>
                <button type="button" onClick={() => inputRef.current?.click()} disabled={datasets.length >= MAX_FILES || pending} className="motion-state mt-5 inline-flex items-center gap-2 rounded-md bg-forest px-4 py-2.5 text-xs font-semibold text-white hover:bg-forest-soft active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={14}/>Choose CSV files</button>
                <input ref={inputRef} hidden type="file" accept=".csv,text/csv" multiple onChange={onInputChange}/>
                <p className="mt-3 text-[10px] text-[#9aa39a]">CSV only · maximum 5 files · local storage</p>
              </div>
            </div>

            {notice && <div role="status" className="mt-3 flex items-start justify-between gap-4 rounded-md border border-[#dfe5dc] bg-[#f0f3ee] px-4 py-3 text-[11px] leading-5 text-[#4e6959]"><span className="flex items-start gap-2"><Check size={14} className="mt-0.5 shrink-0"/>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice('')} className="shrink-0 rounded p-0.5 hover:bg-white"><X size={14}/></button></div>}

            {entries.length > 0 && <div className="mt-5 space-y-2" aria-live="polite">
              {entries.map((entry, index) => <article key={`${entry.file.name}-${entry.file.lastModified}-${index}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-[#e5e6de] bg-[#fffefa] p-3.5">
                <span className={`grid size-9 shrink-0 place-items-center rounded-md ${entry.status === 'error' ? 'bg-[#fbf1eb] text-clay' : 'bg-[#e9eee8] text-[#547361]'}`}>{entry.status === 'uploading' ? <LoaderCircle size={17} className="animate-spin"/> : entry.status === 'error' ? <AlertTriangle size={16}/> : <FileSpreadsheet size={17}/>}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{entry.file.name}</p><p className="mt-0.5 text-[10px] text-[#8a948c]">{formatSize(entry.file.size)}{entry.profile ? ` · ${entry.profile.rows.toLocaleString()} rows · ${entry.profile.columns.length} columns` : ''}{entry.status === 'uploading' ? ' · Profiling file…' : ''}</p>{entry.message && <p role="alert" className="mt-1 text-[10px] text-[#a15e42]">{entry.message}</p>}</div>
                {entry.status === 'ready' && <span className="rounded-full bg-[#e9eee8] px-2.5 py-1 text-[9px] font-semibold text-[#557462]">Ready</span>}
                {entry.status === 'queued' && <span className="text-[9px] text-[#8a948c]">Queued</span>}
                {entry.status === 'error' && <button type="button" onClick={() => { setEntries(current => current.map(item => item === entry ? { ...item, status: 'queued', message: undefined } : item)); void processFiles([{ file: entry.file, status: 'queued' }]) }} className="motion-state text-[10px] font-semibold text-[#597262]">Retry</button>}
                {(entry.profile || entry.status === 'error') && <button type="button" onClick={() => entry.profile ? void removeDataset(entry.profile.id) : setEntries(current => current.filter(item => item !== entry))} aria-label={`Remove ${entry.file.name}`} className="motion-state grid size-8 place-items-center rounded-md text-[#89948b] hover:bg-[#fbf1eb] hover:text-[#9c5e43]"><Trash2 size={15}/></button>}
              </article>)}
            </div>}
          </section>

          {datasets.map(dataset => <section id={`dataset-${dataset.id}`} key={dataset.id} className="mt-7 scroll-mt-24 overflow-hidden rounded-xl border border-[#e2e4dc] bg-[#fffefa]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e6de] px-4 py-4 md:px-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-md bg-[#e9eee8] text-[#547361]"><FileSpreadsheet size={17}/></span><div><h2 className="text-sm font-bold">{dataset.name}</h2><p className="mt-0.5 text-[10px] text-[#7e8981]">{dataset.rows.toLocaleString()} rows · {dataset.columns.length} columns · {formatSize(dataset.size)}</p></div></div><span className="flex items-center gap-1.5 text-[10px] text-[#607767]"><Check size={13}/>Schema profiled</span></div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 md:px-5"><div><p className="font-mono text-[9px] tracking-[1px] text-[#879289]">SCHEMA REVIEW</p><p className="mt-1 text-[10px] leading-5 text-[#78827a]">Set a role for each column. Changes apply to this workspace only.</p></div><span className="text-[10px] text-[#8a948c]">{dataset.columns.length} fields detected</span></div>
            <div className="mt-3 overflow-x-auto px-4 pb-4 md:px-5"><table className="w-full min-w-[740px] text-left text-[10px]"><thead className="bg-[#f3f3ed] font-mono text-[9px] text-[#78827a]"><tr>{['Column', 'Detected type', 'Role', 'Missing', 'Distinct', 'Sample values'].map(label => <th className="px-3 py-2.5 font-normal" key={label}>{label}</th>)}</tr></thead><tbody>{dataset.columns.map(column => {const key = `${dataset.id}:${column.name}`;const role = roleMap[key] ?? schemaRole(column.type);return <tr className="border-t border-[#ecece5]" key={column.name}><td className="px-3 py-3 font-semibold text-forest">{column.name}</td><td className="px-3 py-3 font-mono text-[9px] text-[#76827a]">{column.type}</td><td className="px-3 py-2"><select aria-label={`Role for ${column.name}`} value={role} onChange={event => setRoleMap(current => ({ ...current, [key]: event.target.value as ColumnRole }))} className="rounded-md border border-[#e1e3da] bg-white px-2 py-1.5 text-[10px] focus-visible:outline-2 focus-visible:outline-clay">{roleOptions.map(option => <option key={option}>{option}</option>)}</select></td><td className="px-3 py-3 tabular-nums">{column.nulls.toLocaleString()}</td><td className="px-3 py-3 tabular-nums">{column.distinct.toLocaleString()}</td><td className="max-w-[220px] truncate px-3 py-3 text-[#78827a]">{column.samples.join(', ') || 'No nonempty values'}</td></tr>})}</tbody></table></div>
          </section>)}

          {datasets.length >= 2 && <section className="mt-7 rounded-xl border border-[#e2e4dc] bg-[#fffefa] p-5 md:p-6">
            <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#f3e5dd] text-clay"><ArrowLeftRight size={17}/></span><div><p className="font-mono text-[9px] tracking-[1px] text-[#879289]">RELATIONSHIP CHECK</p><h2 className="mt-1 font-display text-lg font-bold">Preview a join</h2><p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#78827a]">Compare keys before combining files. The preview shows match coverage and warns when repeated keys would multiply rows.</p></div></div>
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr]"><div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2"><label className="text-[10px] font-semibold">First file<select value={leftDatasetId} onChange={event => updateDataset(event.target.value, 'left')} disabled={joinBusy} className="auth-input mt-1.5 disabled:opacity-50" aria-label="First dataset">{datasets.map(dataset => <option value={dataset.id} key={dataset.id}>{dataset.name}</option>)}</select></label><label className="text-[10px] font-semibold">Join column<select value={leftColumn} onChange={event => { joinRequestId.current += 1; setJoinBusy(false); setLeftColumn(event.target.value); setJoin(null) }} disabled={joinBusy} className="auth-input mt-1.5 disabled:opacity-50" aria-label="First join column"><option value="">Choose a column</option>{leftDataset?.columns.map(column => <option key={column.name} value={column.name}>{column.name} · {column.type}</option>)}</select></label></div><span className="hidden self-center text-[#a0aaa0] md:grid"><ArrowLeftRight size={16}/></span><div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2"><label className="text-[10px] font-semibold">Second file<select value={rightDatasetId} onChange={event => updateDataset(event.target.value, 'right')} disabled={joinBusy} className="auth-input mt-1.5 disabled:opacity-50" aria-label="Second dataset"><option value="">Choose a different file</option>{datasets.filter(dataset => dataset.id !== leftDatasetId).map(dataset => <option value={dataset.id} key={dataset.id}>{dataset.name}</option>)}</select></label><label className="text-[10px] font-semibold">Join column<select value={rightColumn} onChange={event => { joinRequestId.current += 1; setJoinBusy(false); setRightColumn(event.target.value); setJoin(null) }} disabled={!rightDataset || joinBusy} className="auth-input mt-1.5 disabled:opacity-50" aria-label="Second join column"><option value="">Choose a column</option>{rightDataset?.columns.map(column => <option key={column.name} value={column.name}>{column.name} · {column.type}</option>)}</select></label></div></div>
            <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void previewJoin()} disabled={!leftDataset || !rightDataset || !leftColumn || !rightColumn || joinBusy} className="motion-state inline-flex items-center gap-2 rounded-md bg-forest px-4 py-2.5 text-[11px] font-semibold text-white hover:bg-forest-soft active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50">{joinBusy ? <LoaderCircle size={14} className="animate-spin"/> : <ArrowDown size={14}/>} {joinBusy ? 'Calculating preview' : 'Calculate join preview'}</button><span className="text-[10px] text-[#929c93]">Exact text match · no rows are combined or changed</span></div>
            {joinError && <p role="alert" className="mt-4 rounded-md border border-[#ead4c8] bg-[#fbf1eb] px-4 py-3 text-[11px] text-[#965d42]">{joinError}</p>}
            {join && <div className="mt-5 rounded-lg border border-[#e5e6de] bg-[#faf9f4] p-4 md:p-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Left rows matched" value={`${join.matched_left_rows.toLocaleString()} / ${join.left_rows.toLocaleString()}`} detail={`${matchRate.toFixed(1)}% match rate`}/><Metric label="Left rows unmatched" value={join.unmatched_left_rows.toLocaleString()} detail="These rows would have no partner"/><Metric label="Distinct matched keys" value={join.matched_keys.toLocaleString()} detail="After ignoring empty values"/><Metric label="Rows after join" value={join.joined_rows.toLocaleString()} detail={`Right file has ${join.right_rows.toLocaleString()} rows`}/></div>{hasMultiplication && <p role="status" className="mt-4 flex items-start gap-2 rounded-md border border-[#ead4c8] bg-[#fbf1eb] px-3 py-2.5 text-[10px] leading-5 text-[#754d3b]"><AlertTriangle size={14} className="mt-0.5 shrink-0"/><span><b>Repeated keys will multiply rows.</b> {join.duplicate_left_keys.toLocaleString()} left keys and {join.duplicate_right_keys.toLocaleString()} right keys repeat. The joined row count includes every matching combination.</span></p>}{!hasMultiplication && <p className="mt-4 flex items-center gap-2 text-[10px] text-[#557462]"><Check size={14}/>This join does not increase the number of matched left rows.</p>}</div>}
          </section>}

          {datasets.length === 1 && <div className="mt-5 rounded-lg border border-[#e2e4dc] bg-[#eeefe8] p-4 text-[11px] leading-5 text-[#718077]">Add one more CSV to compare possible relationships between files.</div>}
          {datasets.length > 0 && <p className="mt-5 flex items-center gap-2 text-[10px] text-[#78827a]"><Database size={13} className="text-[#658272]"/>Schema roles stay in this browser session. Dataset files remain in local storage until you remove them.</p>}
        </div>
      </main>
    </div>
  </div>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-md border border-[#e5e6de] bg-[#fffefa] p-3"><p className="font-mono text-[9px] tracking-[.4px] text-[#8a948c]">{label.toUpperCase()}</p><p className="mt-2 font-display text-xl font-bold tabular-nums">{value}</p><p className="mt-1 text-[9px] text-[#7d8980]">{detail}</p></div>
}
