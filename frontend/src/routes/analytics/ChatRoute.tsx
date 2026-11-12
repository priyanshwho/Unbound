import { useParams } from 'react-router-dom'
import { AnalyticsRoute } from './AnalyticsRoute'

export function ChatRoute() {
  const { chatId } = useParams()
  return <div data-chat-id={chatId}><AnalyticsRoute/></div>
}
