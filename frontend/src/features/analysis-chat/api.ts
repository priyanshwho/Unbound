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
    if (typeof detail === 'string') throw new Error(detail)
    if (Array.isArray(detail)) {
      const messages = detail.flatMap(item => {
        if (typeof item !== 'object' || item === null || !('msg' in item) || typeof item.msg !== 'string') return []
        return [item.msg]
      })
      if (messages.length) throw new Error(messages.join(' '))
    }
    throw new Error(`The analysis request failed (${response.status}).`)
  }
  return result as AnalysisResponse
}
