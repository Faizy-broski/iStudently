'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Target } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/context/AuthContext'
import { listClassGoals, createClassGoal, getComposerOptions, type FinaClassGoal, type ReactionKind } from '@/lib/api/fina-posts'
import { REACTION_LIST } from '@/lib/constants/reaction-config'

/**
 * Positive & Skill-Based Reaction Engine — Class Goal Engine widget.
 * Deliberately minimal per the plan (no dedicated page/route): a compact
 * progress list plus an inline creation form, visible to teacher/admin only
 * — the section this widget lives in mirrors post.routes.ts's COMPOSE_ROLES
 * gate on the create-goal endpoint itself.
 */
export function ClassGoalsWidget() {
  const t = useTranslations('fina.wall')
  const tReactions = useTranslations('fina.reactions')
  const { profile } = useAuth()
  const canManage = !!profile && ['teacher', 'admin'].includes(profile.role)

  const [goals, setGoals] = useState<FinaClassGoal[] | null>(null)
  const [gradeLevels, setGradeLevels] = useState<{ id: string; name: string }[]>([])
  const [sections, setSections] = useState<{ id: string; name: string; gradeLevelId: string | null }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [gradeLevelId, setGradeLevelId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [reactionKind, setReactionKind] = useState<ReactionKind>('star')
  const [targetCount, setTargetCount] = useState(100)
  const [saving, setSaving] = useState(false)

  const load = () => listClassGoals().then((res) => setGoals(res.data ?? []))

  useEffect(() => {
    if (!canManage) return
    load()
    getComposerOptions().then((res) => {
      setGradeLevels(res.data?.gradeLevels ?? [])
      setSections(res.data?.sections ?? [])
    })
  }, [canManage])

  if (!canManage) return null

  const sectionsForGrade = gradeLevelId ? sections.filter((s) => s.gradeLevelId === gradeLevelId) : sections

  // Section is optional — picking just a grade level targets every section
  // under it (see migration 303). Required a section on top of the grade
  // before, which left "New goal" permanently disabled whenever a grade's
  // section list came back empty (no sections yet, or none visible in the
  // caller's resolved scope) with no way to tell why.
  const handleCreate = async () => {
    if (!gradeLevelId || targetCount <= 0) return
    setSaving(true)
    try {
      await createClassGoal(sectionId ? { sectionId, reactionKind, targetCount } : { gradeLevelId, reactionKind, targetCount })
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Target className="h-4 w-4 text-amber-500" />{t('class_goals_title')}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setShowForm((s) => !s)} className="h-7 gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" />{t('class_goal_create')}
          </Button>
        </div>

        {showForm && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-gray-50 p-2">
            <Select
              value={gradeLevelId}
              onValueChange={(v) => { setGradeLevelId(v); setSectionId('') }}
            >
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder={t('class_goal_grade_placeholder')} /></SelectTrigger>
              <SelectContent>
                {gradeLevels.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sectionId} onValueChange={setSectionId} disabled={!gradeLevelId || sectionsForGrade.length === 0}>
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue placeholder={sectionsForGrade.length === 0 ? t('class_goal_whole_grade') : t('class_goal_section_optional_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {sectionsForGrade.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={reactionKind} onValueChange={(v) => setReactionKind(v as ReactionKind)}>
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue>{REACTION_LIST.find((r) => r.kind === reactionKind)?.emoji}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {REACTION_LIST.map((r) => <SelectItem key={r.kind} value={r.kind}>{r.emoji} {tReactions(r.i18nKey)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
              className="h-8 w-20 text-xs"
            />
            <Button size="sm" className="h-8 text-xs" disabled={saving || !gradeLevelId} onClick={handleCreate}>
              {t('class_goal_create')}
            </Button>
          </div>
        )}

        {goals === null ? null : goals.length === 0 ? (
          <p className="text-xs text-gray-400">{t('class_goals_empty')}</p>
        ) : (
          <div className="space-y-2">
            {goals.map((g) => {
              const meta = REACTION_LIST.find((r) => r.kind === g.reaction_kind)
              const pct = Math.min(100, Math.round((g.currentCount / g.target_count) * 100))
              const reached = g.currentCount >= g.target_count
              return (
                <div key={g.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>
                      {g.section_id
                        ? sections.find((s) => s.id === g.section_id)?.name ?? g.section_id
                        : gradeLevels.find((gl) => gl.id === g.grade_level_id)?.name ?? g.grade_level_id}
                      {' · '}{meta?.emoji} {meta ? tReactions(meta.i18nKey) : g.reaction_kind}
                    </span>
                    <span className="font-medium">{g.currentCount}/{g.target_count}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${reached ? 'bg-amber-400' : 'bg-brand-blue'}`} style={{ width: `${pct}%` }} />
                  </div>
                  {reached && <p className="text-[11px] text-amber-600">{t('class_goal_target_reached')}</p>}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
