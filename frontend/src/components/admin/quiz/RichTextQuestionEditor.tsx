'use client'
import React, { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { QuestionType, QUESTION_TYPE_LABELS } from '@/lib/api/quiz'
import { AnatomyHotspotPicker } from '@/components/anatomy/AnatomyHotspotPicker'
import { uploadImage } from '@/lib/api/media-upload'
import {
  Bold,
  Italic,
  Underline,
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
  Plus,
  Divide,
  Sigma,
  Pi,
  X,
  Upload,
  AlignLeft,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

export interface EditableQuestionItem {
  id: string
  title: string // Main question text / content (HTML supported)
  type: QuestionType
  description?: string
  allocated_marks: number
  image_url?: string | null
  correct_answer?: any // e.g. "True", "Option A", ["Option A", "Option B"], etc.
  blank_lines_count: number // Defined empty space for Essay questions
  answer_options?: string[] // Multiple choice / True-False choices
}

interface RichTextQuestionEditorProps {
  question: EditableQuestionItem
  index: number
  onChange: (updated: EditableQuestionItem) => void
  onRemove: () => void
}

const MATH_SYMBOLS = [
  { label: '½', symbol: '½' },
  { label: '⅓', symbol: '⅓' },
  { label: '¼', symbol: '¼' },
  { label: '¾', symbol: '¾' },
  { label: '√x', symbol: '√(' },
  { label: 'x²', symbol: '²' },
  { label: 'xⁿ', symbol: '^' },
  { label: 'π', symbol: 'π' },
  { label: '∑', symbol: '∑' },
  { label: '∫', symbol: '∫' },
  { label: '±', symbol: '±' },
  { label: '≠', symbol: '≠' },
  { label: '≤', symbol: '≤' },
  { label: '≥', symbol: '≥' },
  { label: '∞', symbol: '∞' },
  { label: 'θ', symbol: 'θ' },
  { label: 'α', symbol: 'α' },
  { label: 'β', symbol: 'β' },
  { label: 'Δ', symbol: 'Δ' },
  { label: '°', symbol: '°' },
  { label: '( )', symbol: '( )' },
  { label: '[ ]', symbol: '[ ]' },
]

export function RichTextQuestionEditor({
  question,
  index,
  onChange,
  onRemove,
}: RichTextQuestionEditorProps) {
  const [showImageInput, setShowImageInput] = useState(false)
  const [imageUrlInput, setImageUrlInput] = useState(question.image_url || '')
  const [isUploading, setIsUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Direct file upload handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image file too large (max 5 MB)')
      return
    }

    setIsUploading(true)
    try {
      const res = await uploadImage(file)
      if (res.success && res.data?.url) {
        onChange({ ...question, image_url: res.data.url })
        setImageUrlInput(res.data.url)
        toast.success('Image uploaded successfully')
      } else {
        // Fallback to FileReader data URL
        const reader = new FileReader()
        reader.onload = ev => {
          const dataUrl = ev.target?.result as string
          if (dataUrl) {
            onChange({ ...question, image_url: dataUrl })
            setImageUrlInput(dataUrl)
            toast.success('Image loaded')
          }
        }
        reader.readAsDataURL(file)
      }
    } catch {
      // Local fallback
      const reader = new FileReader()
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string
        if (dataUrl) {
          onChange({ ...question, image_url: dataUrl })
          setImageUrlInput(dataUrl)
          toast.success('Image loaded')
        }
      }
      reader.readAsDataURL(file)
    } finally {
      setIsUploading(false)
    }
  }

  // Quick insert math symbol or HTML tags at cursor
  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart || 0
    const end = textarea.selectionEnd || 0
    const current = question.title || ''

    const updatedText = current.substring(0, start) + textToInsert + current.substring(end)
    onChange({ ...question, title: updatedText })

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length)
    }, 50)
  }

  // Format highlighted text with HTML tags like <b>text</b>, <i>text</i>, <u>text</u>
  const applyFormatting = (tag: 'b' | 'i' | 'u') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart || 0
    const end = textarea.selectionEnd || 0
    const current = question.title || ''
    const selected = current.substring(start, end)

    const formatted = `<${tag}>${selected || 'text'}</${tag}>`
    const updatedText = current.substring(0, start) + formatted + current.substring(end)
    onChange({ ...question, title: updatedText })
  }

  // Options management for MCQ / True-False
  const defaultOptions = () => {
    if (question.type === 'select' || question.type === 'multiple') {
      return question.answer_options && question.answer_options.length > 0
        ? question.answer_options
        : ['Option 1', 'Option 2', 'Option 3', 'Option 4']
    }
    return []
  }

  const options = defaultOptions()

  const handleOptionChange = (optIdx: number, val: string) => {
    const nextOptions = [...options]
    nextOptions[optIdx] = val
    onChange({ ...question, answer_options: nextOptions })
  }

  const handleAddOption = () => {
    const nextOptions = [...options, `Option ${options.length + 1}`]
    onChange({ ...question, answer_options: nextOptions })
  }

  const handleRemoveOption = (optIdx: number) => {
    const nextOptions = options.filter((_, i) => i !== optIdx)
    onChange({ ...question, answer_options: nextOptions })
  }

  // Correct answer selection handler
  const setCorrectAnswer = (answerValue: any) => {
    onChange({ ...question, correct_answer: answerValue })
  }

  return (
    <Card className="border rounded-xl shadow-sm overflow-hidden bg-card transition-all hover:border-primary/40">
      <div className="bg-muted/30 px-4 py-2.5 border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-bold text-xs">
            Q{index + 1}
          </Badge>
          <Select
            value={question.type}
            onValueChange={val => onChange({ ...question, type: val as QuestionType })}
          >
            <SelectTrigger className="h-7 text-xs w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Label className="text-xs text-muted-foreground">Marks:</Label>
            <Input
              type="number"
              min={0.5}
              step={0.5}
              value={question.allocated_marks}
              onChange={e => onChange({ ...question, allocated_marks: Number(e.target.value) })}
              className="w-16 h-7 text-xs font-bold text-center"
            />
            <span className="text-xs text-muted-foreground">pts</span>
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:bg-destructive/10"
            onClick={onRemove}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Editor Formatting & Math Symbols Toolbar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-1 bg-muted/20 p-1.5 rounded-lg border">
            {/* Rich Text Controls */}
            <div className="flex items-center gap-1 border-r pr-2 mr-1">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-xs" onClick={() => applyFormatting('b')} title="Bold">
                <Bold className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-xs" onClick={() => applyFormatting('i')} title="Italic">
                <Italic className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-xs" onClick={() => applyFormatting('u')} title="Underline">
                <Underline className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Math Symbols Toolbar */}
            <div className="flex items-center gap-1 flex-wrap flex-1">
              <span className="text-[10px] font-semibold text-muted-foreground mr-1 flex items-center gap-0.5">
                <Sigma className="w-3 h-3 text-primary" /> Math:
              </span>
              {MATH_SYMBOLS.map(item => (
                <Button
                  key={item.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] font-mono bg-background hover:bg-primary/10 hover:text-primary"
                  onClick={() => insertTextAtCursor(item.symbol)}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            {/* Insert Image Button */}
            <Button
              type="button"
              variant={question.image_url ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs gap-1 ml-auto"
              onClick={() => setShowImageInput(!showImageInput)}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {question.image_url ? 'Image Inserted' : 'Insert Image'}
            </Button>
          </div>

          {/* Question Content Input */}
          <Textarea
            ref={textareaRef}
            value={question.title}
            onChange={e => onChange({ ...question, title: e.target.value })}
            placeholder="Type question content here... (Supports HTML formatting and Math symbols)"
            rows={3}
            className="font-sans text-sm focus:border-primary"
          />
        </div>

        {/* Image Attachment Panel */}
        {(showImageInput || question.image_url) && (
          <div className="p-3 bg-muted/30 border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> Question Image / Diagram (Geometry, Maps, Diagrams)
              </Label>
              {question.image_url && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    onChange({ ...question, image_url: null })
                    setImageUrlInput('')
                  }}
                >
                  Remove Image
                </Button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 shrink-0 bg-background hover:bg-primary/5"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Upload className="w-3.5 h-3.5 text-primary" />}
                {isUploading ? 'Uploading Image...' : 'Upload Image File'}
              </Button>

              <div className="flex gap-2 flex-1">
                <Input
                  value={imageUrlInput}
                  onChange={e => setImageUrlInput(e.target.value)}
                  placeholder="Or paste image URL (e.g. https://.../diagram.png)"
                  className="h-8 text-xs flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs shrink-0"
                  onClick={() => onChange({ ...question, image_url: imageUrlInput })}
                >
                  Apply URL
                </Button>
              </div>
            </div>

            {question.image_url && (
              <div className="pt-2 flex justify-center bg-background p-2 rounded border">
                <img
                  src={question.image_url}
                  alt="Question Diagram"
                  className="max-h-48 object-contain rounded shadow-sm"
                  onError={() => toast.error('Failed to load image')}
                />
              </div>
            )}
          </div>
        )}

        {/* Answer Options & Correct Answer Selector */}
        {(question.type === 'select' || question.type === 'multiple') && (
          <div className="space-y-2 pt-1 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Options & Correct Answer Key (علامة الإجابة الصحيحة)
              </Label>
              <Button size="sm" variant="ghost" className="h-6 text-xs text-primary" onClick={handleAddOption}>
                <Plus className="w-3 h-3 mr-1" /> Add Option
              </Button>
            </div>

            <div className="space-y-2">
              {options.map((opt, optIdx) => {
                const isCorrect =
                  question.type === 'multiple'
                    ? Array.isArray(question.correct_answer) && question.correct_answer.includes(opt)
                    : question.correct_answer === opt

                return (
                  <div key={optIdx} className="flex items-center gap-2">
                    {/* Select Correct Answer Radio / Checkbox */}
                    <input
                      type={question.type === 'multiple' ? 'checkbox' : 'radio'}
                      name={`correct-ans-${question.id}`}
                      checked={isCorrect}
                      onChange={e => {
                        if (question.type === 'multiple') {
                          const currentArr = Array.isArray(question.correct_answer)
                            ? question.correct_answer
                            : []
                          const updatedArr = e.target.checked
                            ? [...currentArr, opt]
                            : currentArr.filter(item => item !== opt)
                          setCorrectAnswer(updatedArr)
                        } else {
                          setCorrectAnswer(opt)
                        }
                      }}
                      className="w-4 h-4 text-green-600 focus:ring-green-500 rounded cursor-pointer"
                      title="Mark as correct answer"
                    />

                    <Input
                      value={opt}
                      onChange={e => handleOptionChange(optIdx, e.target.value)}
                      placeholder={`Option ${optIdx + 1}`}
                      className={`h-8 text-xs flex-1 ${isCorrect ? 'border-green-500 bg-green-50/40 dark:bg-green-950/20 font-semibold' : ''}`}
                    />

                    {isCorrect && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-[10px] px-1.5">
                        Correct Choice
                      </Badge>
                    )}

                    {options.length > 2 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveOption(optIdx)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Essay Blank Lines Spacing Control */}
        {(question.type === 'textarea' || question.type === 'text') && (
          <div className="pt-2 border-t flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <AlignLeft className="w-3.5 h-3.5 text-blue-600" /> Essay Spacing Control (عدد أسطر الإجابة)
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Define the exact number of ruled blank lines to leave on paper for student's handwritten answer.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Input
                type="number"
                min={0}
                max={30}
                value={question.blank_lines_count}
                onChange={e => onChange({ ...question, blank_lines_count: Number(e.target.value) })}
                className="w-20 h-8 text-xs font-bold text-center"
              />
              <span className="text-xs text-muted-foreground">lines</span>
            </div>
          </div>
        )}

        {/* 3D Anatomy Label — pick an organ + the hotspot the student must find */}
        {question.type === 'anatomy_label' && (
          <div className="pt-2 border-t space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Correct Structure (3D Model)
            </Label>
            <AnatomyHotspotPicker
              mode="author"
              initialOrganId={question.correct_answer?.organId}
              initialHotspotId={question.correct_answer?.hotspotId}
              onChange={(value) =>
                setCorrectAnswer(value ? { organId: value.organId, model: value.model, hotspotId: value.hotspotId } : null)
              }
            />
            {question.correct_answer?.hotspotId ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800 text-[10px] px-1.5">
                Correct answer: {question.correct_answer.hotspotId}
              </Badge>
            ) : (
              <p className="text-[11px] text-muted-foreground">Click a marker on the 3D model above to set the correct answer.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
