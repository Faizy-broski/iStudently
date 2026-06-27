"use client"

import { useState, useEffect, useCallback } from "react"
import { useCampus } from "@/context/CampusContext"
import { getPdfHeaderFooter, updatePdfHeaderFooter, PdfHeaderFooterSettings } from "@/lib/api/school-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Save, FileImage, Copy, Check, Link2, Image as ImageIcon, Upload } from "lucide-react"

// ── Tiptap editor ─────────────────────────────────────────────────────────────
import { useEditor, EditorContent, Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"

// ── Substitution variables ─────────────────────────────────────────────────────
const SUBSTITUTIONS = [
  { label: "School Logo",    token: "{school_logo}" },
  { label: "School Name",    token: "{school_name}" },
  { label: "School Address", token: "{school_address}" },
  { label: "School Phone",   token: "{school_phone}" },
  { label: "School Email",   token: "{school_email}" },
  { label: "Current Date",   token: "{date}" },
  { label: "Page Number",    token: "{page_number}" },
  { label: "Total Pages",    token: "{total_pages}" },
]

const DEFAULT: PdfHeaderFooterSettings = {
  pdf_header_html: "",
  pdf_footer_html: "",
  pdf_margin_top: 20,
  pdf_margin_bottom: 18,
  pdf_exclude_print: false,
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={[
        "px-1.5 py-1 rounded text-sm transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

// ── Link dialog ───────────────────────────────────────────────────────────────
function LinkDialog({
  open,
  initial,
  onConfirm,
  onClose,
}: {
  open: boolean
  initial: { href: string; title?: string; target?: string }
  onConfirm: (v: { href: string; title: string; target: string }) => void
  onClose: () => void
}) {
  const [href, setHref] = useState(initial.href)
  const [title, setTitle] = useState(initial.title ?? "")
  const [target, setTarget] = useState(initial.target ?? "")

  // reset when opened
  useEffect(() => {
    if (open) { setHref(initial.href); setTitle(initial.title ?? ""); setTarget(initial.target ?? "") }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-110 max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Insert link</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Url</Label>
            <Input value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional tooltip" />
          </div>
          <div className="space-y-1.5">
            <Label>Target</Label>
            <Select value={target || "none"} onValueChange={(v) => setTarget(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="_blank">New window (_blank)</SelectItem>
                <SelectItem value="_self">Same window (_self)</SelectItem>
                <SelectItem value="_parent">Parent (_parent)</SelectItem>
                <SelectItem value="_top">Top (_top)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (href.trim()) onConfirm({ href: href.trim(), title, target }); else onClose() }}>
            Ok
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Image dialog ──────────────────────────────────────────────────────────────
function ImageDialog({
  open,
  initial,
  onConfirm,
  onClose,
}: {
  open: boolean
  initial: { src: string; alt?: string; width?: string; height?: string }
  onConfirm: (v: { src: string; alt: string; width: string; height: string }) => void
  onClose: () => void
}) {
  const [src, setSrc] = useState(initial.src)
  const [alt, setAlt] = useState(initial.alt ?? "")
  const [width, setWidth] = useState(initial.width ?? "")
  const [height, setHeight] = useState(initial.height ?? "")
  const [constrain, setConstrain] = useState(true)
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [previewSrc, setPreviewSrc] = useState("")

  useEffect(() => {
    if (open) {
      setSrc(initial.src); setAlt(initial.alt ?? "")
      setWidth(initial.width ?? ""); setHeight(initial.height ?? "")
      setPreviewSrc(initial.src ?? "")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const loadImageSize = (url: string) => {
    const img = new window.Image()
    img.onload = () => {
      setNaturalRatio(img.naturalWidth / img.naturalHeight)
      if (!width && !height) { setWidth(String(img.naturalWidth)); setHeight(String(img.naturalHeight)) }
    }
    img.src = url
  }

  const onSrcBlur = () => { if (src) { setPreviewSrc(src); loadImageSize(src) } }

  const onWidthChange = (v: string) => {
    setWidth(v)
    if (constrain && naturalRatio && v) setHeight(String(Math.round(parseInt(v) / naturalRatio)))
  }
  const onHeightChange = (v: string) => {
    setHeight(v)
    if (constrain && naturalRatio && v) setWidth(String(Math.round(parseInt(v) * naturalRatio)))
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setSrc(dataUrl)
      setPreviewSrc(dataUrl)
      loadImageSize(dataUrl)
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const handleOk = () => {
    const final = src.trim()
    if (final) onConfirm({ src: final, alt, width, height })
    else onClose()
  }

  const sharedFields = (
    <div className="space-y-3 pt-3">
      <div className="space-y-1.5">
        <Label className="text-sm">Image description</Label>
        <Input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Alt text" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">Dimensions</Label>
        <div className="flex items-center gap-2 flex-wrap">
          <Input className="w-20" placeholder="W" value={width} onChange={(e) => onWidthChange(e.target.value)} />
          <span className="text-muted-foreground text-sm">×</span>
          <Input className="w-20" placeholder="H" value={height} onChange={(e) => onHeightChange(e.target.value)} />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={constrain} onCheckedChange={(v) => setConstrain(!!v)} />
            Constrain proportions
          </label>
        </div>
      </div>
      {previewSrc && (
        <div className="border rounded p-2 bg-muted/30 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewSrc} alt="preview" className="max-h-24 max-w-full object-contain" />
        </div>
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[480px] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Insert / edit image</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">Upload</TabsTrigger>
          </TabsList>

          {/* General tab — URL */}
          <TabsContent value="general" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Source</Label>
              <Input
                value={src}
                onChange={(e) => setSrc(e.target.value)}
                onBlur={onSrcBlur}
                placeholder="https://…"
                autoFocus
              />
            </div>
            {sharedFields}
          </TabsContent>

          {/* Upload tab — file picker → base64 data URI */}
          <TabsContent value="upload" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Choose file</Label>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-muted/40 transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {uploading ? "Loading…" : src && src.startsWith("data:") ? "Image loaded — click to replace" : "Click to select an image"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFileChange}
                />
              </label>
            </div>
            {sharedFields}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleOk} disabled={uploading || !src}>Ok</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
function EditorToolbar({ editor }: { editor: Editor }) {
  const [showSource, setShowSource] = useState(false)
  const [sourceHtml, setSourceHtml] = useState("")
  const [linkOpen, setLinkOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)

  const toggleSource = () => {
    if (!showSource) {
      setSourceHtml(editor.getHTML())
    } else {
      editor.commands.setContent(sourceHtml, false)
    }
    setShowSource((v) => !v)
  }

  if (showSource) {
    return (
      <div className="border rounded-t-md bg-muted/30">
        <div className="flex items-center gap-1 px-2 py-1.5 border-b flex-wrap">
          <ToolbarButton active title="Source Code" onClick={toggleSource}>
            <span className="font-mono text-xs">&lt;/&gt;</span>
          </ToolbarButton>
        </div>
        <textarea
          className="w-full p-3 font-mono text-xs bg-transparent outline-none resize-none min-h-35"
          value={sourceHtml}
          onChange={(e) => setSourceHtml(e.target.value)}
          onBlur={() => editor.commands.setContent(sourceHtml, false)}
        />
      </div>
    )
  }

  return (
    <>
      <LinkDialog
        open={linkOpen}
        initial={{ href: editor.getAttributes("link").href ?? "", title: editor.getAttributes("link").title, target: editor.getAttributes("link").target }}
        onConfirm={({ href, title, target }) => {
          editor.chain().focus().setLink({ href, target: target || undefined, ...(title ? { title } : {}) } as any).run()
          setLinkOpen(false)
        }}
        onClose={() => setLinkOpen(false)}
      />
      <ImageDialog
        open={imageOpen}
        initial={{ src: editor.getAttributes("image").src ?? "", alt: editor.getAttributes("image").alt, width: editor.getAttributes("image").width, height: editor.getAttributes("image").height }}
        onConfirm={({ src, alt, width, height }) => {
          editor.chain().focus().setImage({ src, alt: alt || undefined, width: width || undefined, height: height || undefined } as any).run()
          setImageOpen(false)
        }}
        onClose={() => setImageOpen(false)}
      />

      <div className="border rounded-t-md bg-muted/30">
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b flex-wrap">
          {/* Text style */}
          <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
            <span className="underline">U</span>
          </ToolbarButton>

          <span className="mx-1 text-border">|</span>

          {/* Lists */}
          <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
            ☰
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
            ≡
          </ToolbarButton>

          <span className="mx-1 text-border">|</span>

          {/* Alignment */}
          <ToolbarButton active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align left">
            ⇤
          </ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Center">
            ↔
          </ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align right">
            ⇥
          </ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Justify">
            ≡
          </ToolbarButton>

          <span className="mx-1 text-border">|</span>

          {/* Link */}
          <ToolbarButton active={editor.isActive("link")} onClick={() => setLinkOpen(true)} title="Insert link">
            <Link2 className="h-3.5 w-3.5" />
          </ToolbarButton>

          {/* Image */}
          <ToolbarButton onClick={() => setImageOpen(true)} title="Insert image">
            <ImageIcon className="h-3.5 w-3.5" />
          </ToolbarButton>

          <span className="mx-1 text-border">|</span>

          {/* Color */}
          <label title="Text color" className="relative px-1.5 py-1 cursor-pointer rounded hover:bg-muted text-sm text-muted-foreground hover:text-foreground">
            A
            <input
              type="color"
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              onInput={(e) => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
            />
          </label>

          <span className="mx-1 text-border">|</span>

          {/* Source code */}
          <ToolbarButton title="Source Code" onClick={toggleSource}>
            <span className="font-mono text-xs">&lt;/&gt;</span>
          </ToolbarButton>
        </div>

        <EditorContent
          editor={editor}
          className="min-h-35 px-3 py-2 text-sm prose prose-sm max-w-none focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-30"
        />
      </div>
    </>
  )
}

// ── Substitutions panel ───────────────────────────────────────────────────────
function SubstitutionsPanel({ editor, logoUrl }: { editor: Editor; logoUrl?: string }) {
  const [selected, setSelected] = useState(SUBSTITUTIONS[0].token)
  const [copied, setCopied] = useState(false)

  const selectedSub = SUBSTITUTIONS.find((s) => s.token === selected) ?? SUBSTITUTIONS[0]

  const handleCopy = () => {
    editor.chain().focus().insertContent(selected).run()
    navigator.clipboard.writeText(selected).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="w-48 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUBSTITUTIONS.map((s) => (
            <SelectItem key={s.token} value={s.token} className="text-xs">
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected === "{school_logo}" && logoUrl ? (
        <img
          src={logoUrl}
          alt="School logo"
          className="h-8 w-auto object-contain rounded border bg-muted/40 px-1"
        />
      ) : (
        <code className="text-xs bg-muted px-2 py-1 rounded border font-mono">
          {selectedSub.token}
        </code>
      )}

      <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handleCopy}>
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Inserted" : "COPY"}
      </Button>

      <span className="text-xs text-muted-foreground">Substitutions</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PdfHeaderFooterPage() {
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id ?? null

  const [form, setForm] = useState<PdfHeaderFooterSettings>(DEFAULT)
  // Separate state for what was last fetched from the API so that syncEditors
  // re-runs when data arrives regardless of whether the editors mounted first.
  const [apiData, setApiData] = useState<PdfHeaderFooterSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Tiptap editors
  const headerEditor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Link.configure({ openOnClick: false }),
      Image,
    ],
    content: "",
    onUpdate: ({ editor }) => {
      setForm((f) => ({ ...f, pdf_header_html: editor.getHTML() }))
    },
  })

  const footerEditor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Link.configure({ openOnClick: false }),
      Image,
    ],
    content: "",
    onUpdate: ({ editor }) => {
      setForm((f) => ({ ...f, pdf_footer_html: editor.getHTML() }))
    },
  })

  // Load settings
  useEffect(() => {
    setLoading(true)
    getPdfHeaderFooter(campusId).then((res) => {
      const data = res.success && res.data ? res.data : DEFAULT
      setForm(data)
      setApiData(data)
      headerEditor?.commands.setContent(data.pdf_header_html || "", false)
      footerEditor?.commands.setContent(data.pdf_footer_html || "", false)
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId])

  // Sync loaded content into editors once they mount.
  // Uses `apiData` (not `form`) so user keystrokes never retrigger setContent,
  // and so the callback is recreated whenever either the editors or the fetched
  // data change — fixing the race where editors mount before the API resolves.
  const syncEditors = useCallback(() => {
    if (headerEditor && apiData) {
      headerEditor.commands.setContent(apiData.pdf_header_html || "", false)
    }
    if (footerEditor && apiData) {
      footerEditor.commands.setContent(apiData.pdf_footer_html || "", false)
    }
  }, [headerEditor, footerEditor, apiData])

  useEffect(() => { syncEditors() }, [syncEditors])

  const handleSave = async () => {
    // Pull latest HTML from editors before saving
    const payload: PdfHeaderFooterSettings = {
      ...form,
      pdf_header_html: headerEditor?.getHTML() ?? form.pdf_header_html,
      pdf_footer_html: footerEditor?.getHTML() ?? form.pdf_footer_html,
    }
    setSaving(true)
    try {
      const res = await updatePdfHeaderFooter(payload, campusId)
      if (res.success) toast.success("PDF header/footer settings saved")
      else toast.error(res.error || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  if (loading || !headerEditor || !footerEditor) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        Loading PDF settings…
      </div>
    )
  }

  return (
    <div className="p-8 space-y-0">

      {/* Page title + Save */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FileImage className="h-6 w-6" /> PDF Header Footer
        </h1>
        <Button onClick={handleSave} disabled={saving} className="uppercase tracking-wide px-6">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">

          {/* ── Header section ──────────────────────────────────────────────── */}
          <div className="p-8 space-y-4">
            <EditorToolbar editor={headerEditor} />

            <SubstitutionsPanel editor={headerEditor} logoUrl={campusCtx?.selectedCampus?.logo_url ?? undefined} />

            <div className="space-y-1.5 pt-2">
              <Label htmlFor="margin_top" className="text-sm text-muted-foreground">Top Margin (mm)</Label>
              <Input
                id="margin_top"
                type="number"
                min={0}
                max={80}
                value={form.pdf_margin_top}
                onChange={(e) => setForm((f) => ({ ...f, pdf_margin_top: parseInt(e.target.value, 10) || 20 }))}
                className="w-28"
              />
            </div>

            <p className="text-sm font-medium text-muted-foreground pt-1">Header</p>
          </div>

          {/* ── Footer section ──────────────────────────────────────────────── */}
          <div className="p-8 space-y-4">
            <EditorToolbar editor={footerEditor} />

            <SubstitutionsPanel editor={footerEditor} logoUrl={campusCtx?.selectedCampus?.logo_url ?? undefined} />

            <div className="space-y-1.5 pt-2">
              <Label htmlFor="margin_bottom" className="text-sm text-muted-foreground">Bottom Margin (mm)</Label>
              <Input
                id="margin_bottom"
                type="number"
                min={0}
                max={80}
                value={form.pdf_margin_bottom}
                onChange={(e) => setForm((f) => ({ ...f, pdf_margin_bottom: parseInt(e.target.value, 10) || 18 }))}
                className="w-28"
              />
            </div>

            <p className="text-sm font-medium text-muted-foreground pt-1">Footer</p>
          </div>

          {/* ── Exclude print ───────────────────────────────────────────────── */}
          <div className="p-8">
            <label className="flex items-center gap-3 cursor-pointer text-sm">
              <Checkbox
                checked={form.pdf_exclude_print}
                onCheckedChange={(v) => setForm((f) => ({ ...f, pdf_exclude_print: !!v }))}
              />
              Exclude PDF generated using the &quot;Print&quot; button
            </label>
          </div>

        </CardContent>
      </Card>

      {/* Bottom Save */}
      <div className="pt-6">
        <Button onClick={handleSave} disabled={saving} className="uppercase tracking-wide px-10">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

    </div>
  )
}
