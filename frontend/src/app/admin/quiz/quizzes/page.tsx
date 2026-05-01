'use client'
import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { getQuizzes, deleteQuiz, copyQuiz, type Quiz } from '@/lib/api/quiz'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Plus, Trash2, Pencil, Copy, FileQuestion, BarChart2, Search, ListChecks } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { AddEditQuizDialog } from '@/components/admin/quiz/AddEditQuizDialog'
import { ManageQuizQuestionsDialog } from '@/components/admin/quiz/ManageQuizQuestionsDialog'

export default function QuizzesPage() {
  const { profile } = useAuth()
  const { selectedCampus } = useCampus()
  const schoolId = profile?.school_id ?? ''
  const campusId = selectedCampus?.id ?? null

  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editQuiz, setEditQuiz] = useState<Quiz | null>(null)
  const [copying, setCopying] = useState<string | null>(null)
  const [manageQuiz, setManageQuiz] = useState<Quiz | null>(null)

  const key = ['quiz-quizzes', schoolId, campusId, search]
  const { data, isLoading } = useSWR(
    schoolId ? key : null,
    () => getQuizzes(schoolId, { campusId, search: search || undefined }).then(r => r.data ?? [])
  )

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteQuiz(deleteId)
    mutate(key)
    setDeleteId(null)
  }

  const handleCopy = async (id: string) => {
    setCopying(id)
    try {
      // Use current academic year — user can re-assign later
      const res = await copyQuiz(id, '')
      if (res.data) mutate(key)
    } finally {
      setCopying(null)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quizzes</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Quiz
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 max-w-sm"
          placeholder="Search quizzes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileQuestion className="w-5 h-5" /> Quiz List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Assignment</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Options</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : (data ?? []).length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        No quizzes found. Create one to get started.
                      </TableCell>
                    </TableRow>
                  )
                : (data ?? []).map(quiz => (
                    <TableRow key={quiz.id}>
                      <TableCell className="font-medium">{quiz.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {quiz.assignment?.title ?? <span className="italic">No assignment</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{quiz.question_count ?? 0} Q</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {quiz.assignment?.due_date
                          ? format(new Date(quiz.assignment.due_date), 'MMM d, yyyy')
                          : '—'}
                      </TableCell>
                      <TableCell className="flex gap-1 flex-wrap">
                        {quiz.show_correct_answers && (
                          <Badge variant="outline" className="text-xs">Show Answers</Badge>
                        )}
                        {quiz.shuffle && (
                          <Badge variant="outline" className="text-xs">Shuffle</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Manage Questions"
                            onClick={() => setManageQuiz(quiz)}
                          >
                            <ListChecks className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" asChild title="Answer Breakdown">
                            <Link href={`/admin/quiz/answer-breakdown?quiz_id=${quiz.id}`}>
                              <BarChart2 className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Copy Quiz"
                            disabled={copying === quiz.id}
                            onClick={() => handleCopy(quiz.id)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit Quiz"
                            onClick={() => setEditQuiz(quiz)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete Quiz"
                            className="text-destructive"
                            onClick={() => setDeleteId(quiz.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {manageQuiz && (
        <ManageQuizQuestionsDialog
          quiz={manageQuiz}
          schoolId={schoolId}
          campusId={campusId}
          onClose={() => setManageQuiz(null)}
          onChanged={() => mutate(key)}
        />
      )}

      {(addOpen || editQuiz) && (
        <AddEditQuizDialog
          quiz={editQuiz}
          schoolId={schoolId}
          campusId={campusId}
          onClose={() => { setAddOpen(false); setEditQuiz(null) }}
          onSaved={() => { mutate(key); setAddOpen(false); setEditQuiz(null) }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the quiz and all student answers. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
