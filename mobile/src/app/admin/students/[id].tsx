import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Building, Mail, MapPin, Pencil, Phone } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { InfoCard, InfoRow } from '@/components/app/info';
import { PersonHero } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CustomFieldValues } from '@/features/admin/custom-field-values';
import { AccessRoleCard, ConfidentialBadge, ConfidentialStatusCard, CredentialsCard, DisciplineScoreCard, MiqatCard, ReassignPanel, RelativesCard } from '@/features/admin/people-extras';
import { studentFullName, useCampusStudents } from '@/features/admin/scheduling-tools';
import { fullName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminCustomFields, adminParents, adminServices, adminStudents, auth } from '@/lib/api';
import { useApi } from '@/lib/data';
import { ageFrom, formatDate, formatDateTime } from '@/lib/format';
import { useAction } from '@/lib/use-action';

type EmergencyContact = { name?: string; phone?: string; relationship?: string; address?: string };

/**
 * One student (web: /admin/students/[studentNumber]): personal, academic, medical, family, system.
 * The route segment is the student NUMBER: lookup by number honours the selected campus, while
 * GET /students/:id only searches the main school (branch students would be "not found").
 */
export default function StudentDetail() {
  const { t } = useTranslation();
  const td = (k: string, o?: Record<string, unknown>) => t(`school.students.student_details.${k}`, o);
  const tf = (k: string) => t(`school.students.fields.${k}`);
  const confirm = useConfirm();
  const { id: studentNumber } = useLocalSearchParams<{ id: string }>();
  const { campusId, campus } = useCampus();
  const student = useApi(['admin', 'student', campusId ?? 'school', studentNumber], ([, , , n]) => adminStudents.getByNumber(campusId, n as string));
  const s = student.data;
  const parentId: string | undefined = s?.custom_fields?.family?.linked_parent_id;
  const parent = useApi(parentId ? ['admin', 'parent', parentId] : null, ([, , pid]) => adminParents.get(pid));
  // Read optional values into locals first: the React Compiler can evaluate `s.profile_id`
  // unconditionally when it is used inside `s?.profile_id ? [...] : null`.
  const profileId = s?.profile_id ?? null;
  const lastLogin = useApi(profileId ? ['admin', 'last-login', profileId] : null, ([, , pid]) => auth.lastLogin(pid));
  const defs = useApi(['admin', 'custom-fields', 'student', campusId ?? 'school'], () => adminCustomFields.list('student', campusId));
  const recordId = s?.id ?? null;
  const [reassign, setReassign] = useState(false);
  const services = useApi(['admin', 'school-services', campusId ?? 'school'], () => adminServices.list(campusId));
  // Previous / next student in the campus list, by name (web: the profile's arrows).
  const roster = useCampusStudents();
  const ordered = [...(roster.data ?? [])].sort((a, b) => studentFullName(a.profile).localeCompare(studentFullName(b.profile)));
  const at = ordered.findIndex((x) => x.student_number === studentNumber);
  const go = (i: number) => {
    const next = ordered[i]?.student_number;
    if (next) router.replace({ pathname: '/admin/students/[id]', params: { id: next } });
  };
  const setActive = useAction((active: boolean) => adminStudents.update(campusId, recordId!, { is_active: active }), {
    success: t('app.saved'),
    onSuccess: () => student.mutate(),
  });

  if (student.isLoading) return <LoadingList rows={6} />;
  if (student.error || !s) return <ErrorState message={student.error?.message ?? td('not_found_desc')} onRetry={() => student.mutate()} />;

  const name = fullName(s.profile) || s.student_number;
  const phone = s.profile?.phone ?? null;
  const email = s.profile?.email ?? null;
  const personal = s.custom_fields?.personal ?? {};
  const academic = s.custom_fields?.academic ?? {};
  const family = s.custom_fields?.family ?? {};
  const medical = (s.medical_info ?? {}) as { blood_group?: string; allergies?: string[]; notes?: string; emergency_notes?: string };
  const contacts: EmergencyContact[] = Array.isArray(family.emergency_contacts) ? family.emergency_contacts : [];
  const active = s.profile?.is_active !== false;
  const parentPhone = parent.data?.profile?.phone ?? null;
  const parentEmail = parent.data?.profile?.email ?? null;
  const age = ageFrom(personal.date_of_birth ?? s.profile?.date_of_birth);
  const gender = personal.gender ?? s.profile?.gender;

  return (
    <>
      <Stack.Screen
        options={{
          title: td('title'),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => router.push({ pathname: '/admin/students/form', params: { number: studentNumber } })} accessibilityLabel={td('edit_student')}>
              <Icon as={Pencil} className="size-5" />
            </Button>
          ),
        }}
      />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-3 p-4 pb-10"
        refreshControl={<RefreshControl refreshing={student.isValidating && !student.isLoading} onRefresh={() => student.mutate()} />}>
        <PersonHero
          name={name}
          photo={s.profile?.profile_photo_url ?? s.profile?.avatar_url}
          subtitle={[s.student_number, s.grade?.name ?? s.grade_level, s.section?.name].filter(Boolean).join(' · ')}
          chips={
            <>
              <StatusChip label={active ? td('active') : td('inactive')} tone={active ? 'success' : 'muted'} className="px-2.5 py-0.5" />
              <ConfidentialBadge status={s.confidential_family_status} />
            </>
          }
          actions={[
            ...(phone ? [{ icon: Phone, label: tf('phone_number'), onPress: () => Linking.openURL(`tel:${phone}`) }] : []),
            ...(email ? [{ icon: Mail, label: tf('email'), onPress: () => Linking.openURL(`mailto:${email}`) }] : []),
            { icon: Pencil, label: td('edit_student'), onPress: () => router.push({ pathname: '/admin/students/form', params: { number: studentNumber } }) },
          ]}
          {...(ordered.length > 1 && at >= 0 ? { onPrev: at > 0 ? () => go(at - 1) : null, onNext: at < ordered.length - 1 ? () => go(at + 1) : null } : {})}
          prevLabel={td('previous')}
          nextLabel={td('next')}
        />

        {s.profile_id ? <MiqatCard personId={s.profile_id} name={name} /> : null}

        <InfoCard title={td('personal_info')}>
          <InfoRow label={tf('first_name')} value={s.profile?.first_name} />
          <InfoRow label={tf('father_name')} value={s.profile?.father_name} />
          <InfoRow label={tf('grandfather_name')} value={s.profile?.grandfather_name} />
          <InfoRow label={tf('last_name')} value={s.profile?.last_name} />
          <InfoRow label={tf('date_of_birth')} value={personal.date_of_birth ? formatDate(personal.date_of_birth) : undefined} />
          <InfoRow label={td('age')} value={age !== undefined ? `${age} ${td('years')}` : undefined} />
          <InfoRow label={tf('gender')} value={gender ? tf(String(gender).toLowerCase()) : undefined} />
          <InfoRow label={tf('national_id')} value={s.profile?.national_id ?? personal.national_id} />
          <InfoRow label={tf('email')} value={s.profile?.email} icon={Mail} onPress={() => Linking.openURL(`mailto:${s.profile?.email}`)} />
          <InfoRow label={tf('phone_number')} value={s.profile?.phone} icon={Phone} onPress={() => Linking.openURL(`tel:${s.profile?.phone}`)} />
          <InfoRow label={tf('address')} value={personal.address} icon={MapPin} />
        </InfoCard>

        {reassign ? (
          <ReassignPanel
            studentId={s.id}
            gradeId={s.grade?.id ?? s.grade_level_id}
            sectionId={s.section?.id ?? s.section_id}
            onCancel={() => setReassign(false)}
            onDone={() => {
              setReassign(false);
              student.mutate();
            }}
          />
        ) : null}
        <InfoCard title={td('academic_info')}>
          <View className="flex-row items-center gap-2 py-2">
            <Text className="text-muted-foreground flex-1 text-xs">{td('reassign_helper')}</Text>
            <Button size="sm" variant="outline" onPress={() => setReassign((v) => !v)}>
              <Icon as={Pencil} className="text-foreground size-3.5" />
              <Text>{td('reassign_button')}</Text>
            </Button>
          </View>
          <InfoRow label={td('student_number')} value={s.student_number} />
          <InfoRow label={td('grade_level')} value={s.grade?.name ?? s.grade_level} />
          <InfoRow label={td('section')} value={s.section?.name ?? academic.section_name ?? (s.grade ? td('unassigned') : undefined)} />
          <InfoRow label={td('campus')} value={academic.campus_name ?? campus?.name} icon={Building} />
          <InfoRow label={tf('admission_date')} value={academic.admission_date ? formatDate(academic.admission_date) : undefined} />
          <InfoRow label={td('academic_year')} value={academic.academic_year_name} />
          {academic.previous_school?.schoolName ? <InfoRow label={td('school_name')} value={academic.previous_school.schoolName} /> : null}
          {academic.previous_school?.transferDate ? <InfoRow label={td('transfer_date')} value={academic.previous_school.transferDate} /> : null}
        </InfoCard>

        <InfoCard title={td('medical_info')}>
          <InfoRow label={td('blood_group')} value={medical.blood_group} />
          <InfoRow label={td('allergies')} value={medical.allergies?.length ? medical.allergies.join(', ') : td('no_allergies')} />
          {medical.notes || medical.emergency_notes ? <InfoRow label={tf('medical_notes')} value={medical.notes || medical.emergency_notes} /> : null}
        </InfoCard>

        <InfoCard title={td('family_info')}>
          {parentId ? (
            parent.data ? (
              <>
                <InfoRow label={family.parent_relation_type || td('relationship')} value={fullName(parent.data.profile)} />
                <InfoRow label={tf('phone_number')} value={parent.data.profile?.phone} icon={Phone} onPress={() => Linking.openURL(`tel:${parentPhone}`)} />
                <InfoRow label={tf('email')} value={parent.data.profile?.email} icon={Mail} onPress={() => Linking.openURL(`mailto:${parentEmail}`)} />
                <InfoRow label={tf('occupation')} value={parent.data.occupation} />
              </>
            ) : (
              <InfoRow label={td('linked_parent')} value={parent.isLoading ? td('loading_parent') : undefined} />
            )
          ) : (
            <InfoRow label={td('linked_parent')} value={td('no_parent')} />
          )}
          {contacts.length === 0 ? (
            <InfoRow label={td('emergency_contacts')} value={td('no_emergency_contacts')} />
          ) : (
            contacts.map((c, i) => (
              <InfoRow
                key={i}
                label={`${td('emergency_contacts')} ${contacts.length > 1 ? i + 1 : ''}`.trim()}
                value={[c.name, c.relationship, c.phone].filter(Boolean).join(' · ')}
                icon={Phone}
                onPress={c.phone ? () => Linking.openURL(`tel:${c.phone}`) : undefined}
              />
            ))
          )}
        </InfoCard>

        <ConfidentialStatusCard key={s.confidential_family_status ?? 'NONE'} studentId={s.id} status={s.confidential_family_status} onSaved={() => student.mutate()} />

        <DisciplineScoreCard studentId={s.id} academicYearId={academic.academic_year_id ?? null} />

        <RelativesCard studentId={s.id} onOpenSibling={(n) => router.push({ pathname: '/admin/students/[id]', params: { id: n } })} />

        <CustomFieldValues defs={defs.data} values={s.custom_fields} />

        <InfoCard title={td('system_info')}>
          <InfoRow label={td('username')} value={s.profile?.username ?? s.custom_fields?.system?.username} />
          <InfoRow label={td('account_status')} value={active ? td('active') : td('inactive')} />
          <InfoRow label={td('last_login')} value={lastLogin.data ? (lastLogin.data.last_sign_in ? formatDateTime(lastLogin.data.last_sign_in) : td('never')) : undefined} />
          <InfoRow label={td('created_at')} value={s.created_at ? formatDate(s.created_at) : undefined} />
          {Array.isArray(s.custom_fields?.services?.selected_services) && s.custom_fields.services.selected_services.length ? (
            <InfoRow
              label={td('subscribed_services')}
              value={(s.custom_fields.services.selected_services as string[]).map((sid) => (services.data ?? []).find((x) => x.id === sid)?.name ?? sid).join(', ')}
            />
          ) : null}
        </InfoCard>

        <CredentialsCard profileId={s.profile_id} onSave={(p) => adminStudents.update(campusId, s.id, p)} />

        <AccessRoleCard entityType="student" entityId={s.id} baseRole="student" title={td('access_role_title')} description={td('access_role_desc')} defaultLabel={td('access_role_default')} />

        <Button
          variant={active ? 'outline' : 'default'}
          disabled={setActive.running}
          onPress={async () => {
            const title = active ? t('school.students.student_info.deactivate_student') : t('school.students.student_info.activate_student');
            if (await confirm({ title, body: name, destructive: active, confirmLabel: title })) setActive.run(!active);
          }}>
          <Text className={active ? 'text-destructive' : undefined}>
            {active ? t('school.students.student_info.deactivate_student') : t('school.students.student_info.activate_student')}
          </Text>
        </Button>
      </ScrollView>
    </>
  );
}

