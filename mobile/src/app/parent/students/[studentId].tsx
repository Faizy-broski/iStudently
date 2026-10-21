import { Stack, useLocalSearchParams } from 'expo-router';
import { Calendar, GraduationCap, Mail, MapPin, Phone, User, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';

import { PersonHero } from '@/components/app/layout';
import { InfoRow, Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CustomFieldValues } from '@/features/admin/custom-field-values';
import { useChild } from '@/features/parent/child';
import { adminCustomFields, parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import i18n from '@/i18n';

/** One linked child's profile card and custom fields (web: /parent/students/[studentId]). */
export default function ParentStudentDetail() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.pa_si_${key}`);
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const { children: kids, isLoading } = useChild();
  const student = kids.find((c) => c.id === studentId) ?? null;
  const campusId = student?.campus_id ?? null;
  const info = useApi(studentId ? ['parent', 'student-info', studentId] : null, ([, , id]) => parent.getStudentInfo(id as string));
  const defs = useApi(campusId ? ['parent', 'custom-fields', 'student', campusId] : null, ([, , , c]) => adminCustomFields.list('student', c as string));

  if (isLoading) return <LoadingList rows={4} />;
  if (!student) return <EmptyState icon={GraduationCap} title={k('not_found')} />;
  const name = `${student.first_name} ${student.last_name}`;
  const s = info.data;
  const dob = s?.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([info.mutate(), defs.mutate()])} />}>
        <PersonHero
          name={name}
          photo={student.profile_photo_url}
          subtitle={`${k('id')}: ${student.student_number}`}
          chips={
            <>
              <HeroChip icon={GraduationCap} label={`${student.grade_level} — ${student.section}`} />
              {student.campus_name ? <HeroChip icon={MapPin} label={student.campus_name} /> : null}
            </>
          }
        />
        {s?.email || s?.phone || s?.father_name || dob ? (
          <Panel>
            <InfoRow icon={Mail} label={k('email')} value={s?.email} onPress={s?.email ? () => Linking.openURL(`mailto:${s.email}`) : undefined} />
            <InfoRow icon={Phone} label={k('phone')} value={s?.phone} onPress={s?.phone ? () => Linking.openURL(`tel:${s.phone}`) : undefined} />
            <InfoRow icon={User} label={k('father')} value={s?.father_name} />
            <InfoRow icon={Calendar} label={k('dob')} value={dob} last />
          </Panel>
        ) : null}
        <CustomFieldValues defs={defs.data} values={s?.custom_fields} hideEmpty />
      </ScrollView>
    </>
  );
}

function HeroChip({ icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
      <Icon as={icon} className="size-3 text-white" />
      <Text className="text-[11px] font-semibold text-white">{label}</Text>
    </View>
  );
}
