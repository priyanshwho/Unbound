export type AnalysisPlan = {
  measure: string | null
  group_by: string | null
  aggregation: 'sum' | 'average' | 'count' | 'min' | 'max'
  date_column: string | null
  period: 'all_time' | 'last_month' | 'last_30_days' | 'this_month' | 'this_year'
  date_grain: 'day' | 'month' | 'year' | null
  chart_type: 'line' | 'bar' | 'horizontal_bar' | 'pie' | 'table'
  title: string
}

export type AnalysisResponse = {
  dataset_id: string
  answer: string
  plan: AnalysisPlan
  rows: Array<Record<string, string | number | null>>
}
