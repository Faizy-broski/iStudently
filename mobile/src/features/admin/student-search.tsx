import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Initials } from '@/components/app/layout';
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
      <View className="border-brand-secondary bg-info-soft flex-row items-center gap-3 rounded-2xl border p-2.5">
        <Initials name={value.name} />
        <View className="flex-1">
          <Text className="text-sm font-semibold">{value.name}</Text>
          <Text className="text-muted-foreground text-[11px]">{value.number}</Text>
        </View>
        <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel={t('app.ss_change')} className="bg-card size-8 items-center justify-center rounded-full active:opacity-70">
          <Icon as={X} className="text-muted-foreground size-4" />
        </Pressable>
      </View>
    );
  }
  return (
    <View className="gap-1">
      <SearchBar value={q} onChangeText={setQ} placeholder={t('fees.generate.typeToSearch')} />
      {(results.data ?? []).length ? (
        <View className="border-info-soft dark:border-border bg-card overflow-hidden rounded-2xl border">
          {(results.data ?? []).map((s, i) => (
            <View key={s.id}>
              {i > 0 ? <Separator /> : null}
              <Pressable
                className="flex-row items-center gap-3 px-3 py-2.5 active:opacity-70"
                onPress={() => onChange({ id: s.id, name: shortName(s.profile) || s.student_number, number: s.student_number, gradeId: s.grade?.id ?? s.grade_level_id })}>
                <Initials name={shortName(s.profile) || s.student_number} size={32} />
                <View className="flex-1">
                  <Text className="text-sm font-semibold">{shortName(s.profile) || s.student_number}</Text>
                  <Text className="text-muted-foreground text-[11px]">{[s.student_number, s.grade?.name ?? s.grade_level].filter(Boolean).join(' · ')}</Text>
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {term.length >= 2 && results.data?.length === 0 ? <Text className="text-muted-foreground px-2 text-sm">{t('fees.generate.noStudentsFound')}</Text> : null}
    </View>
  );
}
