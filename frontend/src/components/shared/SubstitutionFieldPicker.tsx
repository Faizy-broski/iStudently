'use client'

/**
 * Reusable Rosario SIS-style substitution field picker.
 *
 * Layout (matches Rosario):
 * [ Select Field v ] [ __TOKEN__ / {{token}} ] [ INSERT ] [ COPY ]
 * Substitutions ℹ️ (Variables are personalized per recipient at send/read time)
 */
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Copy, Plus, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SubstitutionGroup, SubstitutionField } from '@/lib/substitution-fields'

export interface SubstitutionFieldPickerProps {
  groups?: SubstitutionGroup[]
  fields?: SubstitutionField[]
  onInsert: (token: string) => void
  onCopy?: (token: string) => void
  placeholder?: string
  substitutionsLabel?: string
  infoText?: string
}

export function SubstitutionFieldPicker({
  groups,
  fields,
  onInsert,
  onCopy,
  substitutionsLabel = 'Substitutions',
  infoText = 'Personalization variables will be replaced with each recipient\'s actual information.',
}: SubstitutionFieldPickerProps) {
  // Normalize items to groups if flat fields passed
  const effectiveGroups: SubstitutionGroup[] = useMemo(() => {
    return groups || (fields ? [{ label: 'Fields', fields }] : [])
  }, [groups, fields])

  const initialValue = effectiveGroups[0]?.fields[0]?.id || ''
  const [selected, setSelected] = useState<string>(initialValue)

  const handleInsert = () => {
    if (!selected) return
    onInsert(selected)
    toast.success(`Inserted ${selected}`)
  }

  const handleCopy = () => {
    if (!selected) return
    if (onCopy) {
      onCopy(selected)
    } else {
      navigator.clipboard.writeText(selected)
    }
    toast.success(`Copied ${selected} to clipboard`)
  }

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-9 w-48 sm:w-56 text-sm bg-background border border-input rounded-md px-2.5 py-1.5 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
        >
          {effectiveGroups.map((group) =>
            effectiveGroups.length > 1 ? (
              <optgroup key={group.label} label={group.label}>
                {group.fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              group.fields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))
            )
          )}
        </select>

        <Input
          readOnly
          value={selected}
          className="h-9 w-44 sm:w-52 font-mono text-xs bg-muted/50 cursor-text select-all"
          placeholder="Token"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />

        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-9 px-3 text-xs gap-1.5 bg-[#022172] hover:bg-[#022172]/90 text-white font-medium"
          disabled={!selected}
          onClick={handleInsert}
        >
          <Plus className="h-3.5 w-3.5" />
          Insert
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 px-3 text-xs gap-1.5 font-medium border-muted-foreground/30 hover:bg-muted"
          disabled={!selected}
          onClick={handleCopy}
        >
          <Copy className="h-3.5 w-3.5" />
          COPY
        </Button>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium pl-0.5">
        <span className="text-foreground/80 font-semibold">{substitutionsLabel}</span>
        <span title={infoText} className="inline-flex items-center cursor-help text-[#57A3CC]">
          <Info className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  )
}
