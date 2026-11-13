import { useState } from 'react'
import { ArrowLeft, Check, Copy, FileText, LoaderCircle, Printer, Share2, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { DashboardChart } from '../../features/analytics/components/DashboardChart'
import { buildDashboardSnapshot, chartTypeLabel, readDashboard, saveDashboard, type DashboardChartDraft } from '../../features/analytics/dashboard-types'

export function ReportRoute() {
  const { dashboardId = '' } = useParams()
  const dashboard = readDashboard(dashboardId)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState('')
  const [shareUrl, setShareUrl] = useState(dashboard?.publication ? `${window.location.origin}/share/${dashboard.publication.shareId}` : '')

  if (!dashboard) return <main className="grid min-h-screen place-items-center bg-background px-5 text-text"><section className="max-w-md text-center"><h1 className="font-display text-2xl font-bold">Report unavailable</h1><p className="mt-2 text-sm leading-6 text-text-soft">This report needs the saved dashboard from the browser where it was created.</p><Link to="/analytics" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-accent"><ArrowLeft size={14}/> Back to Analytics</Link></section></main>

  const charts = dashboard.charts?.length ? dashboard.charts : [{ id: 'primary-result', title: dashboard.source.plan.title, source: dashboard.source, chartType: dashboard.chartType }]
  const warnings = [...new Map(charts.flatMap(chart => chart.source.quality_issues ?? []).map(issue => [`${issue.kind}:${issue.column ?? ''}`, issue])).values()]

  async function publishReport() {
    if (!dashboard || shareBusy) return
    setShareBusy(true)
    setShareError('')
    try {
      const savedResponse = await fetch(`/api/v1/dashboards/${dashboard.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dashboard.id, title: dashboard.title, spec: { ...dashboard, revision: dashboard.revision + 1 } }),
      })
      const savedBody: unknown = await savedResponse.json().catch(() => null)
      if (!savedResponse.ok) throw new Error('Sharing needs the Neon persistence API to be configured and running.')
      const revision = typeof savedBody === 'object' && savedBody !== null && 'revision' in savedBody && typeof savedBody.revision === 'number' ? savedBody.revision : dashboard.revision + 1
      const updated = { ...dashboard, revision }
      const shareId = crypto.randomUUID()
      const response = await fetch('/api/v1/publications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_id: shareId, dashboard_id: dashboard.id, revision, visibility: 'unlisted', expires_at: null, snapshot: buildDashboardSnapshot(updated) }),
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(typeof body === 'object' && body !== null && 'detail' in body && typeof body.detail === 'string' ? body.detail : 'The report could not be shared.')
      const published = { ...updated, publication: { shareId, visibility: 'unlisted' as const } }
      saveDashboard(published)
      setShareUrl(`${window.location.origin}/share/${shareId}`)
      setShareOpen(false)
    } catch (reason) {
      setShareError(reason instanceof Error ? reason.message : 'The report could not be shared.')
    } finally {
      setShareBusy(false)
    }
  }

  async function revokeReport() {
    if (!dashboard?.publication) return
    const response = await fetch(`/api/v1/publications/${dashboard.publication.shareId}`, { method: 'DELETE' })
    if (!response.ok) { setShareError('The share could not be revoked. Check the persistence API connection.'); return }
    const updated = { ...dashboard, publication: undefined }
    saveDashboard(updated)
    setShareUrl('')
  }

  return <main className="min-h-screen bg-background text-text"><header className="report-toolbar sticky top-0 z-20 flex min-h-16 items-center gap-2 border-b border-line bg-background/90 px-3 backdrop-blur-xl sm:gap-3 sm:px-4 md:px-8"><Link to={`/analytics/dashboards/${dashboardId}`} aria-label="Back to dashboard" className="grid size-10 place-items-center rounded-xl border border-line-strong bg-surface-1 text-text-soft hover:text-accent"><ArrowLeft size={16}/></Link><div className="min-w-0 flex-1"><p className="font-mono text-[9px] tracking-wider text-muted">UNBOUND / GENERATED REPORT</p><h1 className="truncate font-display text-sm font-bold">{dashboard.title}</h1></div><button type="button" onClick={() => setShareOpen(open => !open)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line-strong px-3 text-[10px] font-bold text-text-soft hover:text-accent"><Share2 size={14}/><span className="hidden sm:inline">Share report</span></button><button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3 text-[10px] font-bold text-white"><Printer size={14}/><span className="hidden sm:inline">Save as PDF</span><span className="sm:hidden">PDF</span></button></header>
    {shareOpen && <section className="report-toolbar mx-auto mt-4 max-w-5xl rounded-2xl border border-accent/30 bg-surface-1 p-4 md:p-6"><h2 className="font-display text-base font-bold">Share this report</h2><p className="mt-2 text-xs leading-5 text-text-soft">The public link contains the report’s aggregate metrics, charts, and data quality notes. It does not include CSV rows or local paths. Anyone with the unlisted link can read it.</p>{shareError && <p role="alert" className="mt-3 text-xs text-amber-300">{shareError}</p>}<button type="button" onClick={() => void publishReport()} disabled={shareBusy} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 text-[10px] font-bold text-white disabled:opacity-50">{shareBusy ? <LoaderCircle size={14} className="animate-spin"/> : <Share2 size={14}/>} {shareBusy ? 'Publishing…' : 'Create share link'}</button></section>}
    {shareUrl && <section className="report-toolbar mx-auto mt-4 flex max-w-5xl flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-1 p-4"><Check size={16} className="text-accent"/><div className="min-w-0 flex-1"><p className="text-xs font-semibold">Unlisted report link</p><a className="mt-1 block truncate text-[10px] text-accent" href={shareUrl}>{shareUrl}</a></div><button type="button" aria-label="Copy report share link" onClick={() => void navigator.clipboard?.writeText(shareUrl)} className="grid size-9 place-items-center rounded-lg border border-line text-text-soft hover:text-accent"><Copy size={14}/></button>{dashboard.publication && <button type="button" onClick={() => void revokeReport()} className="text-[10px] font-semibold text-text-soft hover:text-red-400">Revoke link</button>}</section>}
    <article className="report-document mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6"><div><p className="inline-flex items-center gap-2 font-mono text-[10px] tracking-widest text-accent"><FileText size={13}/>ANALYSIS REPORT</p><h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight md:text-5xl">{dashboard.title}</h2><p className="mt-3 text-xs text-text-soft">Created {new Date(dashboard.createdAt).toLocaleString()} · {charts.length} chart views · Revision {dashboard.revision}</p></div><span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-1 px-3 py-2 font-mono text-[9px] text-text-soft"><ShieldCheck size={13} className="text-accent"/>AGGREGATE RESULTS</span></div>
      <section className="mt-7 rounded-2xl border border-line bg-surface-1 p-5 md:p-7"><p className="font-mono text-[9px] tracking-widest text-muted">SUMMARY</p><p className="mb-0 mt-3 text-sm leading-7 text-text">{dashboard.source.answer}</p><p className="mb-0 mt-3 text-[10px] leading-5 text-muted">Calculated with DuckDB from the selected local CSV. Metric: {dashboard.source.plan.aggregation} of {dashboard.source.plan.measure ?? 'rows'}{dashboard.source.plan.group_by ? ` grouped by ${dashboard.source.plan.group_by}` : ''}; period: {dashboard.source.plan.period.replaceAll('_', ' ')}.</p></section>
      {dashboard.kpis?.length ? <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{dashboard.kpis.map((metric, index) => {const value = metric.rows[0]?.value;return <article key={`${metric.plan.title}-${index}`} className="break-inside-avoid rounded-2xl border border-line bg-surface-1 p-4"><p className="font-mono text-[9px] tracking-wider text-muted">{metric.plan.measure ?? 'ROWS ANALYZED'}</p><p className="mt-2 font-display text-2xl font-extrabold tabular-nums">{typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value ?? '—')}</p><p className="mt-1 text-[10px] text-text-soft">{metric.plan.title}</p></article>})}</section> : null}
      {charts.some(chart => chart.source.plan.date_column) && <section className="mt-8" id="sales-trends"><div className="mb-3"><p className="font-mono text-[9px] tracking-widest text-muted">SALES TRENDS</p><h3 className="mt-1 font-display text-xl font-bold">Performance over time</h3></div><div className="space-y-4">{charts.filter(chart => chart.source.plan.date_column).map(chart => <ReportChart key={chart.id} chart={chart}/>)}</div></section>}
      {charts.some(chart => !chart.source.plan.date_column) && <section className="mt-8" id="product-store-analysis"><div className="mb-3"><p className="font-mono text-[9px] tracking-widest text-muted">PRODUCT, CATEGORY & LOCATION PERFORMANCE</p><h3 className="mt-1 font-display text-xl font-bold">How results vary across the file</h3></div><div className="space-y-4">{charts.filter(chart => !chart.source.plan.date_column).map(chart => <ReportChart key={chart.id} chart={chart}/>)}</div></section>}
      <section className="mt-8 rounded-2xl border border-line bg-surface-1 p-5 md:p-7" id="business-insights"><p className="font-mono text-[9px] tracking-widest text-muted">WHAT THE DATA SHOWS</p><h3 className="mt-1 font-display text-xl font-bold">Findings from the calculated results</h3><ol className="mb-0 mt-4 space-y-3">{charts.map(chart => {const top = chart.source.rows[0];return <li key={chart.id} className="flex gap-3 border-t border-line pt-3 text-xs leading-6"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-[10px] text-accent">{chart.source.plan.date_column ? 'T' : '•'}</span><span><b>{chart.title}.</b> {top ? `${String(top.category ?? 'Total')}: ${typeof top.value === 'number' ? top.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(top.value)}.` : 'No result rows were returned.'} {chart.source.plan.date_column ? 'This is the highest period in the returned trend.' : 'This is the highest group in the returned results.'}</span></li>})}</ol></section>
      {warnings.length > 0 && <section className="mt-7 break-inside-avoid rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 md:p-7"><p className="font-mono text-[9px] tracking-widest text-amber-300">DATA QUALITY NOTES</p><h3 className="mt-2 font-display text-lg font-bold">Review these caveats before relying on totals</h3><ul className="mb-0 mt-3 space-y-2">{warnings.map((issue, index) => <li key={`${issue.kind}-${issue.column}-${index}`} className="flex gap-2 text-xs leading-6 text-text-soft"><span className="text-amber-300">•</span>{issue.message}</li>)}</ul></section>}
      <section className="mt-8 rounded-2xl border border-line bg-surface-1 p-5 md:p-7" id="methodology"><p className="font-mono text-[9px] tracking-widest text-muted">HOW THIS WAS WORKED OUT</p><h3 className="mt-1 font-display text-xl font-bold">Source and method</h3><p className="mb-0 mt-3 text-xs leading-6 text-text-soft">The numbers in this report were queried from the selected CSV with DuckDB. Each chart caption shows the aggregation and grouping used. Review the data quality notes above before treating totals as exact. This report contains aggregate results only; it does not include source rows or local file paths.</p></section>
      <footer className="mt-8 border-t border-line pt-4 text-[10px] leading-5 text-muted">Use your browser’s print dialog and choose “Save as PDF” to export.</footer>
    </article></main>
}

function ReportChart({ chart }: { chart: DashboardChartDraft }) {
  return <section className="break-inside-avoid rounded-2xl border border-line bg-surface-1 p-4 md:p-6"><div className="mb-4"><p className="font-mono text-[9px] tracking-wider text-accent">{chartTypeLabel(chart.chartType).toUpperCase()} · {chart.source.rows.length} RESULT ROWS</p><h4 className="mt-2 font-display text-lg font-bold">{chart.title}</h4><p className="mt-1 text-[10px] text-text-soft">{chart.source.plan.aggregation} of {chart.source.plan.measure ?? 'rows'}{chart.source.plan.group_by ? ` by ${chart.source.plan.group_by}` : ''}</p></div><DashboardChart result={chart.source} type={chart.chartType}/><p className="mb-0 mt-4 text-xs leading-6">{chart.source.answer}</p></section>
}
