"use client"

import * as React from "react"
import { Calendar as CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DateTimePickerProps {
  value?: string | null
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  className,
}: DateTimePickerProps) {
  // Convert local input string "YYYY-MM-DDTHH:mm" to Date object
  const dateValue = React.useMemo(() => {
    if (!value) return undefined
    const [datePart, timePart] = value.split('T')
    if (!datePart) return undefined
    const [year, month, day] = datePart.split('-').map(Number)
    const [hours, minutes] = (timePart || "00:00").split(':').map(Number)
    return new Date(year, month - 1, day, hours || 0, minutes || 0)
  }, [value])

  const handleDateSelect = (d: Date | undefined) => {
    if (!d) return
    const newDate = new Date(d)
    if (dateValue) {
      newDate.setHours(dateValue.getHours())
      newDate.setMinutes(dateValue.getMinutes())
    }
    emitChange(newDate)
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value
    if (!time || !dateValue) return
    const [hours, minutes] = time.split(':')
    const newDate = new Date(dateValue)
    newDate.setHours(parseInt(hours, 10, 10))
    newDate.setMinutes(parseInt(minutes, 10, 10))
    emitChange(newDate)
  }

  const emitChange = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal px-3",
            !dateValue && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">
            {dateValue ? format(dateValue, "PPP HH:mm") : placeholder}
          </span>
          {dateValue && (
            <div
              className="ml-auto text-muted-foreground hover:text-foreground p-1 -mr-1"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
            >
              <X className="h-3 w-3" />
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleDateSelect}
          initialFocus
          className="min-w-[280px]"
        />
        <div className="p-3 border-t border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <Label htmlFor="time" className="text-xs font-semibold uppercase text-muted-foreground">Time</Label>
            <Input
              id="time"
              type="time"
              value={dateValue ? format(dateValue, "HH:mm") : ""}
              onChange={handleTimeChange}
              disabled={!dateValue}
              className="h-8 flex-1"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
