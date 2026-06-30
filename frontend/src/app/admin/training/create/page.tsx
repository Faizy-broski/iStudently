'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { trainingApi, CreateTrainingSessionDTO } from '@/lib/api/training'

const schema = z
  .object({
    title: z.string().min(2, 'Title must be at least 2 characters'),
    description: z.string().optional(),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().min(1, 'End date is required'),
    total_seats: z.coerce.number().int().min(1, 'Must have at least 1 seat'),
    course_fee: z.coerce.number().min(0).optional(),
    target_audience: z.enum(['internal', 'external', 'both']),
    status: z.enum(['open', 'closed']),
  })
  .refine((d) => new Date(d.start_date) < new Date(d.end_date), {
    message: 'Start date must be before end date',
    path: ['end_date'],
  })

type FormData = z.infer<typeof schema>

export default function CreateTrainingPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      target_audience: 'both',
      status: 'open',
      course_fee: 0,
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    const dto: CreateTrainingSessionDTO = {
      title: data.title,
      description: data.description || undefined,
      start_date: new Date(data.start_date).toISOString(),
      end_date: new Date(data.end_date).toISOString(),
      total_seats: data.total_seats,
      course_fee: data.course_fee ?? 0,
      target_audience: data.target_audience,
      status: data.status,
    }

    const res = await trainingApi.createSession(dto)
    setIsSubmitting(false)

    if (res.success && res.data) {
      toast.success('Training session created')
      router.push(`/admin/training/${res.data.id}`)
    } else {
      toast.error(res.error ?? 'Failed to create session')
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">New Training Session</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create a training course and share the public registration link
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">
                Session Title <span className="text-destructive">*</span>
              </Label>
              <Input id="title" placeholder="e.g. Introduction to Robotics" {...register('title')} />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Describe the course, goals, prerequisites…"
                {...register('description')}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="start_date">
                  Start Date & Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="start_date"
                  type="datetime-local"
                  {...register('start_date')}
                />
                {errors.start_date && (
                  <p className="text-xs text-destructive">{errors.start_date.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end_date">
                  End Date & Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="end_date"
                  type="datetime-local"
                  {...register('end_date')}
                />
                {errors.end_date && (
                  <p className="text-xs text-destructive">{errors.end_date.message}</p>
                )}
              </div>
            </div>

            {/* Seats & Fee */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="total_seats">
                  Total Seats <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="total_seats"
                  type="number"
                  min={1}
                  placeholder="15"
                  {...register('total_seats')}
                />
                {errors.total_seats && (
                  <p className="text-xs text-destructive">{errors.total_seats.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="course_fee">Course Fee</Label>
                <Input
                  id="course_fee"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  {...register('course_fee')}
                />
              </div>
            </div>

            {/* Target Audience */}
            <div className="space-y-1.5">
              <Label>Target Audience</Label>
              <div className="flex gap-4">
                {(['both', 'internal', 'external'] as const).map((v) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value={v}
                      {...register('target_audience')}
                      className="accent-primary"
                    />
                    <span className="text-sm capitalize">{v === 'both' ? 'Both (Internal & External)' : v}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Initial Status */}
            <div className="space-y-1.5">
              <Label>Initial Status</Label>
              <Select
                defaultValue="open"
                onValueChange={(v) => setValue('status', v as 'open' | 'closed')}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open — accept registrations</SelectItem>
                  <SelectItem value="closed">Closed — not yet open</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Session
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
