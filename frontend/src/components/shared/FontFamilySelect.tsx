'use client'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DESIGN_FONTS } from '@/config/design-fonts'

interface FontFamilySelectProps {
  value?: string
  onValueChange: (value: string) => void
}

const ENGLISH_FONTS = DESIGN_FONTS.filter((f) => f.lang === 'en')
const ARABIC_FONTS = DESIGN_FONTS.filter((f) => f.lang === 'ar')

export function FontFamilySelect({ value, onValueChange }: FontFamilySelectProps) {
  return (
    <Select value={value || 'default'} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">Default</SelectItem>
        <SelectGroup>
          <SelectLabel>English</SelectLabel>
          {ENGLISH_FONTS.map((font) => (
            <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
              {font.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Arabic</SelectLabel>
          {ARABIC_FONTS.map((font) => (
            <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
              {font.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
