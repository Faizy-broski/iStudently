import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Grade + section pickers shared by the delivery matrix and return mode. */
export function GradeSectionPicker({ ns, grade, section, onGrade, onSection }: { ns: 'matrix' | 'returnMode'; grade: string; section: string; onGrade: (g: string) => void; onSection: (s: string) => void }) {
  const { t } = useTranslation();
  const { campusId } = useCampus();
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const sections = useApi(grade ? ['admin', 'sections', campusId ?? 'school', grade] : null, ([, , , g]) => adminAcademics.sections(campusId, g as string));
  return (
    <View className="flex-row gap-2">
      <View className="flex-1">
        <Picker
          value={grade}
          onChange={(g) => {
            onGrade(g);
            onSection('');
          }}
          placeholder={t(`textbooks.${ns}.selectGradePlaceholder`)}
          options={(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
        />
      </View>
      <View className="flex-1" pointerEvents={grade ? 'auto' : 'none'} style={{ opacity: grade ? 1 : 0.5 }}>
        <Picker
          value={section}
          onChange={onSection}
          placeholder={sections.isLoading ? t(`textbooks.${ns}.loading`) : t(`textbooks.${ns}.selectSectionPlaceholder`)}
          options={(sections.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
        />
      </View>
    </View>
  );
}
