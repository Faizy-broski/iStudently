import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { SearchBar } from '@/components/app/search-bar';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';

export interface PickedStudent {
  id: string;
  name: string;
  number: string;
  gradeId?: string | null;
}

/** Search the campus's students and pick one (type at least 2 characters). */
export function StudentSearchSelect({ value, onChange }: { value: PickedStudent | null; onChange: (s: PickedStudent | null) => void }) {
  const { t } = useTranslation();
  const { campusId } = useCampus();
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim());
  const results = useApi(term.length >= 2 && !value ? ['admin', 'student-search', campusId ?? 'school', term] : null, () =>
    adminStudents.list(campusId, { search: term, limit: 8, is_active: true }),
  );

  if (value) {
    return (
      <View className="border-border flex-row items-center gap-3 rounded-md border px-3 py-2">
        <View className="flex-1">
          <Text className="font-medium">{value.name}</Text>
          <Text className="text-muted-foreground text-xs">{value.number}</Text>
        </View>
        <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel={t('app.ss_change')}>
          <Icon as={X} className="text-muted-foreground size-5" />
        </Pressable>
      </View>
    );
  }
  return (
    <View className="gap-1">
      <SearchBar value={q} onChangeText={setQ} placeholder={t('fees.generate.typeToSearch')} />
      {(results.data ?? []).map((s, i) => (
        <View key={s.id}>
          {i > 0 ? <Separator /> : null}
          <Pressable
            className="px-2 py-2.5"
            onPress={() => onChange({ id: s.id, name: shortName(s.profile) || s.student_number, number: s.student_number, gradeId: s.grade?.id ?? s.grade_level_id })}>
            <Text>{shortName(s.profile) || s.student_number}</Text>
            <Text className="text-muted-foreground text-xs">{[s.student_number, s.grade?.name ?? s.grade_level].filter(Boolean).join(' · ')}</Text>
          </Pressable>
        </View>
      ))}
      {term.length >= 2 && results.data?.length === 0 ? <Text className="text-muted-foreground px-2 text-sm">{t('fees.generate.noStudentsFound')}</Text> : null}
    </View>
  );
}
