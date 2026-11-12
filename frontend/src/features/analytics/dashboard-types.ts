import type { AnalysisResponse } from '../analysis-chat/types'

export type DashboardChartType = AnalysisResponse['plan']['chart_type']

export function chartTypeLabel(type: DashboardChartType) {
  return { line: 'Line chart', bar: 'Vertical bars', horizontal_bar: 'Horizontal bars', pie: 'Pie chart', table: 'Data table' }[type]
}

export type DashboardDraft = {
  version: 1
  id: string
  revision: number
  title: string
  createdAt: string
  source: AnalysisResponse
  kpis?: AnalysisResponse[]
  chartType: DashboardChartType
  charts?: DashboardChartDraft[]
  publication?: { shareId: string; visibility: 'public' | 'unlisted' }
}

export type DashboardChartDraft = {
  id: string
  title: string
  source: AnalysisResponse
  chartType: DashboardChartType
}

export type DashboardSnapshot = {
  version: 1
  dashboardId: string
  title: string
  summary: string
  warnings: string[]
  kpis: Array<{ id: string; label: string; value: string | number }>
  charts: Array<{ id: string; title: string; type: 'line' | 'bar' | 'horizontal_bar' | 'pie' | 'donut'; data: Array<{ label: string; value: string | number; series?: string }> }>
  filters: []
}

export function buildDashboardSnapshot(draft: DashboardDraft): DashboardSnapshot {
  const charts = draft.charts?.length ? draft.charts : [{ id: 'primary-result', title: draft.source.plan.title, source: draft.source, chartType: draft.chartType }]
  const data = (source: AnalysisResponse) => source.rows.slice(0, 500).map((row, index) => ({
    label: String(row.category ?? `Row ${index + 1}`).slice(0, 240),
    value: typeof row.value === 'number' || typeof row.value === 'string' ? row.value : 0,
  }))
  const kpis = draft.kpis?.length ? draft.kpis : draft.source.plan.group_by ? [] : [draft.source]
  return {
    version: 1,
    dashboardId: draft.id,
    title: draft.title,
    summary: draft.source.answer,
    warnings: [...new Map([...charts.flatMap(chart => chart.source.quality_issues ?? []), ...(draft.kpis ?? []).flatMap(metric => metric.quality_issues ?? [])].map(issue => [`${issue.kind}:${issue.column ?? ''}`, issue.message])).values()].slice(0, 32),
    kpis: kpis.flatMap((source, index) => source.rows.slice(0, 1).map(row => ({
      id: `metric-${index}`,
      label: source.plan.measure ?? 'Rows analyzed',
      value: typeof row.value === 'string' || typeof row.value === 'number' ? row.value : 0,
    }))),
    charts: charts.map(chart => ({ id: chart.id, title: chart.title, type: chart.chartType === 'table' ? 'bar' : chart.chartType, data: data(chart.source) })),
    filters: [],
  }
}

export const DASHBOARD_STORAGE_KEY = 'unbound-dashboard-drafts'

export function listDashboards(): DashboardDraft[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DASHBOARD_STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is DashboardDraft => item?.version === 1 && typeof item.id === 'string' && typeof item.title === 'string') : []
  } catch {
    return []
  }
}

export function readDashboard(id: string): DashboardDraft | null {
  try {
    const draft = listDashboards().find(item => item.id === id)
    return draft ? { ...draft, revision: Number.isInteger(draft.revision) ? draft.revision : 0 } : null
  } catch {
    return null
  }
}

export function saveDashboard(draft: DashboardDraft) {
  let drafts: DashboardDraft[] = []
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(DASHBOARD_STORAGE_KEY) ?? '[]')
    if (Array.isArray(stored)) drafts = stored.filter((item): item is DashboardDraft => item?.version === 1 && typeof item.id === 'string').map(item => ({ ...item, revision: Number.isInteger(item.revision) ? item.revision : 0 }))
  } catch {
    // Replace unreadable drafts with the valid draft being saved.
  }
  localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify([draft, ...drafts.filter(item => item.id !== draft.id)]))
}
