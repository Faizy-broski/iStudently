import { Stack, useLocalSearchParams } from 'expo-router';
import { GraduationCap, Mail, Phone, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, RefreshControl, ScrollView } from 'react-native';

import { DetailHeader } from '@/components/app/layout';
import { InfoRow, Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { CustomFieldValues } from '@/features/admin/custom-field-values';
import { ConfidentialBadge } from '@/features/admin/people-extras';
import { useCampus } from '@/features/campus/campus';
import { useTeacherStudents } from '@/features/teacher/students';
import { adminCustomFields, adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';

/** One student of the teacher's sections with contact details and custom fields (web: /teacher/students/[studentId]). */
export default function TeacherStudentDetail() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.studentDetail.${key}`, o);
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const { campusId } = useCampus();
  const mine = useTeacherStudents(true);
  const full = useApi(studentId ? ['teacher', 'student', studentId, campusId ?? 'school'] : null, ([, , id]) => adminStudents.get(campusId ?? undefined, id as string));
  const defs = useApi(['teacher', 'custom-fields', 'student', campusId ?? 'school'], () => adminCustomFields.list('student', campusId ?? undefined));
  const s = (mine.data ?? []).find((x) => x.id === studentId) ?? null;

  if (mine.isLoading) return <LoadingList rows={4} />;
  if (!s) return <EmptyState icon={GraduationCap} title={k('studentNotFound')} body={k('studentNotInSections')} />;
  const name = [s.profile?.first_name, s.profile?.last_name].filter(Boolean).join(' ') || k('unknown');
  const father = full.data?.profile?.father_name;
  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([mine.mutate(), full.mutate()])} />}>
        <DetailHeader
          name={name}
          photo={full.data?.profile?.profile_photo_url ?? null}
          subtitle={k('idLabel', { id: s.student_number })}
          chips={
            <>
              {s.grade_level ? <StatusChip label={s.grade_level} tone="info" /> : null}
              <StatusChip label={k('active')} tone="success" />
              <ConfidentialBadge status={full.data?.confidential_family_status ?? s.confidential_family_status} />
            </>
          }
        />
        {s.profile?.email || s.profile?.phone || father ? (
          <Panel>
            <InfoRow icon={Mail} label={k('email')} value={s.profile?.email} onPress={() => Linking.openURL(`mailto:${s.profile?.email}`)} last={!s.profile?.phone && !father} />
            <InfoRow icon={Phone} label={k('phone')} value={s.profile?.phone} onPress={() => Linking.openURL(`tel:${s.profile?.phone}`)} last={!father} />
            <InfoRow icon={User} label={k('fathersName')} value={father} last />
          </Panel>
        ) : null}
        <CustomFieldValues defs={defs.data} values={full.data?.custom_fields} hideEmpty />
      </ScrollView>
    </>
  );
}
