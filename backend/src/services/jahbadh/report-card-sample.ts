import {
  computeSubject,
  estimateFor,
  jgComponentsOf,
  jgGrade,
  jgRuleOf,
  type JgCell,
} from '../../lib/jahbadh'
import type { JgReportCardData } from './print.service'

/**
 * Worst-case sample report card for the design review (brief A2: "send a sample before building
 * all documents"): grade 10 (11 subjects, the longest), every option on, a long four-part name.
 * Marks are deterministic so the PDF is reproducible.
 */
export function sampleReportCardData(): JgReportCardData {
  const grade = jgGrade(10)!
  const rule = jgRuleOf(grade)
  let seed = 7
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  const subjects = grade.subjects.map((s) => {
    const comps = jgComponentsOf(s)
    const level = 0.62 + rand() * 0.36
    const cells: Record<string, JgCell> = {}
    comps.forEach((c) => (cells[c.id] = { value: Math.round(c.max * Math.min(1, level + (rand() - 0.5) * 0.12) * 2) / 2 }))
    const res = computeSubject(comps, cells, null, rule)
    const stages = [1, 2].map((stage) => {
      const inStage = comps.filter((c) => c.stage === stage)
      const works = inStage.filter((c) => !c.isExam).reduce((a, c) => a + (cells[c.id].value ?? 0), 0)
      const exam = inStage.filter((c) => c.isExam).reduce((a, c) => a + (cells[c.id].value ?? 0), 0)
      return { works, exam, total: works + exam, max: inStage.reduce((a, c) => a + c.max, 0) }
    })
    const max = stages.reduce((a, st) => a + st.max, 0)
    return {
      name: s.name,
      weeklyPeriods: s.weeklyPeriods,
      stages,
      max,
      minPass: rule.totalMin * max,
      final: res.final,
      round2: null,
      pct: res.finalPct,
      estimate: res.estimate,
      classAverage: Math.round(max * (0.6 + rand() * 0.2) * 10) / 10,
      trend: (stages[1].total / stages[1].max - stages[0].total / stages[0].max) * 100,
    }
  })
  const total = subjects.reduce((a, s) => a + (s.final ?? 0), 0)
  const max = subjects.reduce((a, s) => a + s.max, 0)
  const pct = total / max
  return {
    header: {
      schoolName: 'مدرسة الحرية للتعليم الثانوي',
      logoUrl: null,
      educationOffice: 'مراقبة التربية والتعليم بالرياينة',
      municipality: 'الرياينة',
      principal: 'أ. سالم عبد السلام المبروك',
      homeroomTeacher: 'أ. فاطمة علي الزوي',
    },
    title: 'صحيفة النتيجة النهائية للعام الدراسي',
    yearName: '2025 - 2026',
    gradeCode: grade.code,
    gradeName: grade.name,
    sectionName: 'أ',
    systemName: grade.systemName,
    stageNames: ['الفصل الأول', 'الفصل الثاني'],
    ruleText: grade.ruleText,
    student: {
      name: 'عبد الرحمن محمد عبد الله الشريف الورفلي',
      gender: 'male',
      nationality: 'ليبي',
      registrationNumber: '2025/10/0142',
      motherName: 'خديجة عبد السلام الهادي',
      birth: 'الرياينة — 2010/03/14',
      listNumber: 7,
    },
    subjects,
    total,
    max,
    pct,
    estimate: estimateFor(pct),
    rank: 2,
    classSize: 28,
    decision: `ناجح وينقل إلى الصف ${grade.nextGradeName}`,
    activities: [
      { name: 'التربية الفنية', levels: ['ممتاز', 'جيد جداً'] },
      { name: 'التربية الموسيقية', levels: ['جيد جداً', 'ممتاز'] },
      { name: 'التربية البدنية', levels: ['ممتاز', 'ممتاز'] },
    ],
    attendance: { excused: [2, 1], unexcused: [0, 1], schoolDays: [86, 90] },
    notes: ['طالب مجتهد ومنضبط، يشارك بفاعلية في الأنشطة.', 'تحسن ملحوظ في الرياضيات، يُنصح بمواصلة التدريب.'],
    guardianTips: [
      'تنظيم وقت الأبناء خارج المدرسة ومتابعة واجباتهم اليومية.',
      'التواصل مع المدرسة والاستفسار عن المستوى والسلوك.',
      'إفادة المدرسة بأسباب الغياب أولاً بأول.',
      'تشجيع الأبناء على المشاركة في النشاط المدرسي.',
    ],
    quote: 'النجاح رحلة تبدأ بخطوة، وكل يوم تتعلم فيه خطوة جديدة.',
    excelRate: 0.85,
    followRate: 0.5,
  }
}
