/**
 * Positive & Skill-Based Reaction Engine — canonical reaction config.
 * The server never trusts a client-sent point value; every point awarded is
 * computed here. Mirrored (display-only) at
 * frontend/src/lib/constants/reaction-config.ts for rendering the picker.
 */

export type ReactionCategory = 'general' | 'academic_skill'

export type ReactionKind =
  | 'thumbs_up'
  | 'clap'
  | 'bright_idea'
  | 'star'
  | 'thinker'
  | 'artistic'
  | 'teamwork'
  | 'bookworm'

export interface ReactionConfigEntry {
  category: ReactionCategory
  points: number
}

export const REACTION_CONFIG: Record<ReactionKind, ReactionConfigEntry> = {
  thumbs_up: { category: 'general', points: 1 },
  clap: { category: 'general', points: 1 },
  bright_idea: { category: 'general', points: 2 },
  star: { category: 'general', points: 2 },
  thinker: { category: 'academic_skill', points: 3 },
  artistic: { category: 'academic_skill', points: 3 },
  teamwork: { category: 'academic_skill', points: 3 },
  bookworm: { category: 'academic_skill', points: 3 },
}

export const VALID_REACTION_KINDS = Object.keys(REACTION_CONFIG) as ReactionKind[]

/**
 * Reaction kinds that existed before this feature ('clap' aside, which is
 * promoted to a first-class member of REACTION_CONFIG above since it was
 * already the column default). Still valid in the DB CHECK constraint (see
 * 298_extend_fina_reactions_and_honor_roll.sql) so old rows don't break, but
 * never offered in the new picker UI and worth 0 points going forward — old
 * reactions are not retroactively credited.
 */
export const LEGACY_REACTION_KINDS = ['like', 'heart', 'wow'] as const

/** The honor-roll-eligible "high-tier" set — all 4 academic_skill reactions. */
export const ACADEMIC_SKILL_KINDS: ReactionKind[] = (Object.keys(REACTION_CONFIG) as ReactionKind[]).filter(
  (k) => REACTION_CONFIG[k].category === 'academic_skill'
)

/**
 * Roles whose reaction is always a 3x "Golden Multiplier" super-reaction —
 * unconditional, not a toggle. `super_admin` is included here purely for
 * consistency with this platform's usual "super_admin can do what admin can
 * do" convention, but is currently unreachable dead logic: a BARE
 * super_admin session is blocked from all Fina wall access entirely (see
 * assertPublishedAndVisible in post-social.service.ts — spec §12: "SYSADMIN
 * has zero content access"). An impersonating super_admin resolves to role
 * 'admin' before it ever reaches here (see fina-caller.ts), so it's already
 * covered via 'admin'. Kept here anyway so a future change to that access
 * guard doesn't silently leave the multiplier undefined for a bare
 * super_admin session.
 */
export const SUPER_REACTION_ROLES = ['teacher', 'admin', 'super_admin', 'fina_supervisor']

export const SUPER_REACTION_MULTIPLIER = 3

/** A post is promoted to the Wall Spotlight badge at this many academic_skill reactions. */
export const HONOR_ROLL_THRESHOLD = 5

export function isValidReactionKind(kind: string): kind is ReactionKind {
  return Object.prototype.hasOwnProperty.call(REACTION_CONFIG, kind)
}

/**
 * Points awarded for a single reaction. Returns 0 for unknown/legacy kinds
 * rather than throwing — old rows (like/heart/wow) must never crash a
 * points recomputation, they're just worth nothing going forward.
 */
export function pointsForReaction(kind: string, isSuperReaction: boolean): number {
  const entry = REACTION_CONFIG[kind as ReactionKind]
  if (!entry) return 0
  return entry.points * (isSuperReaction ? SUPER_REACTION_MULTIPLIER : 1)
}
