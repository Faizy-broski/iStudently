'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import { BookOpen, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getAuthToken } from '@/lib/api/schools'
import { getText, updateText, type QuizQuestion } from '@/lib/api/speed-reading'
import { getGradeLevels, type GradeLevel } from '@/lib/api/academics'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'

interface QuizRow {
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_ans: 'a' | 'b' | 'c' | 'd'
}

const toRow = (q: QuizQuestion): QuizRow => ({
  question: q.question,
  option_a: q.option_a,
  option_b: q.option_b,
  option_c: q.option_c ?? '',
  option_d: q.option_d ?? '',
  correct_ans: q.correct_ans,
})

export default function EditTextPage() {
  const t = useTranslations('speedReading')
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const campusId = selectedCampus?.id ?? profile?.school_id

  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState<'en' | 'ar'>('en')
  const [gradeLevelId, setGradeLevelId] = useState('all')
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [content, setContent] = useState('')
  const [quizRows, setQuizRows] = useState<QuizRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const token = await getAuthToken()
      const res = await getText(id, token)
      if (res.success && res.data) {
        const d = res.data
        setTitle(d.title)
        setLanguage(d.language)
        setGradeLevelId(d.grade_level_id ?? 'all')
        setContent(d.content)
        setQuizRows((d.quiz_questions ?? []).map(toRow))
      }
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!campusId) return
    getGradeLevels(campusId).then(res => {
      if (res.success && res.data) setGradeLevels(res.data)
    })
  }, [campusId])

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required.')
      return
    }
    setSaving(true)
    setError('')
    const token = await getAuthToken()
    const quiz_questions = quizRows
      .filter(q => q.question.trim() && q.option_a.trim() && q.option_b.trim())
      .map(({ question, option_a, option_b, option_c, option_d, correct_ans }) => ({
        question, option_a, option_b,
        option_c: option_c || undefined,
        option_d: option_d || undefined,
        correct_ans,
      }))
    const res = await updateText(id, { title, language, content, grade_level_id: (gradeLevelId && gradeLevelId !== 'all') ? gradeLevelId : null, quiz_questions }, token)
    setSaving(false)
    if (res.success) {
      router.push('/admin/speed-reading/texts')
    } else {
      setError(res.error || 'Failed to save.')
    }
  }

  const updateQuiz = (idx: number, field: keyof QuizRow, value: string) => {
    setQuizRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  if (loading) return (
    <div className="space-y-4 max-w-3xl">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b pb-4">
        <BookOpen className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{t('editText')}</h1>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('language')}</Label>
            <Select value={language} onValueChange={v => setLanguage(v as 'en' | 'ar')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t('languageEn')}</SelectItem>
                <SelectItem value="ar">{t('languageAr')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Grade Level</Label>
            <Select value={gradeLevelId} onValueChange={setGradeLevelId}>
              <SelectTrigger><SelectValue placeholder="All levels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {gradeLevels.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('content')}</Label>
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className={`min-h-48 ${language === 'ar' ? 'text-right' : ''}`}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          />
          {content && (
            <p className="text-xs text-muted-foreground">
              ~{content.trim().split(/\s+/).filter(Boolean).length} words
            </p>
          )}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('quizQuestions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {quizRows.map((row, idx) => (
              <div key={idx} className="border rounded-md p-4 space-y-3 relative">
                <Button
                  variant="ghost" size="sm"
                  className="absolute top-2 right-2 rtl:left-2 rtl:right-auto text-destructive"
                  onClick={() => setQuizRows(prev => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="space-y-2">
                  <Label>{t('questionLabel')} {idx + 1}</Label>
                  <Input value={row.question} onChange={e => updateQuiz(idx, 'question', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(['a','b','c','d'] as const).map(opt => (
                    <div key={opt} className="space-y-1">
                      <Label className="text-xs">{t(`option${opt.toUpperCase()}` as any)}</Label>
                      <Input
                        value={row[`option_${opt}` as keyof QuizRow] as string}
                        onChange={e => updateQuiz(idx, `option_${opt}` as keyof QuizRow, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('correctAnswer')}</Label>
                  <Select value={row.correct_ans} onValueChange={v => updateQuiz(idx, 'correct_ans', v)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['a','b','c','d'] as const).map(o => <SelectItem key={o} value={o}>{o.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            {quizRows.length < 3 && (
              <Button variant="outline" size="sm"
                onClick={() => setQuizRows(prev => [...prev, { question:'', option_a:'', option_b:'', option_c:'', option_d:'', correct_ans:'a' }])}>
                <Plus className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('addQuestion')}
              </Button>
            )}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/speed-reading/texts')}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
