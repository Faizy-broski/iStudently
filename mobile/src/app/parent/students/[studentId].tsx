import { Stack, useLocalSearchParams } from 'expo-router';
import { Calendar, GraduationCap, Mail, MapPin, Phone, User, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { PersonAvatar } from '@/components/app/person-avatar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
        <Card>
          <CardContent className="gap-4 p-4">
            <View className="flex-row items-start gap-4">
              <PersonAvatar url={student.profile_photo_url} name={name} size={64} />
              <View className="flex-1 gap-1.5">
                <Text className="text-xl font-bold">{name}</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  <Badge variant="secondary" className="flex-row items-center gap-1">
                    <Icon as={GraduationCap} className="text-foreground size-3" />
                    <Text className="text-xs">{`${student.grade_level} — ${student.section}`}</Text>
                  </Badge>
                  {student.campus_name ? (
                    <Badge variant="outline" className="flex-row items-center gap-1">
                      <Icon as={MapPin} className="text-foreground size-3" />
                      <Text className="text-xs">{student.campus_name}</Text>
                    </Badge>
                  ) : null}
                </View>
                <Text className="text-muted-foreground text-sm">{`${k('id')}: ${student.student_number}`}</Text>
              </View>
            </View>
            {s?.email ? <Tile icon={Mail} tone="text-blue-600" label={k('email')} value={s.email} onPress={() => Linking.openURL(`mailto:${s.email}`)} /> : null}
            {s?.phone ? <Tile icon={Phone} tone="text-green-600" label={k('phone')} value={s.phone} onPress={() => Linking.openURL(`tel:${s.phone}`)} /> : null}
            {s?.father_name ? <Tile icon={User} tone="text-purple-600" label={k('father')} value={s.father_name} /> : null}
            {dob ? <Tile icon={Calendar} tone="text-orange-600" label={k('dob')} value={dob} /> : null}
          </CardContent>
        </Card>
        <CustomFieldValues defs={defs.data} values={s?.custom_fields} hideEmpty />
      </ScrollView>
    </>
  );
}

function Tile({ icon, tone, label, value, onPress }: { icon: LucideIcon; tone: string; label: string; value: string; onPress?: () => void }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'link' : undefined} className="bg-muted/50 flex-row items-center gap-3 rounded-lg p-3">
      <Icon as={icon} className={`size-4 ${tone}`} />
      <View className="flex-1">
        <Text className="text-muted-foreground text-xs">{label}</Text>
        <Text className={onPress ? 'text-sm font-medium text-blue-600' : 'text-sm font-medium'}>{value}</Text>
      </View>
    </Pressable>
  );
}
