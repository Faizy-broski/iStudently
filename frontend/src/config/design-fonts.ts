'use client'

import { useEffect } from 'react'

// Fonts selectable for text fields in the ID Card and Certificate template
// designers. `googleFamily` is the Google Fonts CSS2 API family segment
// (including weights) used to build the stylesheet URL; `value` is the CSS
// font-family declaration applied to the field.
export interface DesignFontOption {
  label: string
  value: string
  googleFamily: string
  lang: 'en' | 'ar'
}

export const DESIGN_FONTS: DesignFontOption[] = [
  // English
  { label: 'Inter', value: "'Inter', sans-serif", googleFamily: 'Inter:wght@400;500;600;700', lang: 'en' },
  { label: 'Roboto', value: "'Roboto', sans-serif", googleFamily: 'Roboto:wght@400;500;700', lang: 'en' },
  { label: 'Poppins', value: "'Poppins', sans-serif", googleFamily: 'Poppins:wght@400;500;600;700', lang: 'en' },
  { label: 'Montserrat', value: "'Montserrat', sans-serif", googleFamily: 'Montserrat:wght@400;500;600;700', lang: 'en' },
  { label: 'Open Sans', value: "'Open Sans', sans-serif", googleFamily: 'Open+Sans:wght@400;600;700', lang: 'en' },
  { label: 'Lato', value: "'Lato', sans-serif", googleFamily: 'Lato:wght@400;700', lang: 'en' },
  { label: 'Playfair Display', value: "'Playfair Display', serif", googleFamily: 'Playfair+Display:wght@400;600;700', lang: 'en' },
  { label: 'Merriweather', value: "'Merriweather', serif", googleFamily: 'Merriweather:wght@400;700', lang: 'en' },
  { label: 'Dancing Script', value: "'Dancing Script', cursive", googleFamily: 'Dancing+Script:wght@400;600;700', lang: 'en' },
  { label: 'Great Vibes', value: "'Great Vibes', cursive", googleFamily: 'Great+Vibes', lang: 'en' },
  // Arabic
  { label: 'Cairo', value: "'Cairo', sans-serif", googleFamily: 'Cairo:wght@400;500;600;700', lang: 'ar' },
  { label: 'Tajawal', value: "'Tajawal', sans-serif", googleFamily: 'Tajawal:wght@400;500;700', lang: 'ar' },
  { label: 'Almarai', value: "'Almarai', sans-serif", googleFamily: 'Almarai:wght@400;700', lang: 'ar' },
  { label: 'Amiri', value: "'Amiri', serif", googleFamily: 'Amiri:wght@400;700', lang: 'ar' },
  { label: 'Noto Sans Arabic', value: "'Noto Sans Arabic', sans-serif", googleFamily: 'Noto+Sans+Arabic:wght@400;500;700', lang: 'ar' },
  { label: 'Reem Kufi', value: "'Reem Kufi', sans-serif", googleFamily: 'Reem+Kufi:wght@400;500;700', lang: 'ar' },
  { label: 'El Messiri', value: "'El Messiri', sans-serif", googleFamily: 'El+Messiri:wght@400;600;700', lang: 'ar' },
  { label: 'Lalezar', value: "'Lalezar', cursive", googleFamily: 'Lalezar', lang: 'ar' },
]

const FONTS_LINK_ID = 'studently-design-fonts'

/**
 * Loads all designer fonts via a single Google Fonts stylesheet <link>.
 * Both the on-screen builder/preview and the html2canvas export read computed
 * DOM styles, so the fonts just need to be present in the document at render
 * time — no separate embedding step for export.
 */
export function useLoadDesignFonts() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById(FONTS_LINK_ID)) return

    const families = DESIGN_FONTS.map((f) => `family=${f.googleFamily}`).join('&')
    const link = document.createElement('link')
    link.id = FONTS_LINK_ID
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`
    document.head.appendChild(link)
  }, [])
}
