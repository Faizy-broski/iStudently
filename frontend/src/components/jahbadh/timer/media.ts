"use client"

import { useEffect, useRef, useState } from "react"

import type { JtAlertKey, JtLang, JtVoice } from "@/lib/jahbadh"
import { beep } from "../control/ScanInput"

// Browser side of the exam timer: voice alerts, recorded clips, screen wake lock and the noise meter.
// Everything works offline once the page is loaded; recorded clips stay in this browser.

const CLIP_KEY = (k: JtAlertKey) => `jahbadh-exam-timer-clip:${k}`
export const JT_CLIP_KEYS: JtAlertKey[] = ["start", "left_30", "left_15", "left_5", "left_1", "exit", "end"]

export function loadClip(k: JtAlertKey): string | null {
  try {
    return window.localStorage.getItem(CLIP_KEY(k))
  } catch {
    return null
  }
}

/** Stores a recorded clip (data URL, up to ~1.5 MB) for one alert; null removes it. */
export async function saveClip(k: JtAlertKey, file: File | null): Promise<boolean> {
  try {
    if (!file) {
      window.localStorage.removeItem(CLIP_KEY(k))
      return true
    }
    if (file.size > 1_500_000) return false
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(file)
    })
    window.localStorage.setItem(CLIP_KEY(k), url)
    return true
  } catch {
    return false
  }
}

export function speak(text: string, lang: JtLang) {
  try {
    const synth = window.speechSynthesis
    if (!synth) return beep(true)
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === "ar" ? "ar-SA" : "en-US"
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang))
    if (voice) u.voice = voice
    u.rate = 0.95
    synth.speak(u)
  } catch {
    beep(true)
  }
}

/** Plays one alert with the chosen voice (clips fall back to speech when none is recorded). */
export function playAlert(voice: JtVoice, key: JtAlertKey, text: string, lang: JtLang) {
  if (voice === "off") return
  if (voice === "beep") return beep(key !== "end")
  if (voice === "clips") {
    const clip = loadClip(key)
    if (clip) {
      void new Audio(clip).play().catch(() => speak(text, lang))
      return
    }
  }
  speak(text, lang)
}

type WakeLockSentinel = { release: () => Promise<void> }

/** Keeps the screen on while `on` (Screen Wake Lock API; re-acquired when the tab is shown again). */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on) return
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } }
    if (!nav.wakeLock) return
    let lock: WakeLockSentinel | null = null
    const take = () => nav.wakeLock!.request("screen").then((l) => (lock = l)).catch(() => undefined)
    void take()
    const onVisible = () => document.visibilityState === "visible" && void take()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      void lock?.release().catch(() => undefined)
    }
  }, [on])
}

/** Microphone level 0–100 (optional noise meter); null while off or refused. */
export function useNoiseLevel(on: boolean) {
  const [level, setLevel] = useState<number | null>(null)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (!on) return
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let stopped = false
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        ctx.createMediaStreamSource(s).connect(analyser)
        const buf = new Float32Array(analyser.fftSize)
        let last = 0
        const loop = (ts: number) => {
          analyser.getFloatTimeDomainData(buf)
          let sum = 0
          for (const v of buf) sum += v * v
          const rms = Math.sqrt(sum / buf.length)
          if (ts - last > 200) {
            last = ts
            setLevel(Math.min(100, Math.round(rms * 400)))
          }
          raf.current = requestAnimationFrame(loop)
        }
        raf.current = requestAnimationFrame(loop)
      })
      .catch(() => setLevel(null))
    return () => {
      stopped = true
      if (raf.current) cancelAnimationFrame(raf.current)
      stream?.getTracks().forEach((t) => t.stop())
      void ctx?.close()
      setLevel(null)
    }
  }, [on])
  return on ? level : null
}
