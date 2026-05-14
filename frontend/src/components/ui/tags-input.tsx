"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagsInput({ value, onChange, placeholder = "Type and press Enter", className }: TagsInputProps) {
  const [inputValue, setInputValue] = React.useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      if (!value.includes(inputValue.trim())) {
        onChange([...value, inputValue.trim()]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className={`flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px] ${className}`}>
      {value.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="bg-gradient-to-r from-[#57A3CC]/20 to-[#022172]/20 text-[#022172] border border-[#57A3CC]/30"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-1 rounded-full hover:bg-[#022172]/20"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-w-[120px] p-0 h-6"
      />
    </div>
  );
}
