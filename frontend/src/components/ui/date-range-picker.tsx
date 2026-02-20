"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  from?: string
  to?: string
  onFromChange: (value: string | undefined) => void
  onToChange: (value: string | undefined) => void
  className?: string
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  className,
}: DateRangePickerProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <CalendarDays className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <input
          type="date"
          value={from || ''}
          onChange={(e) => onFromChange(e.target.value || undefined)}
          className="flex-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#022172] focus:border-[#022172]"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-400 w-3.5 text-center shrink-0">to</span>
        <input
          type="date"
          value={to || ''}
          min={from || undefined}
          onChange={(e) => onToChange(e.target.value || undefined)}
          className="flex-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#022172] focus:border-[#022172]"
        />
      </div>
    </div>
  )
}

