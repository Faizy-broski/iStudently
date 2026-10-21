"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Camera, ScanLine } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { JC_QR_LENGTH, qrPrecheck, type JcQrKindCode } from "@/lib/jahbadh"
import { cn } from "@/lib/utils"

export type ScanOutcome = { ok: boolean; message?: string }

/** Short confirmation tone (Web Audio; no files). */
export function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = ok ? 880 : 220
    gain.gain.value = 0.08
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.35))
    osc.onended = () => void ctx.close()
  } catch {
    // audio is optional
  }
}

/** Message for a scan error code (local pre-check or server). */
export function useScanError() {
  const t = useTranslations("examControl")
  const known = ["format", "prefix", "kind", "length", "check", "signature", "session", "unknown_secret", "unknown_seat", "not_today"]
  return (code: string | undefined, fallback?: string) => {
    const k = (code ?? "").replace(/^scan_/, "")
    return known.includes(k) ? t(`scanErr_${k}`) : fallback ?? t("scanErr_format")
  }
}

/**
 * Scan input (C7.4): an autofocused field for keyboard-wedge QR scanners (a fast burst of digits and
 * Enter) or typing. Codes are pre-checked here (prefix, kind, length, check digit) so partial or
 * misread input never reaches the server; the server checks the session and the signature.
 * With `allowPlain`, a short number (a secret or seat typed by hand) goes to `onPlain`.
 */
export function ScanInput({
  expect,
  onScan,
  onPlain,
  placeholder,
  camera,
  inputRef,
  autoFocus = true,
  className,
}: {
  expect: JcQrKindCode
  onScan: (digits: string) => Promise<ScanOutcome>
  onPlain?: (digits: string) => Promise<ScanOutcome> | ScanOutcome
  placeholder?: string
  camera?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
  autoFocus?: boolean
  className?: string
}) {
  const t = useTranslations("examControl")
  const errText = useScanError()
  const own = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? own
  const [value, setValue] = useState("")
  const [flash, setFlash] = useState<{ ok: boolean; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [cam, setCam] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastKey = useRef(0)
  const burst = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cameraOk] = useState(() => cameraScanSupported())

  const show = (ok: boolean, message: string) => {
    beep(ok)
    setFlash({ ok, message })
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), ok ? 1500 : 4000)
  }

  const submit = async (raw: string) => {
    const digits = raw.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "")
    setValue("")
    if (!digits) return
    setBusy(true)
    try {
      let out: ScanOutcome
      if (onPlain && digits.length < 13) out = await onPlain(digits)
      else {
        const pre = qrPrecheck(digits, expect)
        out = pre.ok ? await onScan(pre.digits) : { ok: false, message: errText(pre.reason) }
      }
      show(out.ok, out.message ?? (out.ok ? t("scanOk") : t("scanErr_format")))
    } finally {
      setBusy(false)
      ref.current?.focus()
    }
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <ScanLine className="pointer-events-none absolute start-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            ref={ref}
            autoFocus={autoFocus}
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            className={cn("ps-8 font-mono transition-colors", flash && (flash.ok ? "border-success bg-success/10" : "border-destructive bg-destructive/10"))}
            placeholder={placeholder ?? t("scanHint")}
            value={value}
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value
              const now = Date.now()
              const fast = now - lastKey.current < 60
              lastKey.current = now
              setValue(v)
              // Scanners set up without an Enter suffix: a complete, valid code typed in a burst submits itself.
              if (burst.current) clearTimeout(burst.current)
              if (fast && v.length === JC_QR_LENGTH[expect] && qrPrecheck(v, expect).ok) burst.current = setTimeout(() => void submit(v), 120)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                if (burst.current) clearTimeout(burst.current)
                void submit(value)
              }
            }}
          />
        </div>
        {camera && cameraOk ? (
          <Button type="button" variant="outline" size="icon" aria-label={t("scanCamera")} onClick={() => setCam(true)}>
            <Camera className="size-4" />
          </Button>
        ) : null}
      </div>
      {flash ? <p className={cn("text-xs font-medium", flash.ok ? "text-success" : "text-destructive")}>{flash.message}</p> : null}
      {camera && cameraOk ? <CameraScan open={cam} onOpenChange={setCam} onCode={(c) => { setCam(false); void submit(c) }} /> : null}
    </div>
  )
}

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

/** Camera fallback (C7.2) with the browser's BarcodeDetector (Chrome, Edge, Android); hidden elsewhere. */
export const cameraScanSupported = () => typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia

function CameraScan({ open, onOpenChange, onCode }: { open: boolean; onOpenChange: (o: boolean) => void; onCode: (code: string) => void }) {
  const t = useTranslations("examControl")
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    let stream: MediaStream | null = null
    let stop = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const run = async () => {
      try {
        if (!cameraScanSupported()) throw new Error(t("cameraUnsupported"))
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        if (!video.current) return
        video.current.srcObject = stream
        await video.current.play()
        const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector
        const detector = new Ctor({ formats: ["qr_code"] })
        const loop = async () => {
          if (stop || !video.current) return
          const found = await detector.detect(video.current).catch(() => [])
          if (found[0]?.rawValue) return onCode(found[0].rawValue)
          timer = setTimeout(loop, 250)
        }
        void loop()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    }
    void run()
    return () => {
      stop = true
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((tr) => tr.stop())
    }
  }, [open, onCode, t])
  return (
    <Dialog open={open} onOpenChange={(o) => { setError(null); onOpenChange(o) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("scanCamera")}</DialogTitle>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : <video ref={video} className="aspect-square w-full rounded-md bg-muted object-cover" muted playsInline />}
      </DialogContent>
    </Dialog>
  )
}
