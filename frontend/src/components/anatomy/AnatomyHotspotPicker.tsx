"use client"

// Shared wrapper around the vendored OrganViewer (see OrganViewer.tsx for
// what was trimmed from upstream) for studently's "anatomy_label" quiz
// question type. Two modes share the same 3D-picking mechanics:
//
//  - "author": used by the question builder (RichTextQuestionEditor /
//    QuestionDialog) — teacher picks an organ, clicks a hotspot on it, that
//    becomes `quiz_questions.correct_answer`.
//  - "quiz": used by the student-facing QuizTaker — organ + the correct
//    hotspot are already fixed (from `correct_answer`), the student's click
//    is graded immediately with the same green/red flash the original app
//    used for its own quiz mode (HotspotLayer.flash, unchanged).
//
// Deliberately NOT reusing OrganViewer's original built-in `quizActive`
// round (see OrganViewer.tsx) — that quizzes every hotspot on the organ in
// one multi-step round with its own scoring, which doesn't match studently's
// "one quiz_questions row = one hotspot, graded independently" model.

import { useEffect, useMemo, useRef, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { OrganViewer, DEFAULT_ORGAN_VIEWER_STRINGS, type OrganViewerHandle, type OrganViewerStrings } from "./OrganViewer"
import { organStructures, type OrganId } from "@/lib/anatomy/anatomy-data"
import { buildOrgans, type Hotspot, type Organ } from "@/lib/anatomy/i18n/merge"
import { getOrganDictionary } from "@/lib/anatomy/i18n/organs"

type CommonProps = {
  /** Active UI locale for organ/hotspot names — falls back to English for any
   *  locale studently doesn't yet route (see i18n/organs/index.ts). */
  locale?: string
  strings?: OrganViewerStrings
  className?: string
}

type AuthorProps = CommonProps & {
  mode: "author"
  initialOrganId?: OrganId
  initialHotspotId?: string | null
  /** Fires whenever the teacher picks a (possibly new) organ + hotspot. */
  onChange: (value: { organId: OrganId; model: string; hotspotId: string; hotspotLabel: string } | null) => void
}

type QuizProps = CommonProps & {
  mode: "quiz"
  organId: OrganId
  correctHotspotId: string
  /** Lock out further picks once the student has answered. */
  disabled?: boolean
  onAnswered: (result: { hotspotId: string; correct: boolean }) => void
}

type Props = AuthorProps | QuizProps

const ORGAN_OPTIONS = organStructures.map((o) => o.id)

export function AnatomyHotspotPicker(props: Props) {
  const locale = props.locale ?? "en"
  const organs = useMemo<Organ[]>(() => buildOrgans(getOrganDictionary(locale)), [locale])
  const organById = useMemo(() => Object.fromEntries(organs.map((o) => [o.id, o])) as Record<OrganId, Organ>, [organs])

  const [organId, setOrganId] = useState<OrganId>(
    props.mode === "author" ? props.initialOrganId ?? ORGAN_OPTIONS[0] : props.organId,
  )
  const organ = organById[organId]

  const [autoRotate, setAutoRotate] = useState(true)
  const viewerHandle = useRef<OrganViewerHandle>(null)
  const answeredRef = useRef(false)

  // Reset per-question lock state when the quiz component is handed a new
  // question (a fresh `key` from the caller is the more common pattern, but
  // this keeps the component safe even if the parent reuses the instance).
  const questionIdentity = props.mode === "quiz" ? props.correctHotspotId : null
  useEffect(() => {
    answeredRef.current = false
  }, [questionIdentity])

  const handleHotspotSelect = (hotspot: Hotspot | null) => {
    if (!hotspot) return

    if (props.mode === "author") {
      props.onChange({ organId, model: organ.model, hotspotId: hotspot.id, hotspotLabel: hotspot.label })
      return
    }

    // Quiz mode: grade immediately, once, and flash the result — same
    // instant feedback the original app's quiz mode gave.
    if (props.disabled || answeredRef.current) return
    answeredRef.current = true
    const correct = hotspot.id === props.correctHotspotId
    viewerHandle.current?.flash(hotspot.id, correct)
    if (!correct) viewerHandle.current?.flash(props.correctHotspotId, true)
    props.onAnswered({ hotspotId: hotspot.id, correct })
  }

  if (!organ) return null

  return (
    <div className={props.className}>
      {props.mode === "author" && (
        <div className="mb-3 flex items-center gap-2">
          <Select
            value={organId}
            onValueChange={(value) => {
              const next = value as OrganId
              setOrganId(next)
              props.onChange(null) // switching organs invalidates any prior pick
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORGAN_OPTIONS.map((id) => (
                <SelectItem key={id} value={id}>{organById[id]?.name ?? id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">Click a marker on the model to set the correct answer</span>
        </div>
      )}

      <div style={{ height: 420 }}>
        <OrganViewer
          ref={viewerHandle}
          organ={organ}
          strings={props.strings ?? DEFAULT_ORGAN_VIEWER_STRINGS}
          autoRotate={autoRotate}
          onAutoRotate={setAutoRotate}
          onHotspotSelect={handleHotspotSelect}
        />
      </div>
    </div>
  )
}
