import type { FeedbackStatus } from '@studently/api-client'

export const FEEDBACK_VARIANT: Record<FeedbackStatus, 'default' | 'secondary' | 'outline'> = {
  open: 'default',
  in_progress: 'secondary',
  resolved: 'outline',
}

/** Soft chip tone per feedback status (card lists). */
export const FEEDBACK_TONE: Record<FeedbackStatus, 'info' | 'warning' | 'success'> = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
}
