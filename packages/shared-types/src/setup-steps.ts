import setupSteps from './setup-steps.json'
import tourSteps from './tour-steps.json'

/**
 * The dashboard Setup Assistant checklist per role (web: frontend/src/config/setup-steps.ts),
 * snapshotted by scripts/sync-role-hrefs.sh. The backend only stores which step ids are done.
 */
export interface SetupStep {
  id: string
  /** English text (the web has no translation for it). */
  text: string
  href: string
}

export interface SetupStepCategory {
  title: string
  /** lucide icon name */
  icon: string
  steps: SetupStep[]
}

export type SetupAssistantRole = 'admin' | 'teacher' | 'student' | 'parent' | 'librarian'

export const SETUP_STEPS: Record<SetupAssistantRole, SetupStepCategory[]> = setupSteps as Record<SetupAssistantRole, SetupStepCategory[]>


/** One stop of the dashboard Tour Assistant (web: frontend/src/config/tour-steps.ts). */
export interface TourStep {
  id: string
  title: string
  href: string
  description: string
  category: string
  /** lucide icon name */
  icon: string
}

export const TOUR_STEPS: Record<SetupAssistantRole, TourStep[]> = tourSteps as Record<SetupAssistantRole, TourStep[]>
