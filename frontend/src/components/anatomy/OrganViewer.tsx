"use client";

// Adapted from thebuggeddev/anatomy (app/components/OrganViewer.tsx) for
// studently's "anatomy_label" quiz question type.
//
// What changed from upstream, and why:
//  - `compare` (side-by-side organ comparison) is dropped — that view lived in
//    AnatomyApp.tsx, the standalone-explorer shell studently isn't porting.
//  - The built-in `quizActive`/`LabelQuiz` round (asks every hotspot on the
//    organ, in shuffled order, with its own scoring) is dropped — it doesn't
//    fit studently's "one quiz_questions row = one hotspot" grading model.
//    Picking is exposed instead via `onHotspotSelect`, using the viewer's
//    normal single-select click behaviour (unchanged in viewer.ts), so the
//    caller (AnatomyHotspotPicker) can drive its own single-question flow.
//  - `?authoring=1` (the coordinate-sampling dev tool for placing new
//    hotspots) is dropped — studently only ever picks among the hotspots
//    `anatomy-data.ts` already defines, never authors new ones.
//  - `t: UiDictionary` (the full app-shell chrome dictionary — nav, library,
//    modal, quiz-round strings, etc.) is replaced by `strings`, a small local
//    type covering only what this trimmed component actually renders.
//  - `flash()`/`clearSelection()` are exposed to the caller via a ref, so a
//    quiz-taking wrapper can report correct/incorrect after grading a pick.
//
// Everything else — the 3D viewer itself (lib/anatomy/three/*), the tool
// buttons, the hotspot callout and offscreen a11y list — is unmodified.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { CircleDashed, Layers3, Maximize2, RotateCcw, ScanLine, Search, X } from "lucide-react";
import type { Hotspot, Organ } from "@/lib/anatomy/i18n/merge";
import { format } from "@/lib/anatomy/i18n/types";
import type { AnatomyViewer } from "@/lib/anatomy/three/viewer";
import "./organ-viewer.css";

export type OrganViewerStrings = {
  canvas: string;
  /** `{organ}` placeholder, e.g. "{organ} viewer". */
  title: string;
  tip: string;
  tipDrag: string;
  tipScroll: string;
  tipClick: string;
  structures: string;
  /** `{organ}` placeholder, e.g. "Loading {organ}...". */
  loading: string;
  autoRotate: string;
  caption: string;
  toolsLabel: string;
  toolRotate: string;
  toolZoom: string;
  toolIsolate: string;
  toolSection: string;
  toolLayers: string;
  toolReset: string;
  closeCallout: string;
};

export const DEFAULT_ORGAN_VIEWER_STRINGS: OrganViewerStrings = {
  canvas: "Interactive 3D anatomy model",
  title: "{organ} viewer",
  tip: "Tip",
  tipDrag: "Drag to rotate",
  tipScroll: "Scroll to zoom",
  tipClick: "Click a marker to inspect it",
  structures: "Structures on this model",
  loading: "Loading {organ}...",
  autoRotate: "Auto-rotate",
  caption: "Scientific name",
  toolsLabel: "Viewer tools",
  toolRotate: "Rotate",
  toolZoom: "Zoom",
  toolIsolate: "Isolate",
  toolSection: "Cross-section",
  toolLayers: "Wireframe",
  toolReset: "Reset view",
  closeCallout: "Close",
};

type Props = {
  organ: Organ;
  strings?: OrganViewerStrings;
  autoRotate: boolean;
  onAutoRotate: (enabled: boolean) => void;
  /** Fires on every normal click-select (including deselect → null). */
  onHotspotSelect?: (hotspot: Hotspot | null) => void;
};

export type OrganViewerHandle = {
  /** Green/red ring on a hotspot dot — call after grading a pick. */
  flash: (id: string, correct: boolean) => void;
  clearSelection: () => void;
};

export const OrganViewer = forwardRef<OrganViewerHandle, Props>(function OrganViewer(
  { organ, strings = DEFAULT_ORGAN_VIEWER_STRINGS, autoRotate, onAutoRotate, onHotspotSelect },
  forwardedRef,
) {
  const t = strings;
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<AnatomyViewer | null>(null);
  const organRef = useRef(organ);
  const autoRotateRef = useRef(autoRotate);
  const canvasLabelRef = useRef(t.canvas);
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [slowLoad, setSlowLoad] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);

  useImperativeHandle(forwardedRef, () => ({
    flash: (id, correct) => viewerRef.current?.flash(id, correct),
    clearSelection: () => viewerRef.current?.clearSelection(),
  }), []);

  useEffect(() => {
    onHotspotSelect?.(selected);
    // onHotspotSelect is expected to be stable (or the caller accepts re-firing on identity change) — mirrors upstream's ref-based callback pattern below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // A typical organ is ready well inside a second — flashing a loading panel for
  // that reads as jank. It only appears if the fetch is genuinely slow; the flag
  // is cleared by onLoading when the next load starts.
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setSlowLoad(true), 900);
    return () => window.clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    organRef.current = organ;
  }, [organ]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    canvasLabelRef.current = t.canvas;
    viewerRef.current?.setCanvasLabel(t.canvas);
  }, [t.canvas]);

  useEffect(() => {
    let cancelled = false;
    let viewer: AnatomyViewer | null = null;

    void import("@/lib/anatomy/three/viewer").then(({ AnatomyViewer: Viewer }) => {
      if (cancelled || !mountRef.current) return;
      viewer = new Viewer(mountRef.current, {
        onSelect: setSelected,
        onLoading: (isLoading, value) => {
          setLoading(isLoading);
          setProgress(value);
          if (isLoading) setSlowLoad(false);
        },
      });
      viewerRef.current = viewer;
      viewer.setCanvasLabel(canvasLabelRef.current);
      viewer.setAutoRotate(autoRotateRef.current);
      const current = organRef.current;
      viewer.setOrgan(current.model, current.hotspots, current.accent).catch(() => {
        setLoading(false);
        setProgress(0);
      });
    });

    return () => {
      cancelled = true;
      viewerRef.current = null;
      viewer?.dispose();
    };
  }, []);

  useEffect(() => {
    viewerRef.current?.setOrgan(organ.model, organ.hotspots, organ.accent).catch(() => {
      setLoading(false);
      setProgress(0);
    });
  }, [organ]);

  useEffect(() => viewerRef.current?.setAutoRotate(autoRotate), [autoRotate]);

  // The viewer drives the callout's position directly, so a spinning model
  // never costs a React render.
  const calloutRef = useCallback((node: HTMLDivElement | null) => {
    viewerRef.current?.attachCallout(node);
  }, []);

  const handleTool = (tool: string) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (tool === "rotate") onAutoRotate(!autoRotate);
    if (tool === "zoom") viewer.zoom(-1);
    if (tool === "isolate") setActiveTool(viewer.toggleIsolate() ? tool : null);
    if (tool === "section") setActiveTool(viewer.toggleCrossSection() ? tool : null);
    if (tool === "layers") setActiveTool(viewer.toggleLayers() ? tool : null);
    if (tool === "reset") {
      viewer.reset();
      setActiveTool(null);
    }
  };

  const tools = [
    { id: "rotate", label: t.toolRotate, icon: RotateCcw },
    { id: "zoom", label: t.toolZoom, icon: Search },
    { id: "isolate", label: t.toolIsolate, icon: CircleDashed },
    { id: "section", label: t.toolSection, icon: ScanLine },
    { id: "layers", label: t.toolLayers, icon: Layers3 },
    { id: "reset", label: t.toolReset, icon: RotateCcw },
  ];

  return (
    <section className="anatomy-organ-viewer viewer-shell" aria-label={format(t.title, { organ: organ.name })}>
      <div className="viewer-glow" style={{ "--organ-accent": organ.accent } as React.CSSProperties} />
      <div ref={mountRef} className="three-mount" />

      <div className="viewer-tools" aria-label={t.toolsLabel}>
        {tools.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`tool-button ${activeTool === id ? "active" : ""}`}
            onClick={() => handleTool(id)}
            aria-pressed={activeTool === id}
            title={label}
          >
            <Icon size={19} strokeWidth={1.65} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <aside className="tip-note" aria-label={t.tip}>
        <span>{t.tip}</span>
        <p>{t.tipDrag}<br />{t.tipScroll}<br />{t.tipClick}</p>
      </aside>

      {selected && (
        <div className="hotspot-callout" ref={calloutRef} data-side="right">
          <div className="callout-body" style={{ "--hotspot-color": selected.color } as React.CSSProperties}>
            <button className="callout-close" type="button" onClick={() => viewerRef.current?.clearSelection()} aria-label={t.closeCallout}>
              <X size={13} />
            </button>
            <b>{selected.label}</b>
            <small>{selected.detail}</small>
          </div>
        </div>
      )}

      {/* Screen-reader equivalent of the dots, which live in the canvas. */}
      <ul className="hotspot-index" aria-label={t.structures}>
        {organ.hotspots.map((hotspot) => (
          <li key={hotspot.id}>{hotspot.label}: {hotspot.detail}</li>
        ))}
      </ul>

      {loading && slowLoad && (
        <div className="model-loader" role="status" aria-live="polite">
          <div className="loader-orbit"><Maximize2 size={20} /></div>
          <strong>{format(t.loading, { organ: organ.name })}</strong>
          <span>{Math.max(8, Math.round(progress * 100))}%</span>
        </div>
      )}

      <button className="auto-rotate" type="button" onClick={() => onAutoRotate(!autoRotate)} aria-pressed={autoRotate}>
        <RotateCcw size={14} /> {t.autoRotate}
        <span className={`switch ${autoRotate ? "on" : ""}`}><i /></span>
      </button>

      <div className="view-caption">
        <span>{t.caption}</span>
        <strong>{organ.scientificName}</strong>
      </div>
    </section>
  );
});
