import { useParams } from 'react-router-dom'
import { AnalyticsRoute } from './AnalyticsRoute'

export function ChatRoute() {
  const { chatId } = useParams()
  return <AnalyticsRoute initialChatId={chatId}/>
}
