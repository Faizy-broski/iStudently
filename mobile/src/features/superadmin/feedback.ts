import type { FeedbackStatus } from '@studently/api-client'

export const FEEDBACK_VARIANT: Record<FeedbackStatus, 'default' | 'secondary' | 'outline'> = {
  open: 'default',
  in_progress: 'secondary',
  resolved: 'outline',
}
