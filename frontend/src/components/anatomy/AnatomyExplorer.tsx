"use client"

// Read-only "explore" wrapper around the vendored OrganViewer, for viewing a
// single organ from a Learning Resources entry — a teacher pulls this up to
// explain the human body, or a student browses it on their own. No grading,
// no "correct answer": clicking a hotspot just shows its name via
// OrganViewer's own built-in callout (unchanged from upstream), same as
// AnatomyHotspotPicker's author/quiz modes get for free — this is a third,
// simpler mode that doesn't need organ-switching or a onChange/onAnswered
// callback at all, since the resource already fixes one organ.

import { useMemo, useState } from "react"
import { OrganViewer, DEFAULT_ORGAN_VIEWER_STRINGS, type OrganViewerStrings } from "./OrganViewer"
import type { OrganId } from "@/lib/anatomy/anatomy-data"
import { buildOrgans } from "@/lib/anatomy/i18n/merge"
import { getOrganDictionary } from "@/lib/anatomy/i18n/organs"

type Props = {
  organId: OrganId
  /** Active UI locale for organ/hotspot names — falls back to English for any
   *  locale studently doesn't yet route (see i18n/organs/index.ts). */
  locale?: string
  strings?: OrganViewerStrings
  className?: string
  /** Fixed height in px for the viewer canvas — callers size this to their dialog/card. */
  height?: number
}

export function AnatomyExplorer({ organId, locale = "en", strings, className, height = 420 }: Props) {
  const organs = useMemo(() => buildOrgans(getOrganDictionary(locale)), [locale])
  const organ = organs.find((o) => o.id === organId)
  const [autoRotate, setAutoRotate] = useState(true)

  if (!organ) return null

  return (
    <div className={className} style={{ height }}>
      <OrganViewer
        organ={organ}
        strings={strings ?? DEFAULT_ORGAN_VIEWER_STRINGS}
        autoRotate={autoRotate}
        onAutoRotate={setAutoRotate}
        onHotspotSelect={() => {}}
      />
    </div>
  )
}
