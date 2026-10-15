import { Stack, useLocalSearchParams } from 'expo-router';
import { GraduationCap, Mail, Phone, User, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { PersonAvatar } from '@/components/app/person-avatar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
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
        <Card>
          <CardContent className="gap-4 p-4">
            <View className="flex-row items-start gap-4">
              <PersonAvatar url={full.data?.profile?.profile_photo_url ?? null} name={name} size={64} />
              <View className="flex-1 gap-1.5">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-xl font-bold text-[#022172] dark:text-white">{name}</Text>
                  <ConfidentialBadge status={full.data?.confidential_family_status ?? s.confidential_family_status} />
                </View>
                <View className="flex-row flex-wrap gap-1.5">
                  {s.grade_level ? (
                    <Badge variant="secondary">
                      <Text className="text-xs">{s.grade_level}</Text>
                    </Badge>
                  ) : null}
                  <Badge>
                    <Text className="text-xs">{k('active')}</Text>
                  </Badge>
                </View>
                <Text className="text-muted-foreground text-sm">{k('idLabel', { id: s.student_number })}</Text>
              </View>
            </View>
            {s.profile?.email ? <Tile icon={Mail} label={k('email')} value={s.profile.email} onPress={() => Linking.openURL(`mailto:${s.profile?.email}`)} /> : null}
            {s.profile?.phone ? <Tile icon={Phone} label={k('phone')} value={s.profile.phone} onPress={() => Linking.openURL(`tel:${s.profile?.phone}`)} /> : null}
            {father ? <Tile icon={User} label={k('fathersName')} value={father} /> : null}
          </CardContent>
        </Card>
        <CustomFieldValues defs={defs.data} values={full.data?.custom_fields} hideEmpty />
      </ScrollView>
    </>
  );
}

function Tile({ icon, label, value, onPress }: { icon: LucideIcon; label: string; value: string; onPress?: () => void }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'link' : undefined} className="bg-muted/40 flex-row items-center gap-3 rounded-lg p-3">
      <Icon as={icon} className="size-4 text-blue-600" />
      <View className="flex-1">
        <Text className="text-muted-foreground text-xs">{label}</Text>
        <Text className={onPress ? 'text-sm font-medium text-blue-600' : 'text-sm font-medium'}>{value}</Text>
      </View>
    </Pressable>
  );
}
