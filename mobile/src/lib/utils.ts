import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// `text-2xs` is the app's extra size (tailwind.config.js); without this it wouldn't override `text-xs`.
const twMerge = extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: ['2xs'] }] } } })

/** Merge Tailwind classes, later ones win (shadcn / React Native Reusables convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
