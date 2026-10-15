import type { AdminQuestionType, DifficultyLevel } from '@studently/api-client';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { Label } from '@/components/ui/label';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminQuiz } from '@/lib/api';
import { useApi } from '@/lib/data';

export const QUESTION_TYPES: AdminQuestionType[] = ['select', 'multiple', 'gap', 'text', 'textarea', 'matching', 'anatomy_label'];
/** Types the AI import can draft (no 3D anatomy). */
export const AI_QUESTION_TYPES: AdminQuestionType[] = ['select', 'multiple', 'gap', 'text', 'textarea', 'matching'];
export const DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard'];
export const NONE = '__none__';

/** The web's `quiz` namespace. */
export function useQz() {
  const { t } = useTranslation();
  return (k: string, o?: Record<string, unknown>) => t(`quiz.${k}`, o);
}

export function useQuizCategories() {
  const { campusId } = useCampus();
  return useApi(['admin', 'quiz-categories', campusId ?? 'school'], () => adminQuiz.categories(campusId));
}

/** Grade level → subject (→ chapter) pickers, "None" allowed at each step (web: question dialog, AI import). */
export function GradeSubjectPickers({
  gradeId,
  subjectId,
  chapterId,
  onChange,
  withChapter = false,
}: {
  gradeId: string;
  subjectId: string;
  chapterId?: string;
  onChange: (v: { gradeId: string; subjectId: string; chapterId: string }) => void;
  withChapter?: boolean;
}) {
  const q = useQz();
  const { campusId } = useCampus();
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const subjects = useApi(gradeId ? ['admin', 'subjects', campusId ?? 'school', gradeId] : null, ([, , , g]) => adminAcademics.subjects(campusId, g as string));
  const chapters = useApi(withChapter && subjectId ? ['admin', 'quiz-chapters', subjectId] : null, ([, , s]) => adminQuiz.chapters(s as string));
  const none = { value: NONE, label: q('none') };
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <View className="flex-1 gap-1">
          <Label>{q('gradeLevel')}</Label>
          <Picker value={gradeId || NONE} onChange={(v) => onChange({ gradeId: v === NONE ? '' : v, subjectId: '', chapterId: '' })} options={[none, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]} />
        </View>
        <View className="flex-1 gap-1">
          <Label>{q('subject')}</Label>
          <Picker
            value={subjectId || NONE}
            onChange={(v) => onChange({ gradeId, subjectId: v === NONE ? '' : v, chapterId: '' })}
            options={[none, ...(gradeId ? (subjects.data ?? []) : []).map((s) => ({ value: s.id, label: s.name }))]}
          />
        </View>
      </View>
      {withChapter ? (
        <View className="gap-1">
          <Label>{q('chapter', { defaultValue: 'Chapter' })}</Label>
          <Picker
            value={chapterId || NONE}
            onChange={(v) => onChange({ gradeId, subjectId, chapterId: v === NONE ? '' : v })}
            options={[none, ...(subjectId ? (chapters.data ?? []) : []).map((c) => ({ value: c.id, label: c.title }))]}
          />
        </View>
      ) : null}
    </View>
  );
}
