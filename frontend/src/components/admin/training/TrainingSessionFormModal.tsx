'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  BookOpen,
  Calendar,
  Users,
  Award,
  UploadCloud,
  FileText,
  CheckCircle2,
  Building,
  Video,
  QrCode,
  Mail,
  Loader2,
  Clock,
  User,
  Sparkles,
  Layers,
} from 'lucide-react'
import {
  trainingApi,
  TrainingSession,
  CreateTrainingSessionDTO,
  CertificateSettings,
  TrainingSkillLevel,
  TrainingDeliveryMode,
  TrainingCertificateTemplate,
} from '@/lib/api/training'
import { uploadImage, uploadMessageAttachment } from '@/lib/api/media-upload'
import { useStaff } from '@/hooks/useStaff'
import { useCampus } from '@/context/CampusContext'

const WEEKLY_DAYS_OPTIONS = [
  { id: 'Sun', label: 'Sun' },
  { id: 'Mon', label: 'Mon' },
  { id: 'Tue', label: 'Tue' },
  { id: 'Wed', label: 'Wed' },
  { id: 'Thu', label: 'Thu' },
  { id: 'Fri', label: 'Fri' },
  { id: 'Sat', label: 'Sat' },
]

const COURSE_CATEGORIES = [
  'Robotics & AI',
  'Web Development',
  'Data Science & Analytics',
  'Mobile App Development',
  'Cyber Security',
  'Soft Skills & Leadership',
  'Language & Communication',
  'Other',
]

const schema = z
  .object({
    // 1. Basic Info
    title: z.string().min(2, 'Session title must be at least 2 characters'),
    description: z.string().optional(),
    category: z.string().optional(),
    skill_level: z.enum(['beginner', 'intermediate', 'advanced']),

    // 2. Schedule & Delivery
    start_date: z.string().min(1, 'Start date & time is required'),
    end_date: z.string().min(1, 'End date & time is required'),
    weekly_days: z.array(z.string()).optional(),
    daily_time_range: z.string().optional(),
    total_duration_hours: z.coerce.number().min(0).optional(),
    delivery_mode: z.enum(['in_person', 'online', 'hybrid']),
    location_venue_link: z.string().optional(),

    // 3. Capacity & Pricing
    instructor_id: z.string().optional(),
    instructor_name: z.string().optional(),
    total_seats: z.coerce.number().int().min(1, 'Must have at least 1 seat'),
    target_audience: z.enum(['internal', 'external', 'both']),
    course_fee: z.coerce.number().min(0),
    registration_deadline: z.string().optional(),
    status: z.enum(['open', 'closed']),

    // 4. Media & Attachments
    cover_image_url: z.string().optional(),
    syllabus_pdf_url: z.string().optional(),

    // 5. Certificate Settings
    enable_auto_issuance: z.boolean(),
    certificate_template: z.enum(['standard_attendance', 'completion_excellence', 'custom_professional']),
    require_attendance_rate: z.boolean(),
    min_attendance_rate: z.coerce.number().min(0).max(100),
    require_passing_grade: z.boolean(),
    min_passing_grade: z.coerce.number().min(0).max(100),
    require_payment_cleared: z.boolean(),
    authorized_signatory: z.string().optional(),
    digital_signature_url: z.string().optional(),
    enable_verification_qr: z.boolean(),
    distribute_dashboard: z.boolean(),
    distribute_email: z.boolean(),
  })
  .refine((d) => new Date(d.start_date) < new Date(d.end_date), {
    message: 'Start date must be before end date',
    path: ['end_date'],
  })

type FormData = z.infer<typeof schema>

interface TrainingSessionFormModalProps {
  open: boolean
  onClose: () => void
  sessionToEdit?: TrainingSession | null
  onSaved?: () => void
}

export function TrainingSessionFormModal({
  open,
  onClose,
  sessionToEdit,
  onSaved,
}: TrainingSessionFormModalProps) {
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id
  const { staffList } = useStaff()
  const [activeTab, setActiveTab] = useState('basic')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingSyllabus, setUploadingSyllabus] = useState(false)
  const [uploadingSignature, setUploadingSignature] = useState(false)

  const certSettings = sessionToEdit?.certificate_settings

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      category: 'Robotics & AI',
      skill_level: 'beginner',
      start_date: '',
      end_date: '',
      weekly_days: ['Sun', 'Tue', 'Thu'],
      daily_time_range: '04:00 PM – 06:00 PM',
      total_duration_hours: 20,
      delivery_mode: 'in_person',
      location_venue_link: 'Lab 2 - Main Campus',
      instructor_id: '',
      instructor_name: '',
      total_seats: 15,
      target_audience: 'both',
      course_fee: 0,
      registration_deadline: '',
      status: 'open',
      cover_image_url: '',
      syllabus_pdf_url: '',
      enable_auto_issuance: true,
      certificate_template: 'standard_attendance',
      require_attendance_rate: true,
      min_attendance_rate: 80,
      require_passing_grade: true,
      min_passing_grade: 75,
      require_payment_cleared: true,
      authorized_signatory: 'Dr. Ali Ahmad - Center Director',
      digital_signature_url: '',
      enable_verification_qr: true,
      distribute_dashboard: true,
      distribute_email: true,
    },
  })

  // Prefill when editing
  useEffect(() => {
    if (sessionToEdit) {
      const s = sessionToEdit
      reset({
        title: s.title || '',
        description: s.description || '',
        category: s.category || 'Robotics & AI',
        skill_level: s.skill_level || 'beginner',
        start_date: s.start_date ? s.start_date.slice(0, 16) : '',
        end_date: s.end_date ? s.end_date.slice(0, 16) : '',
        weekly_days: s.weekly_days || ['Sun', 'Tue', 'Thu'],
        daily_time_range: s.daily_time_range || '',
        total_duration_hours: s.total_duration_hours || 20,
        delivery_mode: s.delivery_mode || 'in_person',
        location_venue_link: s.location_venue_link || '',
        instructor_id: s.instructor_id || '',
        instructor_name: s.instructor_name || '',
        total_seats: s.total_seats || 15,
        target_audience: s.target_audience || 'both',
        course_fee: s.course_fee || 0,
        registration_deadline: s.registration_deadline ? s.registration_deadline.slice(0, 16) : '',
        status: s.status === 'full' ? 'open' : s.status || 'open',
        cover_image_url: s.cover_image_url || '',
        syllabus_pdf_url: s.syllabus_pdf_url || '',
        enable_auto_issuance: certSettings?.enable_auto_issuance ?? true,
        certificate_template: certSettings?.certificate_template || 'standard_attendance',
        require_attendance_rate: (certSettings?.min_attendance_rate ?? 0) > 0,
        min_attendance_rate: certSettings?.min_attendance_rate ?? 80,
        require_passing_grade: (certSettings?.min_passing_grade ?? 0) > 0,
        min_passing_grade: certSettings?.min_passing_grade ?? 75,
        require_payment_cleared: certSettings?.require_payment_cleared ?? true,
        authorized_signatory: certSettings?.authorized_signatory || '',
        digital_signature_url: certSettings?.digital_signature_url || '',
        enable_verification_qr: certSettings?.enable_verification_qr ?? true,
        distribute_dashboard: certSettings?.distribution_methods?.dashboard ?? true,
        distribute_email: certSettings?.distribution_methods?.email ?? true,
      })
    }
  }, [sessionToEdit, reset])

  const deliveryMode = watch('delivery_mode')
  const enableAutoIssuance = watch('enable_auto_issuance')
  const coverImageUrl = watch('cover_image_url')
  const syllabusPdfUrl = watch('syllabus_pdf_url')
  const digitalSignatureUrl = watch('digital_signature_url')
  const requireAttendance = watch('require_attendance_rate')
  const requireGrade = watch('require_passing_grade')

  // Upload Handlers
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingBanner(true)
    const res = await uploadImage(file)
    setUploadingBanner(false)
    if (res.success && res.data?.url) {
      setValue('cover_image_url', res.data.url)
      toast.success('Cover image uploaded successfully')
    } else {
      toast.error(res.error || 'Failed to upload cover image')
    }
  }

  const handleSyllabusUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingSyllabus(true)
    const res = await uploadMessageAttachment(file)
    setUploadingSyllabus(false)
    if (res.success && res.data?.url) {
      setValue('syllabus_pdf_url', res.data.url)
      toast.success('Syllabus PDF uploaded successfully')
    } else {
      toast.error(res.error || 'Failed to upload syllabus PDF')
    }
  }

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingSignature(true)
    const res = await uploadImage(file)
    setUploadingSignature(false)
    if (res.success && res.data?.url) {
      setValue('digital_signature_url', res.data.url)
      toast.success('Digital signature uploaded successfully')
    } else {
      toast.error(res.error || 'Failed to upload signature')
    }
  }

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)

    // Find instructor name if selected from staff list
    let instructorName = data.instructor_name
    if (data.instructor_id && staffList?.length) {
      const st = staffList.find((s) => s.id === data.instructor_id)
      if (st) {
        instructorName = `${st.first_name || ''} ${st.last_name || ''}`.trim()
      }
    }

    const certificate_settings: CertificateSettings = {
      enable_auto_issuance: data.enable_auto_issuance,
      certificate_template: data.certificate_template,
      min_attendance_rate: data.require_attendance_rate ? data.min_attendance_rate : 0,
      min_passing_grade: data.require_passing_grade ? data.min_passing_grade : 0,
      require_payment_cleared: data.require_payment_cleared,
      authorized_signatory: data.authorized_signatory || '',
      digital_signature_url: data.digital_signature_url || null,
      enable_verification_qr: data.enable_verification_qr,
      distribution_methods: {
        dashboard: data.distribute_dashboard,
        email: data.distribute_email,
      },
    }

    const dto: CreateTrainingSessionDTO = {
      title: data.title,
      description: data.description || undefined,
      category: data.category || undefined,
      skill_level: data.skill_level,
      start_date: new Date(data.start_date).toISOString(),
      end_date: new Date(data.end_date).toISOString(),
      weekly_days: data.weekly_days,
      daily_time_range: data.daily_time_range || undefined,
      total_duration_hours: data.total_duration_hours || undefined,
      delivery_mode: data.delivery_mode,
      location_venue_link: data.location_venue_link || undefined,
      instructor_id: data.instructor_id || undefined,
      instructor_name: instructorName || undefined,
      total_seats: data.total_seats,
      course_fee: data.course_fee ?? 0,
      registration_deadline: data.registration_deadline ? new Date(data.registration_deadline).toISOString() : undefined,
      status: data.status,
      target_audience: data.target_audience,
      cover_image_url: data.cover_image_url || undefined,
      syllabus_pdf_url: data.syllabus_pdf_url || undefined,
      certificate_settings,
    }

    try {
      if (sessionToEdit) {
        const res = await trainingApi.updateSession(sessionToEdit.id, dto, campusId)
        if (res.success) {
          toast.success('Training session updated successfully!')
          onSaved?.()
          onClose()
        } else {
          toast.error(res.error || 'Failed to update training session')
        }
      } else {
        const res = await trainingApi.createSession(dto, campusId)
        if (res.success && res.data) {
          toast.success('Training session created successfully!')
          onSaved?.()
          onClose()
        } else {
          toast.error(res.error || 'Failed to create training session')
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Error saving training session')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-gradient-to-r from-[#57A3CC]/10 to-[#022172]/10">
          <div className="flex items-center gap-2 text-[#022172] dark:text-[#57A3CC]">
            <Sparkles className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent dark:text-white">
              {sessionToEdit ? 'Edit Training Session & Certificate Spec' : 'Complete Training Session & Certificate Builder'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Configure full training session parameters, schedule, access control, media, and auto-certificate criteria.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-5 w-full bg-muted/60 p-1 mb-6">
              <TabsTrigger value="basic" className="text-xs font-semibold gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                1. Basic Info
              </TabsTrigger>
              <TabsTrigger value="schedule" className="text-xs font-semibold gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                2. Schedule & Delivery
              </TabsTrigger>
              <TabsTrigger value="access" className="text-xs font-semibold gap-1.5">
                <Users className="h-3.5 w-3.5" />
                3. Access & Pricing
              </TabsTrigger>
              <TabsTrigger value="media" className="text-xs font-semibold gap-1.5">
                <UploadCloud className="h-3.5 w-3.5" />
                4. Media & Syllabus
              </TabsTrigger>
              <TabsTrigger value="certificate" className="text-xs font-semibold gap-1.5">
                <Award className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                5. Certificates
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: BASIC INFORMATION */}
            <TabsContent value="basic" className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="font-semibold text-sm">
                  Session Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder='e.g., "Introduction to Robotics"'
                  {...register('title')}
                  className="bg-background"
                />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="font-semibold text-sm">
                  Description & Curriculum
                </Label>
                <Textarea
                  id="description"
                  rows={4}
                  placeholder="Outline course goals, key topics, prerequisites, and learning outcomes…"
                  {...register('description')}
                  className="bg-background"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-sm">Course Category</Label>
                  <Controller
                    name="category"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {COURSE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-semibold text-sm">Skill Level</Label>
                  <Controller
                    name="skill_level"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select Skill Level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: SCHEDULE & DELIVERY */}
            <TabsContent value="schedule" className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="start_date" className="font-semibold text-sm">
                    Start Date & Time <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    {...register('start_date')}
                    className="bg-background"
                  />
                  {errors.start_date && (
                    <p className="text-xs text-destructive">{errors.start_date.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="end_date" className="font-semibold text-sm">
                    End Date & Time <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    {...register('end_date')}
                    className="bg-background"
                  />
                  {errors.end_date && (
                    <p className="text-xs text-destructive">{errors.end_date.message}</p>
                  )}
                </div>
              </div>

              {/* Weekly Days Multi-select */}
              <div className="space-y-2 pt-1">
                <Label className="font-semibold text-sm">Weekly Days</Label>
                <Controller
                  name="weekly_days"
                  control={control}
                  render={({ field }) => {
                    const currentDays = field.value || []
                    const toggleDay = (day: string) => {
                      if (currentDays.includes(day)) {
                        field.onChange(currentDays.filter((d) => d !== day))
                      } else {
                        field.onChange([...currentDays, day])
                      }
                    }
                    return (
                      <div className="flex flex-wrap gap-2">
                        {WEEKLY_DAYS_OPTIONS.map((day) => {
                          const active = currentDays.includes(day.id)
                          return (
                            <button
                              type="button"
                              key={day.id}
                              onClick={() => toggleDay(day.id)}
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                                active
                                  ? 'bg-[#022172] text-white border-[#022172] dark:bg-[#57A3CC] dark:border-[#57A3CC]'
                                  : 'bg-background hover:bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              {day.label}
                            </button>
                          )
                        })}
                      </div>
                    )
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="daily_time_range" className="font-semibold text-sm">
                    Daily Session Time
                  </Label>
                  <Input
                    id="daily_time_range"
                    placeholder='e.g., "04:00 PM – 06:00 PM"'
                    {...register('daily_time_range')}
                    className="bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="total_duration_hours" className="font-semibold text-sm">
                    Total Duration (Hours)
                  </Label>
                  <Input
                    id="total_duration_hours"
                    type="number"
                    min="0"
                    placeholder="e.g., 20"
                    {...register('total_duration_hours')}
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-sm">Delivery Mode</Label>
                  <Controller
                    name="delivery_mode"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select Delivery Mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_person">In-Person</SelectItem>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="location_venue_link" className="font-semibold text-sm">
                    {deliveryMode === 'in_person'
                      ? 'Location / Venue Address'
                      : deliveryMode === 'online'
                      ? 'Online Video Link (Zoom / Teams)'
                      : 'Location & Online Link'}
                  </Label>
                  <Input
                    id="location_venue_link"
                    placeholder={
                      deliveryMode === 'in_person'
                        ? 'e.g. Lab 2 - Main Campus'
                        : 'e.g. https://zoom.us/j/123456789'
                    }
                    {...register('location_venue_link')}
                    className="bg-background"
                  />
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: CAPACITY, PRICING & ACCESS */}
            <TabsContent value="access" className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-sm">Instructor / Trainer</Label>
                  <Controller
                    name="instructor_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(val) => {
                          field.onChange(val)
                          const st = staffList?.find((s) => s.id === val)
                          if (st) {
                            setValue(
                              'instructor_name',
                              `${st.first_name || ''} ${st.last_name || ''}`.trim()
                            )
                          }
                        }}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select Instructor / Staff" />
                        </SelectTrigger>
                        <SelectContent>
                          {staffList?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.first_name} {s.last_name} ({s.designation || 'Staff'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="instructor_name" className="font-semibold text-sm">
                    Custom Instructor Name (Optional)
                  </Label>
                  <Input
                    id="instructor_name"
                    placeholder='e.g., "Eng. Ahmed Hassan"'
                    {...register('instructor_name')}
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="total_seats" className="font-semibold text-sm">
                    Total Seats <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="total_seats"
                    type="number"
                    min="1"
                    placeholder="e.g., 15"
                    {...register('total_seats')}
                    className="bg-background"
                  />
                  {errors.total_seats && (
                    <p className="text-xs text-destructive">{errors.total_seats.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="course_fee" className="font-semibold text-sm">
                    Course Fee (LYD / USD)
                  </Label>
                  <Input
                    id="course_fee"
                    type="number"
                    min="0"
                    placeholder="0 for Free"
                    {...register('course_fee')}
                    className="bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-semibold text-sm">Initial Status</Label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open — Accept Registrations</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label className="font-semibold text-sm">Target Audience</Label>
                <Controller
                  name="target_audience"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'both', label: 'Both (Internal & External)', desc: 'Open to enrolled students & public' },
                        { id: 'internal', label: 'Internal Only', desc: 'Strictly for registered school students' },
                        { id: 'external', label: 'External Only', desc: 'Public participants outside school' },
                      ].map((aud) => {
                        const active = field.value === aud.id
                        return (
                          <label
                            key={aud.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              active
                                ? 'border-[#022172] bg-blue-50/50 dark:bg-blue-950/40 dark:border-[#57A3CC]'
                                : 'border-border bg-card hover:bg-muted/40'
                            }`}
                          >
                            <input
                              type="radio"
                              name="target_audience"
                              value={aud.id}
                              checked={active}
                              onChange={() => field.onChange(aud.id)}
                              className="sr-only"
                            />
                            <p className="text-xs font-bold text-foreground">{aud.label}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{aud.desc}</p>
                          </label>
                        )
                      })}
                    </div>
                  )}
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <Label htmlFor="registration_deadline" className="font-semibold text-sm">
                  Registration Deadline (Optional)
                </Label>
                <Input
                  id="registration_deadline"
                  type="datetime-local"
                  {...register('registration_deadline')}
                  className="bg-background"
                />
              </div>
            </TabsContent>

            {/* TAB 4: MEDIA & ATTACHMENTS */}
            <TabsContent value="media" className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cover Banner Upload */}
                <Card className="border-dashed border-2 p-4 flex flex-col items-center justify-center text-center space-y-3 bg-muted/20">
                  <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-[#022172] dark:text-[#57A3CC]">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Cover Image / Banner</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Banner image for the public course registration page (.png, .jpg)
                    </p>
                  </div>

                  {coverImageUrl ? (
                    <div className="w-full space-y-2">
                      <img
                        src={coverImageUrl}
                        alt="Cover Preview"
                        className="w-full h-32 object-cover rounded-md border border-border"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs text-destructive border-destructive/30"
                        onClick={() => setValue('cover_image_url', '')}
                      >
                        Remove Cover Image
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingBanner}
                        className="gap-2"
                        onClick={() => document.getElementById('cover-upload-input')?.click()}
                      >
                        {uploadingBanner ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UploadCloud className="h-4 w-4" />
                        )}
                        Upload Cover Image
                      </Button>
                      <input
                        id="cover-upload-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleBannerUpload}
                      />
                    </label>
                  )}
                </Card>

                {/* Syllabus PDF Upload */}
                <Card className="border-dashed border-2 p-4 flex flex-col items-center justify-center text-center space-y-3 bg-muted/20">
                  <div className="h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Syllabus / PDF Attachment</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Downloadable course curriculum and detailed agenda (.pdf)
                    </p>
                  </div>

                  {syllabusPdfUrl ? (
                    <div className="w-full space-y-2">
                      <div className="p-3 bg-card border rounded-md flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-4 w-4 text-amber-600 flex-shrink-0" />
                          <span className="truncate font-medium">Syllabus_Curriculum.pdf</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">
                          Uploaded
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs text-destructive border-destructive/30"
                        onClick={() => setValue('syllabus_pdf_url', '')}
                      >
                        Remove PDF
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingSyllabus}
                        className="gap-2"
                        onClick={() => document.getElementById('pdf-upload-input')?.click()}
                      >
                        {uploadingSyllabus ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        Upload Syllabus PDF
                      </Button>
                      <input
                        id="pdf-upload-input"
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={handleSyllabusUpload}
                      />
                    </label>
                  )}
                </Card>
              </div>
            </TabsContent>

            {/* TAB 5: CERTIFICATE SETTINGS & AUTO-ISSUANCE */}
            <TabsContent value="certificate" className="space-y-6">
              <Card className="border-purple-200 dark:border-purple-900 bg-purple-50/30 dark:bg-purple-950/20">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-bold text-sm text-foreground flex items-center gap-2">
                      <Award className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      Enable Automatic Certificate Issuance
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Automatically generate & award verified digital certificates upon completing session criteria
                    </p>
                  </div>
                  <Controller
                    name="enable_auto_issuance"
                    control={control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                </CardContent>
              </Card>

              {enableAutoIssuance && (
                <div className="space-y-6">
                  {/* Template Selection */}
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-sm">Certificate Template Design</Label>
                    <Controller
                      name="certificate_template"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select Certificate Template" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard_attendance">Standard Certificate of Attendance</SelectItem>
                            <SelectItem value="completion_excellence">Certificate of Completion & Excellence</SelectItem>
                            <SelectItem value="custom_professional">Custom Professional Credential</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Criteria Multi-select Checkboxes */}
                  <div className="space-y-3 p-4 bg-card rounded-lg border border-border">
                    <Label className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                      Auto-Issuance Qualification Criteria
                    </Label>
                    <div className="space-y-3">
                      {/* Attendance Rate Criterion */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                        <div className="flex items-center space-x-2">
                          <Controller
                            name="require_attendance_rate"
                            control={control}
                            render={({ field }) => (
                              <Checkbox
                                id="req-attendance"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            )}
                          />
                          <Label htmlFor="req-attendance" className="text-sm font-medium cursor-pointer">
                            Minimum Attendance Rate Required
                          </Label>
                        </div>
                        {requireAttendance && (
                          <div className="flex items-center gap-2 pl-6 sm:pl-0">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              className="w-20 h-8 text-xs bg-background"
                              {...register('min_attendance_rate')}
                            />
                            <span className="text-xs font-semibold">%</span>
                          </div>
                        )}
                      </div>

                      {/* Passing Grade Criterion */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                        <div className="flex items-center space-x-2">
                          <Controller
                            name="require_passing_grade"
                            control={control}
                            render={({ field }) => (
                              <Checkbox
                                id="req-grade"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            )}
                          />
                          <Label htmlFor="req-grade" className="text-sm font-medium cursor-pointer">
                            Minimum Passing Exam Grade Required
                          </Label>
                        </div>
                        {requireGrade && (
                          <div className="flex items-center gap-2 pl-6 sm:pl-0">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              className="w-20 h-8 text-xs bg-background"
                              {...register('min_passing_grade')}
                            />
                            <span className="text-xs font-semibold">%</span>
                          </div>
                        )}
                      </div>

                      {/* Full Payment Cleared Criterion */}
                      <div className="flex items-center space-x-2">
                        <Controller
                          name="require_payment_cleared"
                          control={control}
                          render={({ field }) => (
                            <Checkbox
                              id="req-payment"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        />
                        <Label htmlFor="req-payment" className="text-sm font-medium cursor-pointer">
                          Full Payment Cleared & Verified
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Authorized Signatory & Digital Stamp */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="authorized_signatory" className="font-semibold text-sm">
                        Authorized Signatory Name & Title
                      </Label>
                      <Input
                        id="authorized_signatory"
                        placeholder='e.g., "Dr. Ali Ahmad - Center Director"'
                        {...register('authorized_signatory')}
                        className="bg-background"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-semibold text-sm">Digital Signature & Stamp (.png)</Label>
                      <div className="flex items-center gap-3">
                        {digitalSignatureUrl ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={digitalSignatureUrl}
                              alt="Signature"
                              className="h-10 w-24 object-contain border rounded p-1 bg-white"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-xs text-destructive"
                              onClick={() => setValue('digital_signature_url', '')}
                            >
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <label className="cursor-pointer">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploadingSignature}
                              className="gap-2 text-xs"
                              onClick={() => document.getElementById('sig-upload-input')?.click()}
                            >
                              {uploadingSignature ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UploadCloud className="h-3.5 w-3.5" />
                              )}
                              Upload Transparent Seal
                            </Button>
                            <input
                              id="sig-upload-input"
                              type="file"
                              accept="image/png"
                              className="hidden"
                              onChange={handleSignatureUpload}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Verification QR Code Toggle */}
                  <Card className="p-4 bg-muted/20 border-border">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-sm flex items-center gap-2">
                          <QrCode className="h-4 w-4 text-[#022172] dark:text-[#57A3CC]" />
                          Verification QR Code
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Auto-generate unique QR code on each certificate linking to public verification page
                        </p>
                      </div>
                      <Controller
                        name="enable_verification_qr"
                        control={control}
                        render={({ field }) => (
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        )}
                      />
                    </div>
                  </Card>

                  {/* Distribution Method Checkboxes */}
                  <div className="space-y-2 pt-1">
                    <Label className="font-semibold text-sm">Certificate Distribution Methods</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center space-x-2 border p-3 rounded-lg bg-card">
                        <Controller
                          name="distribute_dashboard"
                          control={control}
                          render={({ field }) => (
                            <Checkbox
                              id="dist-dashboard"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        />
                        <Label htmlFor="dist-dashboard" className="text-xs font-medium cursor-pointer">
                          Available in Student/Parent Dashboard
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2 border p-3 rounded-lg bg-card">
                        <Controller
                          name="distribute_email"
                          control={control}
                          render={({ field }) => (
                            <Checkbox
                              id="dist-email"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        />
                        <Label htmlFor="dist-email" className="text-xs font-medium cursor-pointer">
                          Send Automatically via Email (PDF)
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t border-border pt-4 mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {sessionToEdit ? 'Update Training Session' : 'Save & Publish Session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
