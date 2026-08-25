'use client'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Clock, Calendar, GraduationCap, Building2, User, HelpCircle, FileText, CheckCircle2 } from 'lucide-react'

export interface ExamHeaderConfig {
  material: string // Subject name
  semester: string // Term/Semester (e.g., First semester, Second semester)
  exam_type: string // e.g. Final Exam, Midterm Exam
  exam_date: string
  school_name: string
  education_monitoring: string // Education monitoring / Ministry header
  classroom: string // Grade level / Class name
  duration: string // e.g. "2 Hours", "90 Minutes"
  academic_year: string // e.g. "2026-2027"
  total_marks: number // Maximum exam score
  auto_calculate_marks: boolean
  teacher_name: string
  exam_instructions: string // General instructions
  logo_url?: string | null
  ministry_logo_url?: string | null
}

interface ExamHeaderSetupProps {
  config: ExamHeaderConfig
  onChange: (updated: Partial<ExamHeaderConfig>) => void
  calculatedTotalPoints: number
}

export function ExamHeaderSetup({ config, onChange, calculatedTotalPoints }: ExamHeaderSetupProps) {
  // Sync auto calculated total marks if enabled
  React.useEffect(() => {
    if (config.auto_calculate_marks && config.total_marks !== calculatedTotalPoints) {
      onChange({ total_marks: calculatedTotalPoints })
    }
  }, [config.auto_calculate_marks, calculatedTotalPoints, config.total_marks, onChange])

  return (
    <Card className="border shadow-sm rounded-xl overflow-hidden bg-card">
      <CardHeader className="bg-muted/40 pb-3 border-b">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> Official Exam Header & Metadata Setup
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Row 1: Academic & Exam Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Subject / Material (المادة)</Label>
            <Input
              value={config.material}
              onChange={e => onChange({ material: e.target.value })}
              placeholder="e.g., Mathematics / الرياضيات"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Semester (الفصل الدراسي)</Label>
            <Select value={config.semester} onValueChange={v => onChange({ semester: v })}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select Semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="First semester">First Semester (الفصل الأول)</SelectItem>
                <SelectItem value="Second semester">Second Semester (الفصل الثاني)</SelectItem>
                <SelectItem value="Summer term">Summer Term (الفصل الصيفي)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Exam Type (نوع الامتحان)</Label>
            <Select value={config.exam_type} onValueChange={v => onChange({ exam_type: v })}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="final exam">Final Exam (امتحان نهاية الفصل)</SelectItem>
                <SelectItem value="midterm exam">Mid-Term Exam (امتحان منتصف الفصل)</SelectItem>
                <SelectItem value="monthly exam">Monthly Test (اختبار شهري)</SelectItem>
                <SelectItem value="quiz">Quiz (اختبار قصير)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: School & Ministry Header Info */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">School Name (اسم المدرسة)</Label>
            <Input
              value={config.school_name}
              onChange={e => onChange({ school_name: e.target.value })}
              placeholder="e.g., Prime Star International School"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Education Monitoring (مراقبة التعليم)</Label>
            <Input
              value={config.education_monitoring}
              onChange={e => onChange({ education_monitoring: e.target.value })}
              placeholder="e.g., Education Monitoring - Central District"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Classroom / Grade (الصف الدراسي)</Label>
            <Input
              value={config.classroom}
              onChange={e => onChange({ classroom: e.target.value })}
              placeholder="e.g., Ninth grade / الصف التاسع"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Academic Year (السنة الدراسية)</Label>
            <Input
              value={config.academic_year}
              onChange={e => onChange({ academic_year: e.target.value })}
              placeholder="e.g., 2026-2027"
              className="h-9 text-xs"
            />
          </div>
        </div>

        {/* Row 3: Exam Logistics & Scoring */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Exam Date
            </Label>
            <Input
              type="date"
              value={config.exam_date}
              onChange={e => onChange({ exam_date: e.target.value })}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Duration
            </Label>
            <Input
              value={config.duration}
              onChange={e => onChange({ duration: e.target.value })}
              placeholder='e.g., "2 Hours" or "90 Minutes"'
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-muted-foreground" /> Teacher Name
            </Label>
            <Input
              value={config.teacher_name}
              onChange={e => onChange({ teacher_name: e.target.value })}
              placeholder="Subject teacher name"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Total Score / Marks</Label>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>Auto Sum</span>
                <Switch
                  checked={config.auto_calculate_marks}
                  onCheckedChange={c => onChange({ auto_calculate_marks: c })}
                />
              </div>
            </div>
            <Input
              type="number"
              min={0}
              disabled={config.auto_calculate_marks}
              value={config.total_marks}
              onChange={e => onChange({ total_marks: Number(e.target.value) })}
              className="h-9 text-xs font-bold text-primary"
            />
          </div>
        </div>

        {/* Exam Instructions Box */}
        <div className="space-y-1.5 pt-1">
          <Label className="text-xs font-semibold flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-amber-500" /> General Exam Instructions & Guidelines (تعليمات الامتحان)
          </Label>
          <Textarea
            value={config.exam_instructions}
            onChange={e => onChange({ exam_instructions: e.target.value })}
            placeholder="e.g. Answer all questions. No calculators allowed. Write clearly in ink."
            rows={2}
            className="text-xs resize-none"
          />
        </div>
      </CardContent>
    </Card>
  )
}
