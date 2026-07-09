'use client'

import { useState } from 'react'
import { MessageSquarePlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { submitFeedback } from '@/lib/api/feedback'

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<'feature_request' | 'bug'>('bug')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in both a title and a description')
      return
    }
    setSubmitting(true)
    try {
      const res = await submitFeedback({ title: title.trim(), description: description.trim(), category })
      if (!res.success) {
        toast.error(res.error || 'Failed to submit feedback')
        return
      }
      toast.success('Thanks! Your feedback has been submitted.')
      setTitle('')
      setDescription('')
      setCategory('bug')
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-[9999] flex items-center gap-2 rounded-full bg-[#022172] text-white shadow-lg px-4 py-3 hover:bg-[#01154d] transition-colors"
        title="Report a bug or suggest a feature"
      >
        <MessageSquarePlus className="h-5 w-5" />
        <span className="hidden sm:inline text-sm font-medium">Feedback</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report a bug or suggest a feature</DialogTitle>
            <DialogDescription>
              Your submission goes straight to the platform team for review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="feedback-category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as 'feature_request' | 'bug')}>
                <SelectTrigger id="feedback-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature_request">Suggest a new feature</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feedback-title">Title</Label>
              <Input
                id="feedback-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feedback-description">Description</Label>
              <Textarea
                id="feedback-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened, or what would you like to see?"
                rows={5}
                maxLength={5000}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {submitting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
