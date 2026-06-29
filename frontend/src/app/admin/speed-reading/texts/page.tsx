'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { BookOpen, Plus, Pencil, Trash2, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { getAuthToken } from '@/lib/api/schools'
import { getTexts, deleteText, type ReadingText } from '@/lib/api/speed-reading'
import { getGradeLevels, type GradeLevel } from '@/lib/api/academics'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'

export default function SpeedReadingTextsPage() {
  const t = useTranslations('speedReading')
  const router = useRouter()
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const schoolId = profile?.school_id
  const campusId = selectedCampus?.id ?? schoolId

  const [texts, setTexts] = useState<ReadingText[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [gradeFilter, setGradeFilter] = useState('all')
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])

  const load = async () => {
    if (!campusId) return
    setLoading(true)
    const token = await getAuthToken()
    const res = await getTexts(token, schoolId, undefined, campusId)
    if (res.success && res.data) setTexts(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [campusId])

  useEffect(() => {
    if (!campusId) return
    getGradeLevels(campusId).then(res => {
      if (res.success && res.data) setGradeLevels(res.data)
    })
  }, [campusId])

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const token = await getAuthToken()
    await deleteText(deleteId, token)
    setDeleteId(null)
    setDeleting(false)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{t('manageTexts')}</h1>
        </div>
        <Button onClick={() => router.push('/admin/speed-reading/texts/new')}>
          <Plus className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
          {t('addText')}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All grade levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All grade levels</SelectItem>
            {gradeLevels.map(g => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : texts.filter(t => gradeFilter === 'all' || !gradeFilter || t.grade_level_id === gradeFilter).length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{gradeFilter ? 'No texts for this grade level.' : t('noTexts')}</p>
          {!gradeFilter && (
            <Button className="mt-4" onClick={() => router.push('/admin/speed-reading/texts/new')}>
              <Plus className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {t('addText')}
            </Button>
          )}
        </div>
      ) : (
        (() => {
          const filtered = texts.filter(t => gradeFilter === 'all' || !gradeFilter || t.grade_level_id === gradeFilter)
          return (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left rtl:text-right px-4 py-3 font-semibold text-primary">Title</th>
                    <th className="text-left rtl:text-right px-4 py-3 font-semibold text-primary">Grade Level</th>
                    <th className="text-left rtl:text-right px-4 py-3 font-semibold text-primary">{t('language')}</th>
                    <th className="text-left rtl:text-right px-4 py-3 font-semibold text-primary">{t('wordCount')}</th>
                    <th className="text-left rtl:text-right px-4 py-3 font-semibold text-primary">Quiz</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((text, idx) => (
                    <tr key={text.id} className={`border-b last:border-0 hover:bg-muted/30 ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-4 py-3 font-medium">{text.title}</td>
                      <td className="px-4 py-3">
                        {text.grade_level_name
                          ? <Badge variant="secondary">{text.grade_level_name}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="gap-1">
                          <Globe className="h-3 w-3" />
                          {text.language === 'ar' ? t('languageAr') : t('languageEn')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{text.word_count} words</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {text.quiz_questions && text.quiz_questions.length > 0
                          ? `${text.quiz_questions.length} Q`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/admin/speed-reading/texts/${text.id}/edit`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(text.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteText')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteTextConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? '...' : t('deleteText')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
