import type { AnalysisResponse } from './types'

export async function askDataset(datasetId: string, question: string): Promise<AnalysisResponse> {
  const response = await fetch('/api/v1/analysis/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_id: datasetId, question }),
  })
  const body = await response.text()
  let result: unknown
  try {
    result = JSON.parse(body)
  } catch {
    throw new Error('The analysis service returned an unreadable response.')
  }
  if (!response.ok) {
    const detail = typeof result === 'object' && result !== null && 'detail' in result ? result.detail : null
    throw new Error(typeof detail === 'string' ? detail : `The analysis request failed (${response.status}).`)
  }
  return result as AnalysisResponse
}
