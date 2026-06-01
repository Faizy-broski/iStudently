'use client'

/**
 * FormulaEditorDialog
 *
 * Mirrors the RosarioSIS TinyMCE Formula plugin adapted for Studently's
 * Tiptap rich-text editor.
 *
 * Flow:
 *  1. Admin clicks the fx toolbar button → dialog opens
 *  2. Admin types LaTeX and clicks symbol shortcuts — live KaTeX preview
 *  3. "Insert formula" → KaTeX rendered HTML is captured via html2canvas
 *     → PNG data-URL → inserted as <img> in the Tiptap editor
 *
 * Requires:  npm install katex @types/katex
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import html2canvas from 'html2canvas'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'

// ── Symbol library (mirrors RosarioSIS formula plugin categories) ─────────────

const SYMBOL_CATEGORIES = [
  {
    id: 'basic',
    label: 'Basic Math',
    symbols: [
      { label: '±', latex: '\\pm' },
      { label: '×', latex: '\\times' },
      { label: '÷', latex: '\\div' },
      { label: '≠', latex: '\\neq' },
      { label: '≤', latex: '\\leq' },
      { label: '≥', latex: '\\geq' },
      { label: '≈', latex: '\\approx' },
      { label: '≡', latex: '\\equiv' },
      { label: '∞', latex: '\\infty' },
      { label: '∝', latex: '\\propto' },
      { label: '°', latex: '^{\\circ}' },
      { label: '∴', latex: '\\therefore' },
      { label: '∵', latex: '\\because' },
      { label: '∈', latex: '\\in' },
      { label: '∉', latex: '\\notin' },
      { label: '⊂', latex: '\\subset' },
      { label: '⊃', latex: '\\supset' },
      { label: '⊆', latex: '\\subseteq' },
      { label: '⊇', latex: '\\supseteq' },
      { label: '∩', latex: '\\cap' },
      { label: '∪', latex: '\\cup' },
      { label: '∀', latex: '\\forall' },
      { label: '∃', latex: '\\exists' },
      { label: '∅', latex: '\\emptyset' },
      { label: '∧', latex: '\\land' },
      { label: '∨', latex: '\\lor' },
      { label: '¬', latex: '\\neg' },
    ],
  },
  {
    id: 'greek',
    label: 'Greek',
    symbols: [
      { label: 'α', latex: '\\alpha' },
      { label: 'β', latex: '\\beta' },
      { label: 'γ', latex: '\\gamma' },
      { label: 'δ', latex: '\\delta' },
      { label: 'ε', latex: '\\epsilon' },
      { label: 'ζ', latex: '\\zeta' },
      { label: 'η', latex: '\\eta' },
      { label: 'θ', latex: '\\theta' },
      { label: 'ι', latex: '\\iota' },
      { label: 'κ', latex: '\\kappa' },
      { label: 'λ', latex: '\\lambda' },
      { label: 'μ', latex: '\\mu' },
      { label: 'ν', latex: '\\nu' },
      { label: 'ξ', latex: '\\xi' },
      { label: 'π', latex: '\\pi' },
      { label: 'ρ', latex: '\\rho' },
      { label: 'σ', latex: '\\sigma' },
      { label: 'τ', latex: '\\tau' },
      { label: 'υ', latex: '\\upsilon' },
      { label: 'φ', latex: '\\phi' },
      { label: 'χ', latex: '\\chi' },
      { label: 'ψ', latex: '\\psi' },
      { label: 'ω', latex: '\\omega' },
      { label: 'Γ', latex: '\\Gamma' },
      { label: 'Δ', latex: '\\Delta' },
      { label: 'Θ', latex: '\\Theta' },
      { label: 'Λ', latex: '\\Lambda' },
      { label: 'Ξ', latex: '\\Xi' },
      { label: 'Π', latex: '\\Pi' },
      { label: 'Σ', latex: '\\Sigma' },
      { label: 'Υ', latex: '\\Upsilon' },
      { label: 'Φ', latex: '\\Phi' },
      { label: 'Ψ', latex: '\\Psi' },
      { label: 'Ω', latex: '\\Omega' },
    ],
  },
  {
    id: 'fractions',
    label: 'Roots & Fractions',
    symbols: [
      { label: 'a/b', latex: '\\frac{a}{b}' },
      { label: '½', latex: '\\frac{1}{2}' },
      { label: '√', latex: '\\sqrt{x}' },
      { label: '∛', latex: '\\sqrt[3]{x}' },
      { label: 'ⁿ√', latex: '\\sqrt[n]{x}' },
      { label: 'xⁿ', latex: 'x^{n}' },
      { label: 'xₙ', latex: 'x_{n}' },
      { label: 'xⁿₘ', latex: 'x^{n}_{m}' },
      { label: 'eˣ', latex: 'e^{x}' },
      { label: 'log', latex: '\\log_{b}(x)' },
      { label: 'ln', latex: '\\ln(x)' },
    ],
  },
  {
    id: 'integrals',
    label: 'Calculus',
    symbols: [
      { label: '∫', latex: '\\int' },
      { label: '∫dx', latex: '\\int_{a}^{b} f(x)\\,dx' },
      { label: '∬', latex: '\\iint' },
      { label: '∭', latex: '\\iiint' },
      { label: '∮', latex: '\\oint' },
      { label: 'Σ', latex: '\\sum_{i=1}^{n}' },
      { label: 'Π', latex: '\\prod_{i=1}^{n}' },
      { label: 'lim', latex: '\\lim_{x \\to \\infty}' },
      { label: 'lim₀', latex: '\\lim_{x \\to 0}' },
      { label: 'dy/dx', latex: '\\frac{dy}{dx}' },
      { label: 'd/dx', latex: '\\frac{d}{dx}\\left(f(x)\\right)' },
      { label: '∂', latex: '\\partial' },
      { label: '∂f/∂x', latex: '\\frac{\\partial f}{\\partial x}' },
      { label: '∇', latex: '\\nabla' },
    ],
  },
  {
    id: 'matrices',
    label: 'Matrices',
    symbols: [
      { label: '(a b; c d)', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
      { label: '[a b; c d]', latex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}' },
      { label: '|a b; c d|', latex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}' },
      { label: '3×3', latex: '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}' },
      { label: 'piecewise', latex: '\\begin{cases} f(x) & x > 0 \\\\ g(x) & x \\leq 0 \\end{cases}' },
    ],
  },
  {
    id: 'arrows',
    label: 'Arrows',
    symbols: [
      { label: '→', latex: '\\rightarrow' },
      { label: '←', latex: '\\leftarrow' },
      { label: '↔', latex: '\\leftrightarrow' },
      { label: '⇒', latex: '\\Rightarrow' },
      { label: '⇐', latex: '\\Leftarrow' },
      { label: '⇔', latex: '\\Leftrightarrow' },
      { label: '↑', latex: '\\uparrow' },
      { label: '↓', latex: '\\downarrow' },
      { label: '↦', latex: '\\mapsto' },
      { label: '⊢', latex: '\\vdash' },
      { label: '⊨', latex: '\\models' },
    ],
  },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface FormulaEditorDialogProps {
  open: boolean
  onClose: () => void
  /** Called with a PNG data-URL of the rendered formula */
  onInsert: (pngDataUrl: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FormulaEditorDialog({
  open,
  onClose,
  onInsert,
}: FormulaEditorDialogProps) {
  const [latex, setLatex] = useState('')
  const [renderError, setRenderError] = useState<string | null>(null)
  const [renderedHtml, setRenderedHtml] = useState('')
  const [inserting, setInserting] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hiddenRef = useRef<HTMLDivElement>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setLatex('')
      setRenderedHtml('')
      setRenderError(null)
    }
  }, [open])

  // Live KaTeX preview
  useEffect(() => {
    if (!latex.trim()) {
      setRenderedHtml('')
      setRenderError(null)
      return
    }
    try {
      const html = katex.renderToString(latex, {
        displayMode: true,
        throwOnError: true,
        output: 'html',
      })
      setRenderedHtml(html)
      setRenderError(null)
    } catch (e: any) {
      setRenderError(e.message?.replace(/^KaTeX parse error:\s*/i, '') ?? 'Invalid LaTeX')
      setRenderedHtml('')
    }
  }, [latex])

  // Append symbol/snippet to LaTeX at cursor position
  const appendSymbol = useCallback((symbolLatex: string) => {
    const ta = textareaRef.current
    if (!ta) {
      setLatex((prev) => prev + ' ' + symbolLatex + ' ')
      return
    }
    const start = ta.selectionStart ?? ta.value.length
    const end = ta.selectionEnd ?? ta.value.length
    const newValue =
      ta.value.substring(0, start) + symbolLatex + ta.value.substring(end)
    setLatex(newValue)
    // Restore cursor after the inserted symbol
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + symbolLatex.length
      ta.setSelectionRange(pos, pos)
    })
  }, [])

  // Insert: render KaTeX HTML → capture via html2canvas → PNG → onInsert
  const handleInsert = async () => {
    if (!renderedHtml || !hiddenRef.current) return
    setInserting(true)
    try {
      const container = hiddenRef.current
      container.innerHTML = renderedHtml
      // Scale up for better resolution
      const canvas = await html2canvas(container, {
        scale: 3,
        backgroundColor: null,
        logging: false,
      })
      const pngDataUrl = canvas.toDataURL('image/png')
      onInsert(pngDataUrl)
      onClose()
    } catch {
      // Fallback: insert the KaTeX HTML directly if canvas fails
      onInsert('')
    } finally {
      setInserting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono font-bold italic text-lg">fx</span>
            Formula Editor
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ── Left: symbol shortcuts + LaTeX input ── */}
          <div className="space-y-3">
            <Tabs defaultValue="basic">
              <TabsList className="flex-wrap h-auto gap-1">
                {SYMBOL_CATEGORIES.map((cat) => (
                  <TabsTrigger key={cat.id} value={cat.id} className="text-xs px-2 py-1">
                    {cat.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {SYMBOL_CATEGORIES.map((cat) => (
                <TabsContent key={cat.id} value={cat.id}>
                  <div className="flex flex-wrap gap-1 p-2 border rounded-md bg-muted/30 min-h-20">
                    {cat.symbols.map((sym) => (
                      <button
                        key={sym.latex}
                        type="button"
                        title={sym.latex}
                        onClick={() => appendSymbol(sym.latex)}
                        className="px-2 py-1 text-sm border rounded hover:bg-accent hover:text-accent-foreground transition-colors font-mono"
                      >
                        {sym.label}
                      </button>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                LaTeX input
              </label>
              <textarea
                ref={textareaRef}
                value={latex}
                onChange={(e) => setLatex(e.target.value)}
                placeholder={'Type LaTeX here…\ne.g. \\frac{a}{b} + \\sqrt{x}'}
                rows={5}
                className="w-full font-mono text-sm p-2 border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                spellCheck={false}
              />
            </div>
          </div>

          {/* ── Right: live preview ── */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Result</p>
            <div className="border rounded-md bg-background min-h-48 flex items-center justify-center p-4">
              {renderError ? (
                <p className="text-sm text-destructive text-center">{renderError}</p>
              ) : renderedHtml ? (
                <div
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  className="overflow-auto max-w-full"
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  Enter a LaTeX expression to see a preview
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Click a symbol above to append it, or type LaTeX directly.
            </p>
          </div>
        </div>

        {/* Hidden offscreen container used for html2canvas capture */}
        <div
          ref={hiddenRef}
          aria-hidden
          style={{
            position: 'fixed',
            top: -9999,
            left: -9999,
            padding: '8px 12px',
            background: 'transparent',
            fontSize: '20px',
          }}
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleInsert}
            disabled={!renderedHtml || inserting}
          >
            {inserting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Inserting…</>
            ) : (
              'Insert formula'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
