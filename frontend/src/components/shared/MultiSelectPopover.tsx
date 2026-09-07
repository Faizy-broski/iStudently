'use client'

import { ChevronsUpDown, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
  const tCommon = useTranslations('common')
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id])
  }
  const allSelected = options.length > 0 && selectedIds.length === options.length
  const toggleAll = () => {
    onChange(allSelected ? [] : options.map(o => o.id))
  }

  const selectedOptions = options.filter(o => selectedIds.includes(o.id))
  const firstSelected = selectedOptions[0]

  return (
    <Popover open={open && !disabled} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between h-9 px-3 font-normal overflow-hidden', className)}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden text-left rtl:text-right">
            {selectedIds.length === 0 ? (
              <span className="text-muted-foreground text-sm truncate">{placeholder}</span>
            ) : allSelected ? (
              <Badge variant="secondary" className="text-xs font-normal truncate px-1.5 py-0.5">
                {placeholder ? `${placeholder}: ` : ''}{tCommon('selectAll') || 'All'} ({selectedIds.length})
              </Badge>
            ) : selectedIds.length === 1 ? (
              <Badge variant="secondary" className="text-xs font-normal truncate px-1.5 py-0.5 max-w-full">
                <span className="truncate">{firstSelected?.label}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange([])
                  }}
                  className="ml-1 rtl:mr-1 rtl:ml-0 rounded-full hover:bg-black/10 dark:hover:bg-white/20 cursor-pointer inline-flex shrink-0"
                >
                  <X className="h-3 w-3" />
                </span>
              </Badge>
            ) : (
              <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                <Badge variant="secondary" className="text-xs font-normal truncate px-1.5 py-0.5 max-w-[100px]">
                  <span className="truncate">{firstSelected?.label}</span>
                </Badge>
                <Badge variant="outline" className="text-xs font-normal px-1 py-0 shrink-0">
                  +{selectedIds.length - 1}
                </Badge>
              </div>
            )}
          </div>
          <ChevronsUpDown className="ml-1.5 rtl:mr-1.5 rtl:ml-0 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="max-h-64 overflow-auto p-2">
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground italic p-2">{emptyMessage}</p>
          ) : (
            <>
              <div
                className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer border-b mb-1"
                onClick={toggleAll}
              >
                <Checkbox checked={allSelected} onCheckedChange={() => {}} />
                <label className="flex-1 cursor-pointer text-sm font-medium">{tCommon('selectAll')}</label>
              </div>
              {options.map(o => {
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
              })}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
