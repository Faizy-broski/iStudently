import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Link2, Mail, MapPin, Pencil, Phone, Unlink } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { InfoCard, InfoRow } from '@/components/app/info';
import { ListRow } from '@/components/app/list-row';
import { PersonAvatar } from '@/components/app/person-avatar';
import { ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { CustomFieldValues } from '@/features/admin/custom-field-values';
import { VerifyQr } from '@/features/admin/employee-extras';
import { AccessRoleCard, CredentialsCard } from '@/features/admin/people-extras';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminCustomFields, adminParents, auth } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate, formatDateTime } from '@/lib/format';
import { useAction } from '@/lib/use-action';

/** One parent with linked children (web: /admin/parents/[id]). */
export default function ParentDetail() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { campusId } = useCampus();
  const parent = useApi(['admin', 'parent-full', id], () => adminParents.getWithChildren(id));
  const p = parent.data;
  const profileId = p?.profile_id ?? null;
  const lastLogin = useApi(profileId ? ['admin', 'last-login', profileId] : null, ([, , pid]) => auth.lastLogin(pid));
  const defs = useApi(['admin', 'custom-fields', 'parent', campusId ?? 'school'], () => adminCustomFields.list('parent', campusId));
  const roster = useApi(['admin', 'parent-roster', campusId ?? 'school'], () => adminParents.list({ page: 1, limit: 1000 }));
  const ordered = [...(roster.data ?? [])].sort((a, b) => (shortName(a.profile) || '').localeCompare(shortName(b.profile) || ''));
  const at = ordered.findIndex((x) => x.id === id);
  const go = (i: number) => {
    const next = ordered[i]?.id;
    if (next) router.replace({ pathname: '/admin/parents/[id]', params: { id: next } });
  };
  const unlink = useAction((studentId: string) => adminParents.unlinkStudent(id, studentId), { success: t('app.saved'), onSuccess: () => parent.mutate() });

  if (parent.isLoading) return <LoadingList rows={6} />;
  if (parent.error || !p) return <ErrorState message={parent.error?.message ?? t('parents.notFoundDesc')} onRetry={() => parent.mutate()} />;

  const name = shortName(p.profile) || '—';
  const phone = p.profile?.phone ?? null;
  const email = p.profile?.email ?? null;
  const relation = (r?: string) => (r ? t(`parents.${r}`, { defaultValue: r }) : undefined);

  return (
    <>
      <Stack.Screen
        options={{
          title: t('parents.parentDetails'),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => router.push({ pathname: '/admin/parents/form', params: { id } })} accessibilityLabel={t('parents.editInfo')}>
              <Icon as={Pencil} className="size-5" />
            </Button>
          ),
        }}
      />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={parent.isValidating && !parent.isLoading} onRefresh={() => parent.mutate()} />}>
        <View className="items-center gap-2 py-2">
          <PersonAvatar url={p.profile?.profile_photo_url ?? p.profile?.avatar_url} name={name} size={80} />
          <Text variant="h4" className="text-center">
            {name}
          </Text>
          {p.occupation ? <Text variant="muted">{[p.occupation, p.workplace].filter(Boolean).join(' · ')}</Text> : null}
          <View className="flex-row gap-2 pt-1">
            {phone ? (
              <Button size="sm" variant="outline" onPress={() => Linking.openURL(`tel:${phone}`)}>
                <Icon as={Phone} className="size-4" />
                <Text>{t('parents.fields.phone')}</Text>
              </Button>
            ) : null}
            {email ? (
              <Button size="sm" variant="outline" onPress={() => Linking.openURL(`mailto:${email}`)}>
                <Icon as={Mail} className="size-4" />
                <Text>{t('parents.fields.email')}</Text>
              </Button>
            ) : null}
          </View>
        </View>

        {p.profile_id ? <VerifyQr profileId={p.profile_id} label={name} /> : null}
        {ordered.length > 1 && at >= 0 ? (
          <View className="flex-row gap-2">
            <Button size="sm" variant="outline" className="flex-1" onPress={() => go(at - 1)} disabled={at <= 0}>
              <Icon as={ChevronLeft} className="text-foreground size-4 rtl:rotate-180" />
              <Text>{t('parents.previous')}</Text>
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onPress={() => go(at + 1)} disabled={at >= ordered.length - 1}>
              <Text>{t('parents.next')}</Text>
              <Icon as={ChevronRight} className="text-foreground size-4 rtl:rotate-180" />
            </Button>
          </View>
        ) : null}

        <Card className="gap-1 py-4">
          <CardHeader className="flex-row items-center justify-between px-4">
            <CardTitle>{t('parents.linkedChildren')}</CardTitle>
            <Button size="sm" variant="ghost" onPress={() => router.push({ pathname: '/admin/parents/link', params: { id } })}>
              <Icon as={Link2} className="size-4" />
              <Text>{t('parents.linkChildren')}</Text>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {(p.children ?? []).length === 0 ? <Text className="text-muted-foreground px-4 py-2">{t('parents.noChildrenLinked')}</Text> : null}
            {(p.children ?? []).map((c, i) => {
              const childName = shortName(c.profile) || c.student_number || '—';
              return (
                <View key={c.id || i}>
                  {i > 0 ? <Separator className="ms-4" /> : null}
                  <ListRow
                    title={childName}
                    subtitle={[relation(c.relationship), c.student_number].filter(Boolean).join(' · ')}
                    leading={<PersonAvatar name={childName} size={36} />}
                    onPress={c.student_number ? () => router.push({ pathname: '/admin/students/[id]', params: { id: c.student_number! } }) : undefined}
                    chevron={false}
                    trailing={
                      <Pressable
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('app.ppl_unlink', { name: childName })}
                        onPress={async () => {
                          if (await confirm({ title: t('app.ppl_unlink', { name: childName }), body: t('app.ppl_unlink_body'), destructive: true, confirmLabel: t('app.ppl_unlink_short') })) unlink.run(c.id);
                        }}>
                        <Icon as={Unlink} className="text-muted-foreground size-5" />
                      </Pressable>
                    }
                  />
                </View>
              );
            })}
          </CardContent>
        </Card>

        <InfoCard title={t('parents.contactInfo')}>
          <InfoRow label={t('parents.fields.email')} value={p.profile?.email} icon={Mail} onPress={() => Linking.openURL(`mailto:${p.profile?.email}`)} />
          <InfoRow label={t('parents.fields.phone')} value={p.profile?.phone} icon={Phone} onPress={() => Linking.openURL(`tel:${p.profile?.phone}`)} />
          <InfoRow label={t('parents.fields.cnic')} value={p.cnic} />
          <InfoRow label={t('parents.streetAddress')} value={p.address} icon={MapPin} />
          <InfoRow label={t('parents.fields.city')} value={p.city} />
          <InfoRow label={t('parents.fields.state')} value={p.state} />
          <InfoRow label={t('parents.fields.country')} value={p.country} />
          <InfoRow label={t('parents.zipCode')} value={p.zip_code} />
        </InfoCard>

        <InfoCard title={t('parents.workInformation')}>
          <InfoRow label={t('parents.occupation')} value={p.occupation} />
          <InfoRow label={t('parents.workplace')} value={p.workplace} />
          <InfoRow label={t('parents.monthlyIncome')} value={p.income} />
        </InfoCard>

        <InfoCard title={t('parents.emergencyContact')}>
          <InfoRow label={t('parents.contactName')} value={p.emergency_contact_name} />
          <InfoRow label={t('parents.relationship')} value={p.emergency_contact_relation} />
          <InfoRow label={t('parents.fields.phone')} value={p.emergency_contact_phone} icon={Phone} onPress={() => Linking.openURL(`tel:${p.emergency_contact_phone}`)} />
        </InfoCard>

        {p.notes ? (
          <InfoCard title={t('parents.notes')}>
            <InfoRow label={t('parents.additionalNotes')} value={p.notes} />
          </InfoCard>
        ) : null}

        <CustomFieldValues defs={defs.data} values={p.custom_fields} />

        <InfoCard title={t('parents.systemInformation')}>
          <InfoRow label={t('parents.system.lastLogin')} value={lastLogin.data ? (lastLogin.data.last_sign_in ? formatDateTime(lastLogin.data.last_sign_in) : t('parents.never')) : undefined} />
          <InfoRow label={t('parents.system.createdAt')} value={formatDate(p.created_at)} />
          <InfoRow label={t('parents.system.lastUpdated')} value={p.updated_at ? formatDate(p.updated_at) : undefined} />
        </InfoCard>

        <CredentialsCard profileId={p.profile_id} onSave={(x) => adminParents.update(id, x)} />

        <AccessRoleCard entityType="parent" entityId={p.id} baseRole="parent" title={t('parents.accessRoleTitle')} description={t('parents.accessRoleDesc')} defaultLabel={t('parents.accessRoleDefault')} />
      </ScrollView>
    </>
  );
}
