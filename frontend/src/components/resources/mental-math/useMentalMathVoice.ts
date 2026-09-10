"use client"

// Arabic text-to-speech via the browser's Web Speech API — used by Anzan
// (flash mode) and Dictation. Pure client-side, zero new dependency, same
// API the reference app uses. Degrades gracefully when no Arabic voice is
// installed (common on some Windows/Linux setups) instead of silently
// failing or speaking in the wrong language.

import { useEffect, useState, useCallback } from "react"

export function useMentalMathVoice() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceName, setVoiceName] = useState<string>("")
  const [rate, setRate] = useState(1)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false)
      return
    }
    const load = () => {
      const all = window.speechSynthesis.getVoices() || []
      const arabic = all.filter((v) => v.lang?.toLowerCase().startsWith("ar"))
      setVoices(arabic)
      setVoiceName((prev) => prev || arabic[0]?.name || "")
    }
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  const ready = supported && voices.length > 0

  const speak = useCallback(
    (text: string, rateOverride?: number) => {
      if (!ready) return false
      try {
        const utter = new SpeechSynthesisUtterance(text)
        const voice = voices.find((v) => v.name === voiceName) || voices[0]
        utter.voice = voice
        utter.lang = voice?.lang || "ar-SA"
        utter.rate = rateOverride ?? rate
        window.speechSynthesis.speak(utter)
        return true
      } catch {
        return false
      }
    },
    [ready, voices, voiceName, rate]
  )

  const cancel = useCallback(() => {
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* no-op */
    }
  }, [])

  return { voices, voiceName, setVoiceName, rate, setRate, ready, supported, speak, cancel }
}
