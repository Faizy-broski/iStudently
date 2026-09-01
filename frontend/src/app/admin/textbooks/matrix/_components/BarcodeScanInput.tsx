"use client";

import { useEffect, useRef } from "react";

interface Props {
  onScan: (code: string) => void;
  /** Disable capture while e.g. a dialog with its own text fields is open. */
  enabled?: boolean;
}

// Scanner keystrokes arrive far faster than human typing — used only to
// reset a stale buffer, not as a strict scan-vs-type heuristic.
const MAX_BUFFER_AGE_MS = 500;

/**
 * Captures hardware barcode-scanner input (types a code, then sends Enter)
 * via a window-level keydown listener rather than fighting for DOM focus
 * against the page's own Select/Dialog components. No barcode-scanner
 * precedent exists elsewhere in this codebase — kept intentionally simple
 * for MVP: Enter-terminates-a-scan, no further keystroke-timing heuristics.
 *
 * Never intercepts keystrokes while a real text field (input/textarea/
 * contenteditable) is focused, so it can't interfere with normal typing
 * (search boxes, dialog forms, etc).
 */
export function BarcodeScanInput({ onScan, enabled = true }: Props) {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isTyping =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active as HTMLElement | null)?.isContentEditable;
      if (isTyping) return;

      const now = Date.now();
      if (now - lastKeyTimeRef.current > MAX_BUFFER_AGE_MS) bufferRef.current = "";
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        if (code) onScan(code);
        return;
      }
      if (e.key.length === 1) bufferRef.current += e.key;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onScan]);

  // Visually hidden marker element per the "invisible <input>" spec — the
  // actual capture happens via the window listener above.
  return <input type="text" readOnly value="" aria-hidden="true" tabIndex={-1} className="sr-only" />;
}
