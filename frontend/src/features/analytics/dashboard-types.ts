import type { AnalysisResponse } from '../analysis-chat/types'

export type DashboardChartType = AnalysisResponse['plan']['chart_type']

export function chartTypeLabel(type: DashboardChartType) {
  return { line: 'Line chart', bar: 'Vertical bars', horizontal_bar: 'Horizontal bars', pie: 'Pie chart', table: 'Data table' }[type]
}

export type DashboardDraft = {
  version: 1
  id: string
  title: string
  createdAt: string
  source: AnalysisResponse
  chartType: DashboardChartType
}

export const DASHBOARD_STORAGE_KEY = 'unbound-dashboard-drafts'

export function readDashboard(id: string): DashboardDraft | null {
  try {
    const drafts: unknown = JSON.parse(localStorage.getItem(DASHBOARD_STORAGE_KEY) ?? '[]')
    return Array.isArray(drafts)
      ? drafts.find((draft): draft is DashboardDraft => draft?.version === 1 && draft.id === id) ?? null
      : null
  } catch {
    return null
  }
}

export function saveDashboard(draft: DashboardDraft) {
  let drafts: DashboardDraft[] = []
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(DASHBOARD_STORAGE_KEY) ?? '[]')
    if (Array.isArray(stored)) drafts = stored.filter((item): item is DashboardDraft => item?.version === 1 && typeof item.id === 'string')
  } catch {
    // Replace unreadable drafts with the valid draft being saved.
  }
  localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify([draft, ...drafts.filter(item => item.id !== draft.id)]))
}
