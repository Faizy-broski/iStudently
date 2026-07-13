"use client"

import * as React from "react"
import { Copy, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  copySchoolSettings,
  type CopySchoolSettingsOptions,
  type CopySchoolSettingsResult,
} from "@/lib/api/schools"

/** Minimal shape needed for the source-school picker — decoupled from any specific School type. */
export interface CopySettingsSchoolOption {
  id: string
  name: string
}

interface CopySchoolSettingsDialogProps {
  targetSchoolId: string
  targetSchoolName: string
  /** Schools the current user is allowed to copy settings FROM (super admin: all schools; admin: their own schools). */
  sourceSchoolOptions: CopySettingsSchoolOption[]
  /** Uncontrolled by default (own trigger button); pass these to control it externally (e.g. auto-open after creation). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Hide the built-in trigger button when the dialog is externally controlled. */
  hideTrigger?: boolean
}

const CATEGORIES: { key: keyof CopySchoolSettingsOptions; label: string; defaultChecked: boolean; note?: string }[] = [
  { key: "gradeLevels", label: "Grade Levels & Sections", defaultChecked: true },
  { key: "periods", label: "Timetable Periods", defaultChecked: true },
  { key: "gradingScales", label: "Grading Scales", defaultChecked: true },
  { key: "defaultFieldOrders", label: "Default Field Order & Required Settings", defaultChecked: true },
  { key: "customFields", label: "Custom Fields", defaultChecked: true },
  {
    key: "markingPeriods",
    label: "Marking Periods (Quarters/Semesters)",
    defaultChecked: false,
    note: "Copies the structure only — dates are left blank and must be set for the new school.",
  },
]

const COUNT_LABELS: Record<keyof CopySchoolSettingsResult["counts"], string> = {
  gradeLevels: "grade levels",
  sections: "sections",
  periods: "periods",
  gradingScales: "grading scales",
  defaultFieldOrders: "default field settings",
  customFields: "custom fields",
  markingPeriods: "marking periods",
}

export function CopySchoolSettingsDialog({
  targetSchoolId,
  targetSchoolName,
  sourceSchoolOptions,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: CopySchoolSettingsDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v)
    if (!isControlled) setUncontrolledOpen(v)
  }

  const [sourceSchoolId, setSourceSchoolId] = React.useState("")
  const [selected, setSelected] = React.useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map((c) => [c.key, c.defaultChecked]))
  )
  const [copying, setCopying] = React.useState(false)
  const [result, setResult] = React.useState<CopySchoolSettingsResult | null>(null)

  const reset = () => {
    setSourceSchoolId("")
    setSelected(Object.fromEntries(CATEGORIES.map((c) => [c.key, c.defaultChecked])))
    setResult(null)
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) reset()
    setOpen(v)
  }

  const handleCopy = async () => {
    if (!sourceSchoolId) {
      toast.error("Select a school to copy settings from")
      return
    }
    const options: CopySchoolSettingsOptions = Object.fromEntries(
      CATEGORIES.map((c) => [c.key, !!selected[c.key]])
    )
    setCopying(true)
    try {
      const res = await copySchoolSettings(targetSchoolId, sourceSchoolId, options)
      if (res.success && res.data) {
        setResult(res.data)
        if (res.data.errors.length === 0) {
          toast.success("Settings copied successfully")
        } else {
          toast.warning("Settings copied with some errors — see details below")
        }
      } else {
        toast.error(res.error || "Failed to copy settings")
      }
    } finally {
      setCopying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setOpen(true)}>
          <Copy className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">Copy Settings</span>
        </Button>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Settings into &quot;{targetSchoolName}&quot;</DialogTitle>
          <DialogDescription>
            Copy grades, periods, and other setup from an existing school instead of creating them from scratch.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Copy settings from</Label>
              <Select value={sourceSchoolId} onValueChange={setSourceSchoolId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a school..." />
                </SelectTrigger>
                <SelectContent>
                  {sourceSchoolOptions
                    .filter((s) => s.id !== targetSchoolId)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {sourceSchoolOptions.filter((s) => s.id !== targetSchoolId).length === 0 && (
                <p className="text-xs text-muted-foreground">No other schools available to copy from.</p>
              )}
            </div>

            <div className="space-y-2.5">
              <Label>What to copy</Label>
              {CATEGORIES.map((cat) => (
                <div key={cat.key} className="flex items-start gap-2">
                  <Checkbox
                    id={`copy-${cat.key}`}
                    checked={!!selected[cat.key]}
                    onCheckedChange={(c) => setSelected((prev) => ({ ...prev, [cat.key]: !!c }))}
                    className="mt-0.5"
                  />
                  <div>
                    <Label htmlFor={`copy-${cat.key}`} className="text-sm font-normal cursor-pointer">
                      {cat.label}
                    </Label>
                    {cat.note && <p className="text-xs text-muted-foreground">{cat.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              )}
              <p className="text-sm font-medium">
                {result.errors.length === 0 ? "Settings copied" : "Copied with some errors"}
              </p>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              {Object.entries(result.counts)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => (
                  <li key={key}>
                    {count} {COUNT_LABELS[key as keyof CopySchoolSettingsResult["counts"]]}
                  </li>
                ))}
            </ul>
            {result.errors.length > 0 && (
              <ul className="text-xs text-destructive space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button onClick={handleCopy} disabled={copying || !sourceSchoolId}>
                {copying ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Copying...</> : "Copy Settings"}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
