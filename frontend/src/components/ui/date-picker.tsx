"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
}: DatePickerProps) {
  // Convert Date to YYYY-MM-DD format for input
  const dateValue = value ? value.toISOString().split('T')[0] : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = e.target.value;
    if (dateString) {
      // Create date at noon UTC to avoid timezone issues
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day, 12, 0, 0);
      onChange(date);
    } else {
      onChange(undefined);
    }
  };

  return (
    <Input
      type="date"
      value={dateValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn("w-full", className)}
    />
  );
}
