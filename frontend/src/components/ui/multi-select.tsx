"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleToggle = (option: string) => {
    const newValue = value.includes(option)
      ? value.filter((v) => v !== option)
      : [...value, option];
    onChange(newValue);
  };

  const handleRemove = (option: string) => {
    onChange(value.filter((v) => v !== option));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between ${className}`}
          type="button"
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {value.length > 0 ? (
              value.map((item) => (
                <Badge
                  key={item}
                  variant="secondary"
                  className="bg-gradient-to-r from-[#57A3CC]/20 to-[#022172]/20 text-[#022172] border border-[#57A3CC]/30"
                >
                  {item}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(item);
                    }}
                    className="ml-1 rounded-full hover:bg-[#022172]/20 cursor-pointer inline-flex"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="max-h-64 overflow-auto">
          {options && options.length > 0 ? (
            <div className="p-2">
              {options.map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                  onClick={() => handleToggle(option)}
                >
                  <Checkbox
                    checked={value.includes(option)}
                    onCheckedChange={() => handleToggle(option)}
                  />
                  <label className="flex-1 cursor-pointer text-sm">
                    {option}
                    {value.includes(option) && (
                      <Check className="ml-2 h-4 w-4 inline" />
                    )}
                  </label>
                </div>
              ))}
              {value.length > 0 && (
                <div className="p-2 border-t mt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="w-full"
                  >
                    Clear all
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No options available. Please add options in custom fields settings.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
