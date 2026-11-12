import { useState } from 'react'
import { ArrowLeft, BarChart3, Check, Save } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { DashboardChart } from '../../features/analytics/components/DashboardChart'
import { chartTypeLabel, readDashboard, saveDashboard, type DashboardChartType, type DashboardDraft } from '../../features/analytics/dashboard-types'

export function DashboardRoute() {
  const { dashboardId = '' } = useParams()
  return <DashboardEditor key={dashboardId} dashboardId={dashboardId}/>
}

function DashboardEditor({ dashboardId }: { dashboardId: string }) {
  const [dashboard, setDashboard] = useState<DashboardDraft | null>(() => readDashboard(dashboardId))
  const [saved, setSaved] = useState(false)

  function updateChart(type: DashboardChartType) {
    if (!dashboard) return
    setDashboard({ ...dashboard, chartType: type })
    setSaved(false)
  }

  function persist() {
    if (!dashboard) return
    saveDashboard(dashboard)
    setSaved(true)
  }

  if (!dashboard) return <main className="grid min-h-screen place-items-center bg-background px-6 text-text"><section className="max-w-md text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl border border-line bg-surface-1 text-accent"><BarChart3 size={21}/></div><h1 className="mt-5 font-display text-2xl font-bold">Dashboard not found</h1><p className="mt-2 text-sm leading-6 text-text-soft">This dashboard may have been removed from this browser. Create one from an answer in Analytics.</p><Link to="/analytics" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-xs font-bold text-white"><ArrowLeft size={15}/> Return to Analytics</Link></section></main>

  return <main className="min-h-screen bg-background text-text"><header className="sticky top-0 z-20 flex min-h-16 items-center gap-4 border-b border-line bg-background/90 px-4 backdrop-blur-xl md:px-8"><Link to="/analytics" className="grid size-10 place-items-center rounded-xl border border-line-strong bg-surface-1 text-text-soft hover:text-accent" aria-label="Back to Analytics"><ArrowLeft size={16}/></Link><div className="min-w-0 flex-1"><p className="font-mono text-[9px] tracking-wider text-muted">UNBOUND / DASHBOARD</p><h1 className="truncate font-display text-sm font-bold">{dashboard.title}</h1></div><button type="button" onClick={persist} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3 text-[10px] font-bold text-white hover:bg-accent-strong"><Save size={14}/>{saved ? 'Saved' : 'Save changes'}</button></header>
    <div className="mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] tracking-wider text-accent">LOCAL DASHBOARD · REVISION 1</p><h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">{dashboard.title}</h2><p className="mt-2 text-xs text-text-soft">Based on {dashboard.source.plan.aggregation} of {dashboard.source.plan.measure ?? 'rows'} from local CSV data.</p></div><label className="grid gap-1.5 text-[10px] font-semibold text-text-soft">Chart style<select value={dashboard.chartType} onChange={event => updateChart(event.target.value as DashboardChartType)} className="form-field min-w-44"><option value="line">Line chart</option><option value="bar">Vertical bars</option><option value="horizontal_bar">Horizontal bars</option><option value="pie">Pie chart</option><option value="table">Data table</option></select></label></div>
      <section className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(240px,.7fr)]"><article className="rounded-2xl border border-line bg-surface-1 p-4 md:p-6"><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[9px] font-semibold text-accent"><BarChart3 size={12}/>{chartTypeLabel(dashboard.chartType)}</span><h3 className="mt-3 font-display text-lg font-bold">{dashboard.source.plan.title}</h3></div><span className="font-mono text-[9px] text-muted">{dashboard.source.rows.length} groups</span></div><DashboardChart result={dashboard.source} type={dashboard.chartType}/></article><article className="rounded-2xl border border-line bg-surface-1 p-5"><p className="font-mono text-[9px] tracking-wider text-muted">AI SUMMARY</p><p className="mt-3 text-sm leading-6">{dashboard.source.answer}</p><div className="mt-5 border-t border-line pt-4"><p className="font-mono text-[9px] tracking-wider text-muted">CALCULATION</p><p className="mt-2 text-[11px] leading-5 text-text-soft">{dashboard.source.plan.aggregation} of <b className="text-text">{dashboard.source.plan.measure ?? 'rows'}</b>{dashboard.source.plan.group_by ? <> grouped by <b className="text-text">{dashboard.source.plan.group_by}</b></> : null}. Period: {dashboard.source.plan.period.replaceAll('_', ' ')}.</p></div><p className="mt-5 flex items-start gap-2 rounded-xl border border-line bg-surface-2 p-3 text-[10px] leading-5 text-text-soft"><Check size={14} className="mt-0.5 shrink-0 text-accent"/>Values come from the DuckDB result used to answer your question. Editing the chart style does not change the calculation.</p></article></section>
      <p className="mt-5 text-[10px] leading-5 text-muted">This draft is stored in this browser. Connect Neon persistence to sync dashboard metadata across sessions.</p>
    </div></main>
}
