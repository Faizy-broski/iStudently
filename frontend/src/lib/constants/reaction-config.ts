/**
 * Positive & Skill-Based Reaction Engine — display-only mirror of
 * backend/src/utils/reaction-config.ts. Point values here are NOT used for
 * any point math (that's always server-computed and comes back in the API
 * response) — this file only drives what the picker renders: emoji, i18n
 * key, category, and display order.
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

export interface ReactionMeta {
  kind: ReactionKind
  emoji: string
  category: ReactionCategory
  /** Key under the `fina.reactions` i18n namespace, e.g. `fina.reactions.thinker`. */
  i18nKey: string
}

export const REACTION_LIST: ReactionMeta[] = [
  { kind: 'thumbs_up', emoji: '👍', category: 'general', i18nKey: 'thumbs_up' },
  { kind: 'clap', emoji: '👏', category: 'general', i18nKey: 'clap' },
  { kind: 'bright_idea', emoji: '💡', category: 'general', i18nKey: 'bright_idea' },
  { kind: 'star', emoji: '🌟', category: 'general', i18nKey: 'star' },
  { kind: 'thinker', emoji: '🧠', category: 'academic_skill', i18nKey: 'thinker' },
  { kind: 'artistic', emoji: '🎨', category: 'academic_skill', i18nKey: 'artistic' },
  { kind: 'teamwork', emoji: '🤝', category: 'academic_skill', i18nKey: 'teamwork' },
  { kind: 'bookworm', emoji: '📖', category: 'academic_skill', i18nKey: 'bookworm' },
]

export const REACTION_BY_KIND: Record<string, ReactionMeta> = Object.fromEntries(
  REACTION_LIST.map((r) => [r.kind, r])
)

/** Roles whose reaction always renders with the golden "×3" super-reaction glow. */
export const SUPER_REACTION_ROLES = ['teacher', 'admin', 'super_admin', 'fina_supervisor']

export function getReactionEmoji(kind: string | null | undefined): string {
  if (!kind) return '👏'
  return REACTION_BY_KIND[kind]?.emoji ?? '👏'
}
