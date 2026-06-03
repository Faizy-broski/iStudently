'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface UnsavedChangesContextType {
  /** Programmatically mark the current page as having unsaved changes. */
  markDirty: () => void
  /** Clear dirty state (call after a successful save). */
  markClean: () => void
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType>({
  markDirty: () => {},
  markClean: () => {},
})

/**
 * Hook for components to interact with the unsaved-changes system.
 * - `markDirty()` — flag the page as having unsaved edits
 * - `markClean()` — clear the flag (e.g. after a save)
 *
 * Automatic detection already covers most `<input>`, `<select>`, `<textarea>`
 * changes so explicit calls are only needed for non-standard edits.
 */
export const useUnsavedChanges = () => useContext(UnsavedChangesContext)

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode
}

export function UnsavedChangesProvider({ children }: Props) {
  // Use a ref so event-handler closures always see the latest value without
  // re-registering listeners on every toggle.
  const dirtyRef = useRef(false)

  const [dialog, setDialog] = useState<{ open: boolean; href: string }>({
    open: false,
    href: '',
  })

  const router = useRouter()
  const pathname = usePathname()

  // ── Reset dirty state whenever the route changes ───────────────────────
  useEffect(() => {
    dirtyRef.current = false
  }, [pathname])

  const markDirty = useCallback(() => {
    dirtyRef.current = true
  }, [])

  const markClean = useCallback(() => {
    dirtyRef.current = false
  }, [])

  // ── Auto-detect form / input changes ───────────────────────────────────
  // Mirrors RosarioSIS approach: listen for native input/change events via
  // event delegation (capture phase). Covers controlled React inputs too
  // because the browser still fires native DOM events.
  useEffect(() => {
    const onInput = (e: Event) => {
      const target = e.target as HTMLElement

      // Skip search inputs
      if (target instanceof HTMLInputElement && target.type === 'search') return

      // Skip elements (or ancestors) explicitly opted-out
      if (target.closest('[data-no-unsaved-warning]')) return

      // Only track actual form-input elements
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        dirtyRef.current = true
      }
    }

    // Reset on native form submit (traditional <form> submissions)
    const onSubmit = () => {
      dirtyRef.current = false
    }

    // Reset when a save-like button is clicked.
    // Many pages use custom save handlers instead of native form submit.
    const onSaveClick = (e: Event) => {
      const target = (e.target as HTMLElement).closest('button, input[type="button"], input[type="submit"]')
      if (!target) return

      const isSubmitButton = target instanceof HTMLButtonElement && target.type === 'submit'
      const saveDataAttr = target.getAttribute('data-unsaved-save')
      const title = (target.getAttribute('title') || '').toLowerCase()
      const text = (target.textContent || '').toLowerCase()
      const value = target instanceof HTMLInputElement ? (target.value || '').toLowerCase() : ''

      const isSaveButton =
        isSubmitButton ||
        saveDataAttr === 'true' ||
        title.includes('save') ||
        text.includes('save') ||
        value.includes('save')

      if (isSaveButton) {
        dirtyRef.current = false
      }
    }

    document.addEventListener('input', onInput, true)
    document.addEventListener('change', onInput, true)
    document.addEventListener('submit', onSubmit, true)
    document.addEventListener('click', onSaveClick, true)

    return () => {
      document.removeEventListener('input', onInput, true)
      document.removeEventListener('change', onInput, true)
      document.removeEventListener('submit', onSubmit, true)
      document.removeEventListener('click', onSaveClick, true)
    }
  }, [])

  // ── beforeunload: browser close / reload / URL-bar navigation ──────────
  // Overcomes RosarioSIS limitation #1 for these scenarios.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
        // Legacy browsers need returnValue
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // ── Intercept <a> click navigation ─────────────────────────────────────
  // Covers Next.js <Link> (renders as <a>), sidebar links, breadcrumbs, etc.
  // Uses capture phase so we run before Next.js/React handlers.
  // Calling preventDefault() is enough — Next.js's <Link> handler checks
  // e.defaultPrevented and bails out.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dirtyRef.current) return

      const link = (e.target as HTMLElement).closest('a')
      if (!link) return

      // Allow links that open in new tabs/windows
      if (link.target && link.target.startsWith('_')) return

      // Allow explicitly excluded links
      if (link.closest('[data-no-unsaved-warning]')) return

      const href = link.getAttribute('href')
      if (!href || href === '#' || href.startsWith('#') || href.startsWith('javascript:')) return

      // Same pathname — allow (e.g. hash anchors, same-page query changes)
      try {
        const target = new URL(href, window.location.origin)
        if (target.pathname === window.location.pathname) return
      } catch {
        return
      }

      e.preventDefault()
      setDialog({ open: true, href })
    }

    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [])

  // ── Dialog handlers ────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    dirtyRef.current = false
    const { href } = dialog
    setDialog({ open: false, href: '' })
    router.push(href)
  }, [dialog, router])

  const handleCancel = useCallback(() => {
    setDialog({ open: false, href: '' })
  }, [])

  return (
    <UnsavedChangesContext.Provider value={{ markDirty, markClean }}>
      {children}

      <AlertDialog
        open={dialog.open}
        onOpenChange={(open) => {
          if (!open) handleCancel()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              If you leave the page before saving, your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Leave Page</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesContext.Provider>
  )
}
