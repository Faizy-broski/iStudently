import { evaluateScheduleChange } from './conflict-engine'
import type { DecisionProvider } from './types'

/** Default provider: the exact, in-process engine. */
export const deterministicProvider: DecisionProvider = {
  decide: evaluateScheduleChange,
}
