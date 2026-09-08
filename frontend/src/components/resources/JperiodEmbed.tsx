"use client"

// The vendored Periodic Table app (public/jperiod/) already ships a real
// Arabic translation (its own in-app Settings > Language menu lists
// "العربية" alongside English/Chinese/French/Russian/Farsi/Urdu/Tagalog —
// confirmed by inspecting the bundle) but boots to English every time and
// only switches if a user manually opens Settings and clicks a language.
// It persists the choice in `localStorage["zperiod_lang"]` (same-origin, so
// reachable from here) and only reads it once at its own startup — so we
// seed that key from Studently's site locale *before* the iframe's document
// loads, and only on a user's first-ever visit (never overwriting a language
// they already picked for themselves inside the tool).

import { useEffect, useState } from "react"
import { useLocale } from "next-intl"

const STORAGE_KEY = "zperiod_lang"

export function JperiodEmbed({ title }: { title: string }) {
    const locale = useLocale()
    const [ready, setReady] = useState(false)

    useEffect(() => {
        try {
            if (!localStorage.getItem(STORAGE_KEY)) {
                localStorage.setItem(STORAGE_KEY, locale === "ar" ? "ar" : "en")
            }
        } catch {
            // localStorage can throw in a locked-down iframe/private-mode context — the
            // embedded app just falls back to its own default (English) in that case.
        }
        setReady(true)
    }, [locale])

    return (
        <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
            {ready && (
                <iframe
                    src="/jperiod/index.html"
                    allow="fullscreen"
                    className="w-full flex-1 border-none"
                    title={title}
                />
            )}
        </div>
    )
}
