'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { BookOpen, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAuthToken } from '@/lib/api/schools'
import { createText } from '@/lib/api/speed-reading'
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

const emptyQuiz = (): QuizRow => ({
  question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_ans: 'a',
})

export default function NewTextPage() {
  const t = useTranslations('speedReading')
  const router = useRouter()
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!campusId) return
    getGradeLevels(campusId).then(res => {
      if (res.success && res.data) setGradeLevels(res.data)
    })
  }, [campusId])

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError(t('errRequired'))
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
    const res = await createText({ title, language, content, grade_level_id: (gradeLevelId && gradeLevelId !== 'all') ? gradeLevelId : null, quiz_questions, campus_id: campusId }, token)
    setSaving(false)
    if (res.success) {
      router.push('/admin/speed-reading/texts')
    } else {
      setError(res.error || t('errSave'))
    }
  }

  const updateQuiz = (idx: number, field: keyof QuizRow, value: string) => {
    setQuizRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b pb-4">
        <BookOpen className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{t('addText')}</h1>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{t('titleLabel')}</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('titlePlaceholder')} />
          </div>
          <div className="space-y-2">
            <Label>{t('language')}</Label>
            <Select value={language} onValueChange={v => setLanguage(v as 'en' | 'ar')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t('languageEn')}</SelectItem>
                <SelectItem value="ar">{t('languageAr')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('gradeLevelLabel')}</Label>
            <Select value={gradeLevelId} onValueChange={setGradeLevelId}>
              <SelectTrigger>
                <SelectValue placeholder={t('allLevels')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allLevels')}</SelectItem>
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
            placeholder={t('contentPlaceholder')}
            className={`min-h-48 ${language === 'ar' ? 'text-right font-arabic' : ''}`}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          />
          {content && (
            <p className="text-xs text-muted-foreground">
              {t('wordCountEstimate', { count: content.trim().split(/\s+/).filter(Boolean).length })}
            </p>
          )}
        </div>

        {/* Quiz Questions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('quizQuestions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {quizRows.map((row, idx) => (
              <div key={idx} className="border rounded-md p-4 space-y-3 relative">
                <Button
                  variant="ghost"
                  size="sm"
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
                  <div className="space-y-1">
                    <Label className="text-xs">{t('optionA')}</Label>
                    <Input value={row.option_a} onChange={e => updateQuiz(idx, 'option_a', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('optionB')}</Label>
                    <Input value={row.option_b} onChange={e => updateQuiz(idx, 'option_b', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('optionC')}</Label>
                    <Input value={row.option_c} onChange={e => updateQuiz(idx, 'option_c', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('optionD')}</Label>
                    <Input value={row.option_d} onChange={e => updateQuiz(idx, 'option_d', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('correctAnswer')}</Label>
                  <Select value={row.correct_ans} onValueChange={v => updateQuiz(idx, 'correct_ans', v)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a">A</SelectItem>
                      <SelectItem value="b">B</SelectItem>
                      <SelectItem value="c">C</SelectItem>
                      <SelectItem value="d">D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            {quizRows.length < 3 && (
              <Button variant="outline" size="sm" onClick={() => setQuizRows(prev => [...prev, emptyQuiz()])}>
                <Plus className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('addQuestion')}
              </Button>
            )}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('saving') : t('saveText')}
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/speed-reading/texts')}>
            {t('cancel')}
          </Button>
        </div>
      </div>
    </div>
  )
}
