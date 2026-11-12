import { useEffect, useState } from 'react'
import { ArrowLeft, BarChart3, ExternalLink, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { DashboardChart } from '../../features/analytics/components/DashboardChart'
import type { AnalysisResponse } from '../../features/analysis-chat/types'
import type { DashboardSnapshot } from '../../features/analytics/dashboard-types'

type SharedPublication = { visibility: 'public' | 'unlisted'; snapshot: DashboardSnapshot }
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; publication: SharedPublication }

const publicApiUrl = import.meta.env.VITE_PUBLIC_PERSISTENCE_API_URL?.replace(/\/$/, '')

export function SharedDashboardRoute() {
  const { shareId = '' } = useParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    const endpoint = publicApiUrl ? `${publicApiUrl}/v1/share/${shareId}` : `/api/v1/share/${shareId}`
    void fetch(endpoint).then(async response => {
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const detail = typeof body === 'object' && body !== null && 'detail' in body && typeof body.detail === 'string' ? body.detail : 'This dashboard is unavailable, expired, or has been revoked.'
        throw new Error(detail)
      }
      return body as SharedPublication
    }).then(publication => {
      if (active) setState({ status: 'ready', publication })
    }).catch(reason => {
      if (active) setState({ status: 'error', message: reason instanceof Error ? reason.message : 'The shared dashboard could not be loaded.' })
    })
    return () => { active = false }
  }, [shareId])

  if (state.status !== 'ready') return <main className="grid min-h-screen place-items-center bg-background px-5 text-text"><section className="max-w-md text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl border border-line bg-surface-1 text-accent"><BarChart3 size={21}/></div><h1 className="mt-5 font-display text-2xl font-bold">{state.status === 'loading' ? 'Opening snapshot…' : 'Snapshot unavailable'}</h1><p role={state.status === 'error' ? 'alert' : undefined} className="mt-2 text-sm leading-6 text-text-soft">{state.status === 'loading' ? 'Loading the read-only dashboard.' : state.message}</p>{state.status === 'error' && <Link to="/" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-accent"><ArrowLeft size={14}/> Back to Unbound</Link>}</section></main>

  const { snapshot } = state.publication
  const charts = snapshot.charts.map(chart => {
    const chartType = chart.type === 'donut' ? 'pie' : chart.type
    const result: AnalysisResponse = {
      dataset_id: '',
      answer: 'Published aggregate snapshot. Source CSV rows and local paths are not included.',
      plan: { measure: chart.data[0]?.series ?? 'Value', group_by: 'Group', aggregation: 'sum', date_column: null, period: 'all_time', date_grain: null, chart_type: chartType, title: chart.title },
      rows: chart.data.map(row => ({ category: row.label, value: row.value })),
      quality_issues: [],
    }
    return { ...chart, chartType, result }
  })

  return <main className="min-h-screen bg-background text-text"><header className="flex min-h-16 items-center border-b border-line bg-background-deep px-4 md:px-8"><Link to="/" className="inline-flex items-center gap-2 font-display text-sm font-extrabold">Unbound<span className="text-accent">.</span></Link><span className="ml-auto inline-flex items-center gap-2 rounded-full border border-line bg-surface-1 px-3 py-1.5 font-mono text-[9px] tracking-wide text-text-soft"><ShieldCheck size={13} className="text-accent"/> READ-ONLY · {state.publication.visibility.toUpperCase()}</span></header><div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] tracking-widest text-accent">SHARED SNAPSHOT · GENERATED REPORT</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">{snapshot.title}</h1><p className="mt-2 text-xs text-text-soft">Aggregate values prepared by the dashboard owner.</p></div><Link to="/analytics" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line-strong px-3 text-[10px] font-bold text-text-soft hover:text-accent">Explore Unbound <ExternalLink size={13}/></Link></div>
    {snapshot.summary && <section className="mt-7 rounded-2xl border border-line bg-surface-1 p-5 md:p-7"><p className="font-mono text-[9px] tracking-widest text-muted">SUMMARY</p><p className="mb-0 mt-3 text-sm leading-7">{snapshot.summary}</p></section>}
    {snapshot.kpis.length > 0 && <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{snapshot.kpis.map(kpi => <article key={kpi.id} className="rounded-2xl border border-line bg-surface-1 p-4"><p className="font-mono text-[9px] tracking-wider text-muted">{kpi.label}</p><p className="mt-2 font-display text-2xl font-extrabold tabular-nums">{typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}</p></article>)}</section>}
    <section className="mt-5 grid gap-4 xl:grid-cols-2">{charts.map(chart => <article key={chart.id} className="min-w-0 rounded-2xl border border-line bg-surface-1 p-4 md:p-6"><div className="mb-5"><span className="rounded-full bg-accent-soft px-2.5 py-1 font-mono text-[9px] text-accent">{chart.type.replace('_', ' ').toUpperCase()}</span><h2 className="mt-3 font-display text-lg font-bold">{chart.title}</h2></div><DashboardChart result={chart.result} type={chart.chartType}/></article>)}</section>
    {snapshot.warnings?.length > 0 && <section className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5"><h2 className="font-display text-base font-bold">Data quality notes</h2><ul className="mb-0 mt-3 space-y-2">{snapshot.warnings.map((warning, index) => <li className="text-xs leading-5 text-text-soft" key={`${warning}-${index}`}>⚠ {warning}</li>)}</ul></section>}<p className="mt-4 text-[10px] leading-5 text-muted">Read-only snapshot. It contains aggregate chart data only; no source files or row-level records are available on this page.</p>
  </div></main>
}
