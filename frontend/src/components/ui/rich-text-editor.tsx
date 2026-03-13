'use client'

/**
 * Reusable TipTap rich-text editor with full toolbar.
 * Mirrors the editor used in PDF Header / Footer settings.
 */
import { useState, useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import TiptapLink from '@tiptap/extension-link'
import TiptapImage from '@tiptap/extension-image'
import { Input } from './input'
import { Label } from './label'
import { Button } from './button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Link2, Image as ImageIcon, Mic, Video } from 'lucide-react'
import FormulaEditorDialog from '@/components/formula/FormulaEditorDialog'
import AudioVideoRecorderDialog, { type RecordingType } from '@/components/media/AudioVideoRecorderDialog'
import { AudioNode } from '@/lib/tiptap-extensions/AudioNode'
import { VideoNode } from '@/lib/tiptap-extensions/VideoNode'

// ── Toolbar button ────────────────────────────────────────────────────────────

function TB({
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
        'px-1.5 py-1 rounded text-sm transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-muted text-muted-foreground hover:text-foreground',
      ].join(' ')}
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
  const [title, setTitle] = useState(initial.title ?? '')
  const [target, setTarget] = useState(initial.target ?? '')

  useEffect(() => {
    if (open) { setHref(initial.href); setTitle(initial.title ?? ''); setTarget(initial.target ?? '') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-96 max-w-[95vw]">
        <DialogHeader><DialogTitle>Insert link</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>URL</Label>
            <Input value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://" autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Title (tooltip)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1">
            <Label>Target</Label>
            <Select value={target || 'none'} onValueChange={(v) => setTarget(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="_blank">New window (_blank)</SelectItem>
                <SelectItem value="_self">Same window (_self)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (href.trim()) onConfirm({ href: href.trim(), title, target }); else onClose() }}>OK</Button>
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
  initial: { src: string; alt?: string }
  onConfirm: (v: { src: string; alt: string }) => void
  onClose: () => void
}) {
  const [src, setSrc] = useState(initial.src)
  const [alt, setAlt] = useState(initial.alt ?? '')

  useEffect(() => {
    if (open) { setSrc(initial.src); setAlt(initial.alt ?? '') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-96 max-w-[95vw]">
        <DialogHeader><DialogTitle>Insert image</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Image URL</Label>
            <Input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="https://…" autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Alt text</Label>
            <Input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Description for accessibility" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (src.trim()) onConfirm({ src: src.trim(), alt }); else onClose() }}>Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function Toolbar({ editor, campusId, showEditorPlugins }: { editor: Editor; campusId?: string; showEditorPlugins?: boolean }) {
  const [showSource, setShowSource] = useState(false)
  const [sourceHtml, setSourceHtml] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)
  const [formulaOpen, setFormulaOpen] = useState(false)
  const [recorderType, setRecorderType] = useState<RecordingType | null>(null)

  const toggleSource = () => {
    if (!showSource) setSourceHtml(editor.getHTML())
    else editor.commands.setContent(sourceHtml, false)
    setShowSource((v) => !v)
  }

  if (showSource) {
    return (
      <div className="border rounded-t-md bg-muted/30">
        <div className="flex items-center gap-1 px-2 py-1.5 border-b">
          <TB active title="Visual Editor" onClick={toggleSource}>
            <span className="font-mono text-xs">&lt;/&gt;</span>
          </TB>
        </div>
        <textarea
          className="w-full p-3 font-mono text-xs bg-transparent outline-none resize-none min-h-40"
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
        initial={{
          href: editor.getAttributes('link').href ?? '',
          title: editor.getAttributes('link').title,
          target: editor.getAttributes('link').target,
        }}
        onConfirm={({ href, title, target }) => {
          editor.chain().focus().setLink({ href, target: target || undefined, ...(title ? { title } : {}) } as any).run()
          setLinkOpen(false)
        }}
        onClose={() => setLinkOpen(false)}
      />
      <ImageDialog
        open={imageOpen}
        initial={{ src: editor.getAttributes('image').src ?? '', alt: editor.getAttributes('image').alt }}
        onConfirm={({ src, alt }) => {
          editor.chain().focus().setImage({ src, alt: alt || undefined } as any).run()
          setImageOpen(false)
        }}
        onClose={() => setImageOpen(false)}
      />
      {showEditorPlugins && (
        <FormulaEditorDialog
          open={formulaOpen}
          onClose={() => setFormulaOpen(false)}
          onInsert={(pngDataUrl) => {
            if (pngDataUrl) {
              editor.chain().focus().setImage({ src: pngDataUrl, alt: 'formula' } as any).run()
            }
          }}
        />
      )}
      {showEditorPlugins && recorderType && (
        <AudioVideoRecorderDialog
          open={!!recorderType}
          type={recorderType}
          campusId={campusId}
          onClose={() => setRecorderType(null)}
          onInsert={(url, mimeType) => {
            if (recorderType === 'audio') {
              editor.chain().focus().insertContent({
                type: 'audio',
                attrs: { src: url, 'data-mime': mimeType },
              }).run()
            } else {
              editor.chain().focus().insertContent({
                type: 'video',
                attrs: { src: url, 'data-mime': mimeType },
              }).run()
            }
          }}
        />
      )}

      <div className="border rounded-t-md bg-muted/30">
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b flex-wrap">
          <TB active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><strong>B</strong></TB>
          <TB active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><em>I</em></TB>
          <TB active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><span className="underline">U</span></TB>

          <span className="mx-1 text-border">|</span>

          <TB active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2"><span className="font-bold text-xs">H2</span></TB>
          <TB active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3"><span className="font-bold text-xs">H3</span></TB>

          <span className="mx-1 text-border">|</span>

          <TB active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">☰</TB>
          <TB active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">≡</TB>

          <span className="mx-1 text-border">|</span>

          <TB active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left">⇤</TB>
          <TB active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Center">↔</TB>
          <TB active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right">⇥</TB>

          <span className="mx-1 text-border">|</span>

          <TB active={editor.isActive('link')} onClick={() => setLinkOpen(true)} title="Insert link"><Link2 className="h-3.5 w-3.5" /></TB>
          <TB onClick={() => setImageOpen(true)} title="Insert image"><ImageIcon className="h-3.5 w-3.5" /></TB>
          {showEditorPlugins && (
            <TB onClick={() => setFormulaOpen(true)} title="Insert formula (fx)">
              <span className="font-mono font-bold italic text-xs">fx</span>
            </TB>
          )}
          {showEditorPlugins && (
            <TB onClick={() => setRecorderType('audio')} title="Record audio annotation">
              <Mic className="h-3.5 w-3.5" />
            </TB>
          )}
          {showEditorPlugins && (
            <TB onClick={() => setRecorderType('video')} title="Record video annotation">
              <Video className="h-3.5 w-3.5" />
            </TB>
          )}

          <span className="mx-1 text-border">|</span>

          <label title="Text color" className="relative px-1.5 py-1 cursor-pointer rounded hover:bg-muted text-sm text-muted-foreground hover:text-foreground">
            A
            <input
              type="color"
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              onInput={(e) => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
            />
          </label>

          <span className="mx-1 text-border">|</span>

          <TB title="Source code" onClick={toggleSource}>
            <span className="font-mono text-xs">&lt;/&gt;</span>
          </TB>
        </div>

        <EditorContent
          editor={editor}
          className="min-h-40 px-3 py-2 text-sm prose prose-sm max-w-none focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-36"
        />
      </div>
    </>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
  /** Optional campus ID — forwarded to the media recorder so files are stored per-campus */
  campusId?: string
  /** Show formula (fx) and audio/video recording toolbar buttons. Only for lesson plans and assignments. */
  showEditorPlugins?: boolean
}

export function RichTextEditor({ value, onChange, campusId, showEditorPlugins }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      TiptapLink.configure({ openOnClick: false }),
      TiptapImage,
      AudioNode,
      VideoNode,
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'outline-none' },
    },
  })

  // Sync external value changes (e.g. after load from API)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  if (!editor) return null

  return (
    <div className="rounded-md overflow-hidden border border-input bg-background">
      <Toolbar editor={editor} campusId={campusId} showEditorPlugins={showEditorPlugins} />
    </div>
  )
}
