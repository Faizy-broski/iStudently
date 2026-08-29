"use client"

import { useEffect, useState } from "react"
import { getPreferredDateFormat } from "@/lib/utils/dateFormat"

/**
 * Live-updating school "Preferred Date Format" setting, read from
 * localStorage and kept in sync with same-tab changes (the
 * `preferred-date-format-changed` event, dispatched by
 * `setPreferredDateFormat()`) and other-tab changes (the native `storage`
 * event) — same pattern the sidebar's date widget uses. Pass the returned
 * pattern into `formatDateWithPreference(date, pattern)` wherever a date is
 * rendered, instead of a hardcoded format.
 */
export function usePreferredDateFormat(): string {
  const [preferredDateFormat, setPreferredDateFormat] = useState<string>(() => getPreferredDateFormat())

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      setPreferredDateFormat(typeof detail === "string" ? detail : getPreferredDateFormat())
    }
    window.addEventListener("preferred-date-format-changed", handler)
    window.addEventListener("storage", handler)
    return () => {
      window.removeEventListener("preferred-date-format-changed", handler)
      window.removeEventListener("storage", handler)
    }
  }, [])

  return preferredDateFormat
}
