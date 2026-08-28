"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Loader2, PenLine, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog"
import { signReport } from "@/lib/api/inspection-signature"

/**
 * Shared tripartite e-signature confirmation dialog — password
 * re-confirmation (verified live against Supabase Auth server-side) + typed
 * full name, timestamped and logged. Not real WebAuthn/biometric, per the
 * confirmed design decision. Reused across the teacher/admin/inspector
 * signing pages.
 */
export function SignatureConfirmDialog({
  reportId,
  disabled,
  onSigned,
}: {
  reportId: string
  disabled?: boolean
  onSigned: () => void
}) {
  const t = useTranslations("inspections.reports")
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [typedName, setTypedName] = useState("")
  const [signing, setSigning] = useState(false)

  const handleSign = async () => {
    if (!password || !typedName.trim()) return
    setSigning(true)
    try {
      const res = await signReport(reportId, password, typedName.trim())
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t("msg_signed"))
        setOpen(false)
        setPassword("")
        setTypedName("")
        onSigned()
      }
    } finally {
      setSigning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} className="gap-2">
          <PenLine className="h-4 w-4" />
          {t("btn_sign")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#022172]" />
            {t("dialog_sign_title")}
          </DialogTitle>
          <DialogDescription>{t("dialog_sign_desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>{t("field_typed_name")}</Label>
            <Input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder={t("field_typed_name_placeholder")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("field_password")}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("field_password_placeholder")} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSign} disabled={signing || !password || !typedName.trim()} className="gap-2">
            {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
            {t("btn_confirm_sign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
