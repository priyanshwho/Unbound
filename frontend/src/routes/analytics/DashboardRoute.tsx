import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Ban, BarChart3, Check, Copy, FileText, LoaderCircle, Save, Share2, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { DashboardChart } from '../../features/analytics/components/DashboardChart'
import { buildDashboardSnapshot, chartTypeLabel, readDashboard, saveDashboard, type DashboardChartDraft, type DashboardChartType, type DashboardDraft } from '../../features/analytics/dashboard-types'
import { askDataset } from '../../features/analysis-chat/api'

export function DashboardRoute() {
  const { dashboardId = '' } = useParams()
  return <DashboardEditor key={dashboardId} dashboardId={dashboardId}/>
}

function DashboardEditor({ dashboardId }: { dashboardId: string }) {
  const [dashboard, setDashboard] = useState<DashboardDraft | null>(() => readDashboard(dashboardId))
  const [saved, setSaved] = useState(false)
  const [editPrompt, setEditPrompt] = useState('')
  const [editError, setEditError] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editTarget, setEditTarget] = useState('primary-result')
  const [proposal, setProposal] = useState<{ source: DashboardDraft['source']; chartType: DashboardChartType; targetId: string } | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [visibility, setVisibility] = useState<'unlisted' | 'public'>('unlisted')
  const [expiry, setExpiry] = useState<'never' | '7d' | '30d'>('never')
  const [publishBusy, setPublishBusy] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [shareUrl, setShareUrl] = useState('')

  useEffect(() => {
    if (dashboard || !dashboardId) return
    let active = true
    void fetch(`/api/v1/dashboards/${dashboardId}`).then(response => response.ok ? response.json() : null).then((remote: unknown) => {
      if (!active || typeof remote !== 'object' || remote === null || !('spec' in remote)) return
      const remoteRecord = remote as Record<string, unknown>
      const spec = remoteRecord.spec as DashboardDraft
      if (spec?.version !== 1 || spec.id !== dashboardId || !spec.source || !Array.isArray(spec.source.rows)) return
      const restored = { ...spec, revision: typeof remoteRecord.revision === 'number' ? remoteRecord.revision : spec.revision ?? 0 }
      setDashboard(restored)
      saveDashboard(restored)
    }).catch(() => { /* Local-only drafts remain available without Neon. */ })
    return () => { active = false }
  }, [dashboard, dashboardId])

  function getCharts(draft = dashboard): DashboardChartDraft[] {
    if (!draft) return []
    return draft.charts?.length ? draft.charts : [{ id: 'primary-result', title: draft.source.plan.title, source: draft.source, chartType: draft.chartType }]
  }

  function updateChart(chartId: string, type: DashboardChartType) {
    if (!dashboard) return
    const charts = getCharts().map(chart => chart.id === chartId ? { ...chart, chartType: type } : chart)
    setDashboard({ ...dashboard, chartType: charts[0].chartType, charts })
    setSaved(false)
  }

  function addChart() {
    if (!dashboard) return
    const charts = getCharts()
    if (charts.length >= 12) return
    const available: DashboardChartType[] = ['bar', 'horizontal_bar', 'line', 'pie', 'table']
    const chartType = available.find(type => !charts.some(chart => chart.chartType === type)) ?? available[charts.length % available.length]
    setDashboard({ ...dashboard, charts: [...charts, { id: crypto.randomUUID(), title: `${dashboard.source.plan.title} · View ${charts.length + 1}`, source: dashboard.source, chartType }] })
    setSaved(false)
  }

  function removeChart(chartId: string) {
    if (!dashboard) return
    const charts = getCharts().filter(chart => chart.id !== chartId)
    if (!charts.length) return
    setDashboard({ ...dashboard, charts, chartType: charts[0].chartType })
    setSaved(false)
  }

  async function persist() {
    if (!dashboard) return
    const next = { ...dashboard, revision: dashboard.revision + 1 }
    saveDashboard(next)
    setDashboard(next)
    setSaved(true)
    try {
      const response = await fetch(`/api/v1/dashboards/${next.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: next.id, title: next.title, spec: next }),
      })
      if (response.ok) {
        const savedRevision: unknown = await response.json()
        if (typeof savedRevision === 'object' && savedRevision !== null && 'revision' in savedRevision && typeof savedRevision.revision === 'number') {
          const synced = { ...next, revision: savedRevision.revision }
          saveDashboard(synced)
          setDashboard(synced)
        }
      }
    } catch { /* The local draft is already saved. */ }
  }

  async function proposeEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dashboard || !editPrompt.trim() || editBusy) return
    setEditError('')
    setEditBusy(true)
    try {
      const source = await askDataset(dashboard.source.dataset_id, editPrompt.trim())
      const prompt = editPrompt.toLowerCase()
      const requestedType: DashboardChartType | undefined = /\b(pie|donut|doughnut)\b/.test(prompt) ? 'pie'
        : /\b(line|trend)\b/.test(prompt) ? 'line'
          : /\bhorizontal\s+bar\b/.test(prompt) ? 'horizontal_bar'
            : /\b(bar|column)\b/.test(prompt) ? 'bar'
              : /\b(table|tabular)\b/.test(prompt) ? 'table' : undefined
      setProposal({ source, chartType: requestedType ?? source.plan.chart_type, targetId: editTarget })
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : 'The dashboard edit could not be prepared.')
    } finally {
      setEditBusy(false)
    }
  }

  function applyProposal() {
    if (!dashboard || !proposal) return
    const existingCharts = getCharts()
    const nextChart: DashboardChartDraft = { id: crypto.randomUUID(), title: proposal.source.plan.title, source: proposal.source, chartType: proposal.chartType }
    const charts = proposal.targetId === '__new__'
      ? [...existingCharts, nextChart]
      : existingCharts.map(chart => chart.id === proposal.targetId ? { ...chart, title: proposal.source.plan.title, source: proposal.source, chartType: proposal.chartType } : chart)
    const updated = { ...dashboard, source: proposal.targetId === existingCharts[0]?.id ? proposal.source : dashboard.source, chartType: charts[0].chartType, charts }
    setDashboard(updated)
    saveDashboard(updated)
    setProposal(null)
    setEditPrompt('')
    setSaved(false)
  }

  async function publishDashboard() {
    if (!dashboard || publishBusy) return
    setPublishBusy(true)
    setPublishError('')
    const shareId = crypto.randomUUID()
    const expiresAt = expiry === 'never' ? null : new Date(Date.now() + (expiry === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString()
    try {
      const response = await fetch('/api/v1/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_id: shareId, dashboard_id: dashboard.id, revision: dashboard.revision, visibility, expires_at: expiresAt, snapshot: buildDashboardSnapshot(dashboard) }),
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const detail = typeof body === 'object' && body !== null && 'detail' in body && typeof body.detail === 'string' ? body.detail : 'The share could not be published. Configure the Neon persistence API, then retry.'
        throw new Error(detail)
      }
      const next = { ...dashboard, publication: { shareId, visibility } }
      setDashboard(next)
      saveDashboard(next)
      setShareUrl(`${window.location.origin}/share/${shareId}`)
      setPublishOpen(false)
    } catch (reason) {
      setPublishError(reason instanceof Error ? reason.message : 'The dashboard could not be published.')
    } finally {
      setPublishBusy(false)
    }
  }

  async function revokeShare() {
    if (!dashboard?.publication) return
    try {
      const response = await fetch(`/api/v1/publications/${dashboard.publication.shareId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('The share could not be revoked. Check the Neon API connection.')
      const next = { ...dashboard, publication: undefined }
      setDashboard(next)
      saveDashboard(next)
      setShareUrl('')
    } catch (reason) {
      setPublishError(reason instanceof Error ? reason.message : 'The share could not be revoked.')
    }
  }

  if (!dashboard) return <main className="grid min-h-screen place-items-center bg-background px-6 text-text"><section className="max-w-md text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl border border-line bg-surface-1 text-accent"><BarChart3 size={21}/></div><h1 className="mt-5 font-display text-2xl font-bold">Dashboard not found</h1><p className="mt-2 text-sm leading-6 text-text-soft">This dashboard may have been removed from this browser. Create one from an answer in Analytics.</p><Link to="/analytics" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-xs font-bold text-white"><ArrowLeft size={15}/> Return to Analytics</Link></section></main>

  const activePublication = dashboard.publication
  const qualityIssues = [...new Map(getCharts().flatMap(chart => chart.source.quality_issues ?? []).map(issue => [`${issue.kind}:${issue.column ?? ''}`, issue])).values()]
  const dashboardKpis = dashboard.kpis ?? []
  return <main className="min-h-screen bg-background text-text"><header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-line bg-background/90 px-4 backdrop-blur-xl md:gap-4 md:px-8"><Link to="/analytics" className="grid size-10 place-items-center rounded-xl border border-line-strong bg-surface-1 text-text-soft hover:text-accent" aria-label="Back to Analytics"><ArrowLeft size={16}/></Link><div className="min-w-0 flex-1"><p className="font-mono text-[9px] tracking-wider text-muted">UNBOUND / DASHBOARD · REVISION {dashboard.revision}</p><h1 className="truncate font-display text-sm font-bold">{dashboard.title}</h1></div><Link to={`/analytics/reports/${dashboard.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line-strong px-3 text-[10px] font-bold text-text-soft hover:text-accent"><FileText size={14}/><span className="hidden sm:inline">Generate report</span><span className="sm:hidden">Report</span></Link><button type="button" onClick={() => setPublishOpen(open => !open)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line-strong px-3 text-[10px] font-bold text-text-soft hover:text-accent"><Share2 size={14}/>Share</button><button type="button" onClick={() => void persist()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3 text-[10px] font-bold text-white hover:bg-accent-strong"><Save size={14}/>{saved ? 'Saved' : 'Save changes'}</button></header>
    <div className="mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-[10px] tracking-wider text-accent">LOCAL DASHBOARD · REVISION {dashboard.revision}</p><h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">{dashboard.title}</h2><p className="mt-2 text-xs text-text-soft">Based on {dashboard.source.plan.aggregation} of {dashboard.source.plan.measure ?? 'rows'} from local CSV data.</p>{qualityIssues.length > 0 && <ul className="mt-3 max-w-3xl space-y-1.5">{qualityIssues.map((issue, index) => <li key={`${issue.kind}-${issue.column}-${index}`} className="flex gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[10px] leading-5 text-amber-200"><span aria-hidden="true">⚠</span><span>{issue.message} Affected charts may be inaccurate.</span></li>)}</ul>}</div>
        <button type="button" onClick={addChart} disabled={getCharts().length >= 12} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line-strong px-3 text-[10px] font-bold text-text-soft hover:border-accent hover:text-accent disabled:opacity-50"><BarChart3 size={14}/> Add chart view</button>
      </div>
      {dashboardKpis.length > 0 && <section aria-label="Dashboard key metrics" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{dashboardKpis.map((metric, index) => {const value = metric.rows[0]?.value;return <article key={`${metric.plan.title}-${index}`} className="rounded-2xl border border-line bg-surface-1 p-4"><p className="font-mono text-[9px] tracking-wider text-muted">{metric.plan.measure ?? 'ROWS ANALYZED'}</p><p className="mt-2 font-display text-2xl font-extrabold tabular-nums">{typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value ?? '—')}</p><p className="mt-1 text-[10px] text-text-soft">{metric.plan.title}</p></article>})}</section>}
      <section className="mt-7 grid gap-4 xl:grid-cols-2">{getCharts().map((chart, index) => <article key={chart.id} className="min-w-0 rounded-2xl border border-line bg-surface-1 p-4 md:p-6"><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[9px] font-semibold text-accent"><BarChart3 size={12}/>{chartTypeLabel(chart.chartType)}</span><h3 className="mt-3 truncate font-display text-lg font-bold">{chart.title}</h3></div><div className="flex items-center gap-2"><label className="sr-only" htmlFor={`chart-type-${chart.id}`}>Chart style for {chart.title}</label><select id={`chart-type-${chart.id}`} value={chart.chartType} onChange={event => updateChart(chart.id, event.target.value as DashboardChartType)} className="form-field min-h-9 min-w-36"><option value="line">Line chart</option><option value="bar">Vertical bars</option><option value="horizontal_bar">Horizontal bars</option><option value="pie">Pie chart</option><option value="table">Data table</option></select>{index > 0 && <button type="button" onClick={() => removeChart(chart.id)} aria-label={`Remove ${chart.title}`} className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-red-400">×</button>}</div></div><p className="mb-2 text-[10px] text-muted">{chart.source.rows.length} groups · {chart.source.plan.aggregation} of {chart.source.plan.measure ?? 'rows'}</p><DashboardChart result={chart.source} type={chart.chartType}/></article>)}</section>
      <section className="mt-4 rounded-2xl border border-line bg-surface-1 p-5"><p className="font-mono text-[9px] tracking-wider text-muted">AI SUMMARY</p><p className="mt-3 text-sm leading-6">{dashboard.source.answer}</p><div className="mt-4 border-t border-line pt-3"><p className="text-[11px] leading-5 text-text-soft">Calculation: {dashboard.source.plan.aggregation} of <b className="text-text">{dashboard.source.plan.measure ?? 'rows'}</b>{dashboard.source.plan.group_by ? <> grouped by <b className="text-text">{dashboard.source.plan.group_by}</b></> : null}. Period: {dashboard.source.plan.period.replaceAll('_', ' ')}.</p><p className="mb-0 mt-2 flex items-center gap-2 text-[10px] text-text-soft"><Check size={13} className="text-accent"/>Each chart is a view of the validated DuckDB result. The AI edit preview updates all chart data together.</p></div></section>
      <section className="mt-5 rounded-2xl border border-line bg-surface-1 p-4 md:p-6"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Sparkles size={16}/></span><div><h3 className="font-display text-sm font-bold">Edit with your local AI</h3><p className="mt-1 text-[10px] leading-5 text-text-soft">Choose one chart to replace, or add a new view. Unbound prepares a new DuckDB result and lets you review it before applying.</p></div></div><form onSubmit={event => void proposeEdit(event)} className="mt-4"><label htmlFor="edit-target" className="mb-1.5 block text-[10px] font-semibold text-text-soft">Chart to change</label><select id="edit-target" value={editTarget} onChange={event => { setEditTarget(event.target.value); setProposal(null) }} className="form-field mb-3"><option value="__new__">Add as a new chart</option>{getCharts().map(chart => <option key={chart.id} value={chart.id}>Replace: {chart.title}</option>)}</select><label htmlFor="dashboard-edit" className="sr-only">Describe a dashboard edit</label><textarea id="dashboard-edit" value={editPrompt} onChange={event => { setEditPrompt(event.target.value); setProposal(null) }} rows={2} maxLength={1000} placeholder="Show sales by region as a horizontal bar chart…" className="form-field resize-y py-2.5"/><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-muted">The model returns a validated analysis plan; DuckDB calculates the preview.</span><button type="submit" disabled={editBusy || !editPrompt.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3 text-[10px] font-bold text-white disabled:opacity-50">{editBusy ? <LoaderCircle size={14} className="animate-spin"/> : <Sparkles size={14}/>} {editBusy ? 'Preparing preview' : 'Preview edit'}</button></div></form>{editError && <p role="alert" className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[10px] leading-5 text-amber-200">{editError}</p>}{proposal && <div className="mt-4 rounded-xl border border-accent/30 bg-accent-soft/30 p-4"><p className="font-mono text-[9px] tracking-wider text-accent">{proposal.targetId === '__new__' ? 'NEW CHART PREVIEW' : 'CHART EDIT PREVIEW'} · {chartTypeLabel(proposal.chartType)}</p><p className="mt-2 text-[11px] font-semibold">{proposal.source.plan.title}</p><p className="mt-1 text-[10px] leading-5 text-text-soft">{proposal.source.answer}</p><div className="mt-3"><DashboardChart result={proposal.source} type={proposal.chartType}/></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setProposal(null)} className="min-h-9 rounded-lg border border-line-strong px-3 text-[10px] font-semibold text-text-soft">Discard</button><button type="button" onClick={applyProposal} className="min-h-9 rounded-lg bg-accent px-3 text-[10px] font-bold text-white">{proposal.targetId === '__new__' ? 'Add chart' : 'Apply edit'}</button></div></div>}</section>
      {publishOpen && <section className="mt-5 rounded-2xl border border-accent/30 bg-surface-1 p-4 md:p-6"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[9px] tracking-wider text-accent">PUBLICATION PREVIEW</p><h3 className="mt-2 font-display text-base font-bold">Review what gets shared</h3><p className="mt-1 text-[10px] leading-5 text-text-soft">Only this aggregate result is published. Raw CSV rows and local file paths are excluded.</p></div><button type="button" aria-label="Close publication preview" onClick={() => setPublishOpen(false)} className="rounded-lg p-2 text-muted hover:bg-surface-2">×</button></div><div className="mt-4 rounded-xl border border-line bg-surface-2 p-4"><p className="text-xs font-semibold">{dashboard.title}</p><p className="mt-1 text-[10px] text-text-soft">{dashboard.source.plan.title} · {dashboard.source.rows.length} aggregate groups · {chartTypeLabel(dashboard.chartType)}</p><p className="mt-2 text-[10px] leading-5 text-text-soft">{dashboard.source.answer}</p>{dashboard.source.rows.length > 0 && dashboard.source.rows.length < 5 && <p role="status" className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[10px] leading-5 text-amber-200">This snapshot has fewer than five groups. Small groups can reveal sensitive information, so review the result before sharing.</p>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-[10px] font-semibold text-text-soft">Link access<select className="form-field" value={visibility} onChange={event => setVisibility(event.target.value as 'unlisted' | 'public')}><option value="unlisted">Unlisted · anyone with link</option><option value="public">Public snapshot</option></select></label><label className="grid gap-1.5 text-[10px] font-semibold text-text-soft">Link expires<select className="form-field" value={expiry} onChange={event => setExpiry(event.target.value as 'never' | '7d' | '30d')}><option value="never">Never</option><option value="7d">In 7 days</option><option value="30d">In 30 days</option></select></label></div>{publishError && <p role="alert" className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[10px] text-amber-200">{publishError}</p>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="mb-0 max-w-lg text-[9px] leading-4 text-muted">The viewer is read-only. Anyone holding an unlisted link can open the snapshot until it expires or you revoke it.</p><button type="button" onClick={() => void publishDashboard()} disabled={publishBusy || dashboard.revision < 1 || !saved} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 text-[10px] font-bold text-white disabled:opacity-50">{publishBusy ? <LoaderCircle size={14} className="animate-spin"/> : <Share2 size={14}/>} {publishBusy ? 'Publishing…' : dashboard.revision < 1 || !saved ? 'Save dashboard first' : 'Publish snapshot'}</button></div></section>}
      {activePublication && <section className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-1 p-4"><span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent"><Check size={16}/></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold">Snapshot published · {activePublication.visibility}</p><Link to={`/share/${activePublication.shareId}`} className="mt-1 block truncate text-[10px] text-accent">{shareUrl || `${window.location.origin}/share/${activePublication.shareId}`}</Link></div><button type="button" onClick={() => void navigator.clipboard?.writeText(shareUrl || `${window.location.origin}/share/${activePublication.shareId}`)} aria-label="Copy share link" className="grid size-9 place-items-center rounded-lg border border-line text-text-soft hover:text-accent"><Copy size={14}/></button><button type="button" onClick={() => void revokeShare()} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line-strong px-3 text-[10px] font-semibold text-text-soft hover:border-red-400/40 hover:text-red-400"><Ban size={13}/>Revoke</button></section>}
      <p className="mt-5 text-[10px] leading-5 text-muted">This draft is stored in this browser. When Neon persistence is configured, Save changes also syncs the validated dashboard spec.</p>
    </div></main>
}
