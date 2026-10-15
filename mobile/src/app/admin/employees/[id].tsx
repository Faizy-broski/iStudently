import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Mail, Pencil, Phone } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { InfoCard, InfoRow } from '@/components/app/info';
import { PersonAvatar } from '@/components/app/person-avatar';
import { ErrorState, LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CustomFieldValues } from '@/features/admin/custom-field-values';
import { PerformanceCard, QualificationsCard, VerifyQr } from '@/features/admin/employee-extras';
import { AccessRoleCard, CredentialsCard } from '@/features/admin/people-extras';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminCustomFields, adminEmployees, auth } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { useAction } from '@/lib/use-action';

/** One teacher or staff member (web: /admin/teachers/[employeeNumber], /admin/staff/...). */
export default function EmployeeDetail() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const kind = kindParam === 'staff' ? 'staff' : 'teacher';
  const ns = kind === 'teacher' ? 'teachers' : 'staff';
  const f = (k: string) => t(`teachers.fields.${k}`);
  const { campusId } = useCampus();
  const emp = useApi(['admin', 'employee', kind, id], () => adminEmployees.get(kind, id));
  const e = emp.data;
  const profileId = e?.profile_id ?? null;
  const lastLogin = useApi(profileId ? ['admin', 'last-login', profileId] : null, ([, , pid]) => auth.lastLogin(pid));
  const defs = useApi(['admin', 'custom-fields', kind, campusId ?? 'school'], () => adminCustomFields.list(kind, campusId));
  const assignments = useApi(kind === 'teacher' ? ['admin', 'teacher-assignments', campusId ?? 'school', id] : null, ([, , , tid]) => adminEmployees.assignments(campusId, { teacher_id: tid as string }));
  // Previous / next person in the campus list (web: the profile's arrows).
  const roster = useApi(['admin', 'employee-roster', kind, campusId ?? 'school'], () => adminEmployees.list(kind, campusId, { page: 1, limit: 1000 }));
  const ordered = [...(roster.data ?? [])].sort((a, b) => (shortName(a.profile) || a.employee_number).localeCompare(shortName(b.profile) || b.employee_number));
  const at = ordered.findIndex((x) => x.id === id);
  const go = (i: number) => {
    const next = ordered[i]?.id;
    if (next) router.replace({ pathname: '/admin/employees/[id]', params: { id: next, kind } });
  };
  const setActive = useAction((active: boolean) => adminEmployees.update(kind, id, { is_active: active }), { success: t('app.saved'), onSuccess: () => emp.mutate() });

  if (emp.isLoading) return <LoadingList rows={6} />;
  if (emp.error || !e) return <ErrorState message={emp.error?.message ?? t(`${ns}.notFoundDesc`)} onRetry={() => emp.mutate()} />;

  const name = shortName(e.profile) || e.employee_number;
  const phone = e.profile?.phone ?? null;
  const email = e.profile?.email ?? null;
  const employment = (v?: string | null) => (v ? t(`teachers.employmentTypes.${v}`, { defaultValue: v }) : undefined);

  return (
    <>
      <Stack.Screen
        options={{
          title: t(kind === 'teacher' ? 'teachers.teacherDetails' : 'staff.staffDetails'),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => router.push({ pathname: '/admin/employees/form', params: { id, kind } })} accessibilityLabel={t(kind === 'teacher' ? 'teachers.editTeacher' : 'staff.editStaff')}>
              <Icon as={Pencil} className="size-5" />
            </Button>
          ),
        }}
      />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={emp.isValidating && !emp.isLoading} onRefresh={() => emp.mutate()} />}>
        <View className="items-center gap-2 py-2">
          <PersonAvatar url={e.profile?.profile_photo_url ?? e.profile?.avatar_url} name={name} size={80} />
          <Text variant="h4" className="text-center">
            {name}
          </Text>
          <Text variant="muted">{[e.employee_number, e.title].filter(Boolean).join(' · ')}</Text>
          <Badge variant={e.is_active ? 'default' : 'secondary'}>
            <Text>{e.is_active ? t(`${ns}.active`) : t(`${ns}.inactive`)}</Text>
          </Badge>
          <View className="flex-row gap-2 pt-1">
            {phone ? (
              <Button size="sm" variant="outline" onPress={() => Linking.openURL(`tel:${phone}`)}>
                <Icon as={Phone} className="size-4" />
                <Text>{f('phoneNumber')}</Text>
              </Button>
            ) : null}
            {email ? (
              <Button size="sm" variant="outline" onPress={() => Linking.openURL(`mailto:${email}`)}>
                <Icon as={Mail} className="size-4" />
                <Text>{f('email')}</Text>
              </Button>
            ) : null}
          </View>
        </View>

        {e.profile_id ? <VerifyQr profileId={e.profile_id} label={name} /> : null}
        {ordered.length > 1 && at >= 0 ? (
          <View className="flex-row gap-2">
            <Button size="sm" variant="outline" className="flex-1" onPress={() => go(at - 1)} disabled={at <= 0}>
              <Icon as={ChevronLeft} className="text-foreground size-4 rtl:rotate-180" />
              <Text>{t('teachers.previous')}</Text>
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onPress={() => go(at + 1)} disabled={at >= ordered.length - 1}>
              <Text>{t('teachers.next')}</Text>
              <Icon as={ChevronRight} className="text-foreground size-4 rtl:rotate-180" />
            </Button>
          </View>
        ) : null}

        <InfoCard title={t('teachers.tabs.personalInformation')}>
          <InfoRow label={f('firstName')} value={e.profile?.first_name} />
          <InfoRow label={f('lastName')} value={e.profile?.last_name} />
          <InfoRow label={f('email')} value={e.profile?.email} icon={Mail} onPress={() => Linking.openURL(`mailto:${e.profile?.email}`)} />
          <InfoRow label={f('phoneNumber')} value={e.profile?.phone} icon={Phone} onPress={() => Linking.openURL(`tel:${e.profile?.phone}`)} />
          <InfoRow label={f('gender')} value={e.profile?.gender ? t(`school.students.fields.${e.profile.gender.toLowerCase()}`, { defaultValue: e.profile.gender }) : undefined} />
          <InfoRow label={f('dateOfBirth')} value={e.profile?.date_of_birth ? formatDate(e.profile.date_of_birth) : undefined} />
        </InfoCard>

        <InfoCard title={t('teachers.tabs.professionalDetails')}>
          <InfoRow label={f('employeeNumber')} value={e.employee_number} />
          <InfoRow label={f('title')} value={e.title} />
          <InfoRow label={f('department')} value={e.department} />
          <InfoRow label={f('specialization')} value={e.specialization} />
          <InfoRow label={f('qualifications')} value={e.qualifications} />
          <InfoRow label={f('dateOfJoining')} value={e.date_of_joining ? formatDate(e.date_of_joining) : undefined} />
          <InfoRow label={f('employmentType')} value={employment(e.employment_type)} />
          <InfoRow label={f('paymentType')} value={e.payment_type ? t(`app.ppl_pay_${e.payment_type}`) : undefined} />
          {e.base_salary !== undefined && e.base_salary !== null ? <InfoRow label={f('baseSalary')} value={formatNumber(e.base_salary)} /> : null}
        </InfoCard>

        {kind === 'teacher' ? (
          <InfoCard title={t('teachers.assignedSubjectsSections')}>
            {assignments.isLoading ? null : !(assignments.data ?? []).length ? (
              <View className="py-2">
                <Text className="text-muted-foreground text-sm">{t('teachers.noSubjectsAssigned')}</Text>
                <Text className="text-muted-foreground text-xs">{t('teachers.goToWorkload')}</Text>
              </View>
            ) : (
              (assignments.data ?? []).map((a) => (
                <InfoRow
                  key={a.id}
                  label={a.subject?.name || a.subject_name || t('teachers.unknownSubject')}
                  value={`${a.section_name || t('teachers.unknownSection')} · ${a.grade_name || t('teachers.na')} · ${a.is_primary ? t('teachers.primaryTeacher') : t('teachers.subjectTeacher')}`}
                />
              ))
            )}
          </InfoCard>
        ) : null}

        {e.profile_id ? <QualificationsCard profileId={e.profile_id} /> : null}

        <PerformanceCard staffId={e.id} profileId={e.profile_id} />

        <CustomFieldValues defs={defs.data} values={e.custom_fields} />

        <InfoCard title={t('teachers.tabs.systemLogin')}>
          <InfoRow label={f('username')} value={e.profile?.username} />
          <InfoRow label={f('lastLogin')} value={lastLogin.data ? (lastLogin.data.last_sign_in ? formatDateTime(lastLogin.data.last_sign_in) : t(`${ns}.never`, { defaultValue: '—' })) : undefined} />
          <InfoRow label={f('createdAt')} value={formatDate(e.created_at)} />
          <InfoRow label={f('lastUpdated')} value={e.updated_at ? formatDate(e.updated_at) : undefined} />
          {e.user_profile ? <InfoRow label={t('school.students.student_details.access_role_title')} value={e.user_profile.name} /> : null}
        </InfoCard>

        <CredentialsCard profileId={e.profile_id} onSave={(p) => adminEmployees.update(kind, id, p)} />

        <AccessRoleCard
          entityType="staff"
          entityId={e.id}
          baseRole={(['teacher', 'librarian', 'staff'].includes(e.profile?.role ?? e.role ?? '') ? (e.profile?.role ?? e.role) : kind === 'teacher' ? 'teacher' : 'staff') as 'teacher' | 'librarian' | 'staff'}
          title={t('school.students.student_details.access_role_title')}
          description={t('app.hq_access_role_desc')}
          defaultLabel={t('school.students.student_details.access_role_default')}
        />

        <Button
          variant={e.is_active ? 'outline' : 'default'}
          disabled={setActive.running}
          onPress={async () => {
            const title = e.is_active ? t('teachers.deactivate') : t('app.ppl_activate');
            if (await confirm({ title, body: name, destructive: e.is_active, confirmLabel: title })) setActive.run(!e.is_active);
          }}>
          <Text className={e.is_active ? 'text-destructive' : undefined}>{e.is_active ? t('teachers.deactivate') : t('app.ppl_activate')}</Text>
        </Button>
      </ScrollView>
    </>
  );
}
