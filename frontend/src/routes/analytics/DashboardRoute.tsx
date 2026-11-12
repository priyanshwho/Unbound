import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, BarChart3, Check, LoaderCircle, Save, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { DashboardChart } from '../../features/analytics/components/DashboardChart'
import { chartTypeLabel, readDashboard, saveDashboard, type DashboardChartType, type DashboardDraft } from '../../features/analytics/dashboard-types'
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
  const [proposal, setProposal] = useState<{ source: DashboardDraft['source']; chartType: DashboardChartType } | null>(null)

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

  function updateChart(type: DashboardChartType) {
    if (!dashboard) return
    setDashboard({ ...dashboard, chartType: type })
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
      setProposal({ source, chartType: requestedType ?? source.plan.chart_type })
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : 'The dashboard edit could not be prepared.')
    } finally {
      setEditBusy(false)
    }
  }

  function applyProposal() {
    if (!dashboard || !proposal) return
    const updated = { ...dashboard, title: proposal.source.plan.title || dashboard.title, source: proposal.source, chartType: proposal.chartType }
    setDashboard(updated)
    saveDashboard(updated)
    setProposal(null)
    setEditPrompt('')
    setSaved(false)
  }

  if (!dashboard) return <main className="grid min-h-screen place-items-center bg-background px-6 text-text"><section className="max-w-md text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl border border-line bg-surface-1 text-accent"><BarChart3 size={21}/></div><h1 className="mt-5 font-display text-2xl font-bold">Dashboard not found</h1><p className="mt-2 text-sm leading-6 text-text-soft">This dashboard may have been removed from this browser. Create one from an answer in Analytics.</p><Link to="/analytics" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-xs font-bold text-white"><ArrowLeft size={15}/> Return to Analytics</Link></section></main>

  return <main className="min-h-screen bg-background text-text"><header className="sticky top-0 z-20 flex min-h-16 items-center gap-4 border-b border-line bg-background/90 px-4 backdrop-blur-xl md:px-8"><Link to="/analytics" className="grid size-10 place-items-center rounded-xl border border-line-strong bg-surface-1 text-text-soft hover:text-accent" aria-label="Back to Analytics"><ArrowLeft size={16}/></Link><div className="min-w-0 flex-1"><p className="font-mono text-[9px] tracking-wider text-muted">UNBOUND / DASHBOARD · REVISION {dashboard.revision}</p><h1 className="truncate font-display text-sm font-bold">{dashboard.title}</h1></div><button type="button" onClick={() => void persist()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3 text-[10px] font-bold text-white hover:bg-accent-strong"><Save size={14}/>{saved ? 'Saved' : 'Save changes'}</button></header>
    <div className="mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] tracking-wider text-accent">LOCAL DASHBOARD · REVISION 1</p><h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">{dashboard.title}</h2><p className="mt-2 text-xs text-text-soft">Based on {dashboard.source.plan.aggregation} of {dashboard.source.plan.measure ?? 'rows'} from local CSV data.</p></div><label className="grid gap-1.5 text-[10px] font-semibold text-text-soft">Chart style<select value={dashboard.chartType} onChange={event => updateChart(event.target.value as DashboardChartType)} className="form-field min-w-44"><option value="line">Line chart</option><option value="bar">Vertical bars</option><option value="horizontal_bar">Horizontal bars</option><option value="pie">Pie chart</option><option value="table">Data table</option></select></label></div>
      <section className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(240px,.7fr)]"><article className="rounded-2xl border border-line bg-surface-1 p-4 md:p-6"><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[9px] font-semibold text-accent"><BarChart3 size={12}/>{chartTypeLabel(dashboard.chartType)}</span><h3 className="mt-3 font-display text-lg font-bold">{dashboard.source.plan.title}</h3></div><span className="font-mono text-[9px] text-muted">{dashboard.source.rows.length} groups</span></div><DashboardChart result={dashboard.source} type={dashboard.chartType}/></article><article className="rounded-2xl border border-line bg-surface-1 p-5"><p className="font-mono text-[9px] tracking-wider text-muted">AI SUMMARY</p><p className="mt-3 text-sm leading-6">{dashboard.source.answer}</p><div className="mt-5 border-t border-line pt-4"><p className="font-mono text-[9px] tracking-wider text-muted">CALCULATION</p><p className="mt-2 text-[11px] leading-5 text-text-soft">{dashboard.source.plan.aggregation} of <b className="text-text">{dashboard.source.plan.measure ?? 'rows'}</b>{dashboard.source.plan.group_by ? <> grouped by <b className="text-text">{dashboard.source.plan.group_by}</b></> : null}. Period: {dashboard.source.plan.period.replaceAll('_', ' ')}.</p></div><p className="mt-5 flex items-start gap-2 rounded-xl border border-line bg-surface-2 p-3 text-[10px] leading-5 text-text-soft"><Check size={14} className="mt-0.5 shrink-0 text-accent"/>Values come from the DuckDB result used to answer your question. Editing the chart style does not change the calculation.</p></article></section>
      <section className="mt-5 rounded-2xl border border-line bg-surface-1 p-4 md:p-6"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Sparkles size={16}/></span><div><h3 className="font-display text-sm font-bold">Edit with your local AI</h3><p className="mt-1 text-[10px] leading-5 text-text-soft">Ask to change the metric, grouping, time period, or chart. Unbound prepares a new DuckDB result for you to review before applying it.</p></div></div><form onSubmit={event => void proposeEdit(event)} className="mt-4"><label htmlFor="dashboard-edit" className="sr-only">Describe a dashboard edit</label><textarea id="dashboard-edit" value={editPrompt} onChange={event => { setEditPrompt(event.target.value); setProposal(null) }} rows={2} maxLength={1000} placeholder="Change this to a horizontal bar chart of sales by region…" className="form-field resize-y py-2.5"/><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-muted">The model returns a validated analysis plan; DuckDB calculates the preview.</span><button type="submit" disabled={editBusy || !editPrompt.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3 text-[10px] font-bold text-white disabled:opacity-50">{editBusy ? <LoaderCircle size={14} className="animate-spin"/> : <Sparkles size={14}/>} {editBusy ? 'Preparing preview' : 'Preview edit'}</button></div></form>{editError && <p role="alert" className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[10px] leading-5 text-amber-200">{editError}</p>}{proposal && <div className="mt-4 rounded-xl border border-accent/30 bg-accent-soft/30 p-4"><p className="font-mono text-[9px] tracking-wider text-accent">EDIT PREVIEW · {chartTypeLabel(proposal.chartType)}</p><p className="mt-2 text-[11px] font-semibold">{proposal.source.plan.title}</p><p className="mt-1 text-[10px] leading-5 text-text-soft">{proposal.source.answer}</p><div className="mt-3"><DashboardChart result={proposal.source} type={proposal.chartType}/></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setProposal(null)} className="min-h-9 rounded-lg border border-line-strong px-3 text-[10px] font-semibold text-text-soft">Discard</button><button type="button" onClick={applyProposal} className="min-h-9 rounded-lg bg-accent px-3 text-[10px] font-bold text-white">Apply edit</button></div></div>}</section>
      <p className="mt-5 text-[10px] leading-5 text-muted">This draft is stored in this browser. When Neon persistence is configured, Save changes also syncs the validated dashboard spec.</p>
    </div></main>
}
