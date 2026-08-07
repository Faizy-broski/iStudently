'use client'

import { ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  id: string
  label: string
}

interface MultiSelectPopoverProps {
  options: MultiSelectOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder: string
  emptyMessage?: string
  disabled?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  className?: string
}

export function MultiSelectPopover({
  options,
  selectedIds,
  onChange,
  placeholder,
  emptyMessage,
  disabled,
  open,
  onOpenChange,
  className,
}: MultiSelectPopoverProps) {
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id])
  }

  return (
    <Popover open={open && !disabled} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between h-auto min-h-10 font-normal', className)}
        >
          <div className="flex flex-wrap gap-1 flex-1 items-center">
            {selectedIds.length > 0 ? (
              options
                .filter(o => selectedIds.includes(o.id))
                .map(o => (
                  <Badge key={o.id} variant="secondary" className="whitespace-nowrap">
                    {o.label}
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        onChange(selectedIds.filter(id => id !== o.id))
                      }}
                      className="ml-1 rounded-full hover:bg-black/10 cursor-pointer inline-flex shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </Badge>
                ))
            ) : (
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="max-h-64 overflow-auto p-2">
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground italic p-2">{emptyMessage}</p>
          ) : (
            options.map(o => {
              const checked = selectedIds.includes(o.id)
              return (
                <div
                  key={o.id}
                  className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                  onClick={() => toggle(o.id)}
                >
                  <Checkbox checked={checked} onCheckedChange={() => {}} />
                  <label className="flex-1 cursor-pointer text-sm">{o.label}</label>
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
