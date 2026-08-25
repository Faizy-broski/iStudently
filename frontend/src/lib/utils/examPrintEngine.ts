import { openPrintPreview } from './printLayout'
import { ExamHeaderConfig } from '@/components/admin/quiz/ExamHeaderSetup'
import { EditableQuestionItem } from '@/components/admin/quiz/RichTextQuestionEditor'

export type ExamPrintMode = 'student' | 'teacher_key' // Student Copy (نسخة الطالب) vs Answer Key (نموذج الإجابة)

export interface ExamPrintOptions {
  headerConfig: ExamHeaderConfig
  items: EditableQuestionItem[]
  mode: ExamPrintMode
  schoolLogoUrl?: string | null
  ministryLogoUrl?: string | null
}

export function generateAndPrintExam({
  headerConfig,
  items,
  mode,
  schoolLogoUrl,
  ministryLogoUrl,
}: ExamPrintOptions) {
  const isTeacherKey = mode === 'teacher_key'

  // Header Title & Stamp Badge
  const modeBadgeText = isTeacherKey ? 'نموذج الإجابة (خاص بالمعلم / لجنة التصحيح)' : 'نسخة الطالب (Student Copy)'

  // Dual Header Logos: School Logo (Right) & Ministry Logo (Left)
  const schoolLogoHtml = schoolLogoUrl
    ? `<img src="${schoolLogoUrl}" style="max-height:75px;max-width:130px;object-fit:contain;" alt="School Logo" />`
    : `<div style="font-weight:bold;font-size:14px;color:#1e3a5f;">${headerConfig.school_name || 'School'}</div>`

  const ministryLogoHtml = ministryLogoUrl
    ? `<img src="${ministryLogoUrl}" style="max-height:75px;max-width:130px;object-fit:contain;" alt="Ministry Logo" />`
    : `<div style="font-weight:bold;font-size:12px;color:#555;">مراقبة التعليم<br/>Education Monitoring</div>`

  // Official Ministry Style Header Block
  const headerHtml = `
    <div style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; text-align: right; margin-bottom: 24px; border: 2px solid #1e3a5f; padding: 16px; border-radius: 8px; background: #fafafa;">
      
      <!-- Top Branding Row with Logos -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 12px;">
        <div style="text-align:right;">
          ${schoolLogoHtml}
        </div>

        <div style="text-align:center;">
          <h2 style="margin:0; font-size:18px; font-weight:800; color:#1e3a5f;">${headerConfig.school_name || 'المدرسة'}</h2>
          <div style="font-size:13px; font-weight:600; color:#444; margin-top:4px;">
            ${headerConfig.education_monitoring || 'مراقبة التعليم'}
          </div>
          <div style="display:inline-block; margin-top:6px; padding:3px 12px; border-radius:12px; font-size:11px; font-weight:bold; ${isTeacherKey ? 'background:#fee2e2; color:#b91c1c; border:1px solid #f87171;' : 'background:#e0f2fe; color:#0369a1; border:1px solid #38bdf8;'}">
            ${modeBadgeText}
          </div>
        </div>

        <div style="text-align:left;">
          ${ministryLogoHtml}
        </div>
      </div>

      <!-- Exam Details Grid -->
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 13px; color: #222; border-bottom: 1px dashed #ccc; padding-bottom: 12px; margin-bottom: 12px;">
        <div><strong>المادة (Material):</strong> ${headerConfig.material || '________________'}</div>
        <div><strong>الصف (Classroom):</strong> ${headerConfig.classroom || '________________'}</div>
        <div><strong>الفصل (Semester):</strong> ${headerConfig.semester || '________________'}</div>
        
        <div><strong>السنة الدراسية (Academic Year):</strong> ${headerConfig.academic_year || '________________'}</div>
        <div><strong>زمن الامتحان (Duration):</strong> ${headerConfig.duration || '________________'}</div>
        <div><strong>الدرجة الكلية (Total Score):</strong> <span style="font-weight:bold; color:#1e3a5f;">${headerConfig.total_marks} نقطة</span></div>

        <div><strong>تاريخ الامتحان (Date):</strong> ${headerConfig.exam_date || '____ / ____ / ________'}</div>
        <div><strong>استاذ المادة (Teacher):</strong> ${headerConfig.teacher_name || '________________'}</div>
        <div><strong>نوع الامتحان (Type):</strong> ${headerConfig.exam_type || 'امتحان نهائي'}</div>
      </div>

      <!-- Student Name Line (Student Copy) -->
      ${
        !isTeacherKey
          ? `
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:bold; color:#111;">
            <div>اسم الطالب (Student Name): ____________________________________________________</div>
            <div>رقم القيد / رقم الجلوس: ____________</div>
          </div>
        `
          : ''
      }

      <!-- Instructions Box -->
      ${
        headerConfig.exam_instructions
          ? `
          <div style="margin-top:10px; padding:8px 12px; background:#fff; border-right:4px solid #f59e0b; border-radius:4px; font-size:12px; color:#444;">
            <strong>تعليمات مهمة (Instructions):</strong> ${headerConfig.exam_instructions}
          </div>
        `
          : ''
      }
    </div>
  `

  // Render Questions Body
  const questionsHtml = items
    .map((item, idx) => {
      const q = item
      const num = idx + 1
      let answerSpace = ''

      // Answer rendering per type
      switch (q.type) {
        case 'select':
        case 'multiple': {
          const opts =
            q.answer_options && q.answer_options.length > 0
              ? q.answer_options
              : (q.description || '').split('\n').filter(Boolean)

          const isMulti = q.type === 'multiple'
          const correctKey = q.correct_answer

          answerSpace = `
            <div style="margin-top:10px; display:grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding-right: 20px;">
              ${opts
                .map(opt => {
                  const isCorrect = isTeacherKey && (
                    isMulti
                      ? Array.isArray(correctKey) && correctKey.includes(opt)
                      : correctKey === opt
                  )

                  return `
                    <div style="display:flex; align-items:center; gap:8px; font-size:13px; ${isCorrect ? 'color:#b91c1c; font-weight:bold;' : 'color:#333;'}">
                      <span style="display:inline-block; width:18px; height:18px; border:1.5px solid ${isCorrect ? '#b91c1c' : '#666'}; ${isMulti ? 'border-radius:3px;' : 'border-radius:50%;'} background:${isCorrect ? '#fee2e2' : '#fff'}; text-align:center; line-height:16px; font-size:12px;">
                        ${isCorrect ? '✓' : ''}
                      </span>
                      <span>${opt}</span>
                    </div>
                  `
                })
                .join('')}
            </div>
          `
          break
        }

        case 'textarea':
        case 'text': {
          const linesCount = q.blank_lines_count > 0 ? q.blank_lines_count : 4
          if (isTeacherKey && q.correct_answer) {
            answerSpace = `
              <div style="margin-top:10px; padding:10px 14px; background:#fff5f5; border-right:3px solid #ef4444; border-radius:6px; font-size:13px; color:#991b1b;">
                <strong>نموذج الإجابة (Answer Key):</strong><br/>
                ${q.correct_answer}
              </div>
            `
          } else {
            answerSpace = `
              <div style="margin-top:10px; padding-right:15px;">
                ${Array.from({ length: linesCount })
                  .map(
                    () =>
                      `<div style="border-bottom:1px solid #d1d5db; height:28px; margin-bottom:4px;"></div>`
                  )
                  .join('')}
              </div>
            `
          }
          break
        }

        default: {
          answerSpace = `<div style="border-bottom:1px dashed #ccc; height:30px; margin-top:8px;"></div>`
          break
        }
      }

      return `
        <div style="margin-bottom:24px; page-break-inside:avoid; direction:rtl; text-align:right;">
          <div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid #e5e7eb; padding-bottom:6px;">
            <div style="font-size:15px; font-weight:bold; color:#1e3a5f; flex:1;">
              السؤال ${num}: ${q.title}
            </div>
            <div style="font-size:12px; font-weight:bold; color:#4b5563; background:#f3f4f6; padding:2px 8px; border-radius:4px; margin-left:8px;">
              [ ${q.allocated_marks} درجات ]
            </div>
          </div>

          ${
            q.image_url
              ? `
            <div style="margin-top:10px; text-align:center;">
              <img src="${q.image_url}" style="max-height:220px; max-width:100%; object-contain; border:1px solid #ddd; border-radius:6px; padding:4px;" alt="Diagram" />
            </div>
          `
              : ''
          }

          ${answerSpace}
        </div>
      `
    })
    .join('')

  const bodyHtml = `
    <div class="official-exam-sheet">
      ${headerHtml}
      ${questionsHtml}
    </div>
  `

  const bodyStyles = `
    @page { size: A4; margin: 15mm; }
    .official-exam-sheet { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #111; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `

  openPrintPreview({
    title: `${headerConfig.material || 'Exam'} - ${isTeacherKey ? 'Answer Key' : 'Student Copy'}`,
    bodyHtml,
    bodyStyles,
    school: {
      name: headerConfig.school_name || 'School',
      logo_url: schoolLogoUrl || null,
    } as any,
    pdfSettings: null,
    pluginActive: false, // Clean custom exam header layout
  })
}
