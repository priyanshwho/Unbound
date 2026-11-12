import Workspace from '../../features/analytics/Workspace'

export function AnalyticsRoute({ initialChatId }: { initialChatId?: string }) {
  return <Workspace initialChatId={initialChatId}/>
}
