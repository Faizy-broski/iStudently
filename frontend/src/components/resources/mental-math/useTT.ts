"use client"

// Shared inline bilingual-text helper for the whole Mental Math tool family —
// matches the pattern already established by MentalMath.tsx's header comment
// (same convention as InteractiveGeometry/CircuitSimulator): no next-intl
// message namespace for this component family's internal UI strings.

import { useLocale } from "next-intl"

export function useTT() {
  const locale = useLocale()
  const isAr = locale === "ar"
  return (en: string, ar: string) => (isAr ? ar : en)
}
