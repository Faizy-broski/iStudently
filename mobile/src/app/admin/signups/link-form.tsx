import { signupUrl, type SignupCustomField, type SignupLink, type SignupLinkMeta, type SignupProfileField, type SignupRole } from '@studently/api-client';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ImagePlus, Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Share, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { DateField, todayYmd } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { useCampus } from '@/features/campus/campus';
import { locale } from '@/i18n';
import { adminAcademics, adminSignups, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { env } from '@/lib/env';
import { pickImage } from '@/lib/upload';
import { cn } from '@/lib/utils';

const ROLES: SignupRole[] = ['teacher', 'student', 'parent', 'staff', 'librarian'];
type Freeform = { id: string; label: string; type: 'text' | 'select' | 'textarea' | 'date'; required: boolean; options: string };
type Toggle = { shown: boolean; required: boolean };
type Standard = {
  first_name_required: boolean;
  last_name_required: boolean;
  phone_enabled: boolean;
  phone_required: boolean;
  email_enabled: boolean;
  email_required: boolean;
  username_enabled: boolean;
  username_required: boolean;
};

/** Same identity the web uses for a profile field toggle. */
const pfKey = (f: SignupProfileField) => (f.source === 'custom_field' ? `custom_field.${f.field_key}` : `${f.table}.${f.column}`);

/** A standard field row: "Show" switch (optional) and "Required" switch. */
function ShowRequired({
  title,
  shown,
  required,
  onShown,
  onRequired,
  hint,
  showLabel,
  requiredLabel,
}: {
  title: string;
  shown?: boolean;
  required: boolean;
  onShown?: (v: boolean) => void;
  onRequired: (v: boolean) => void;
  hint?: string;
  showLabel: string;
  requiredLabel: string;
}) {
  return (
    <View className="border-border gap-2 rounded-xl border p-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-sm font-medium">{title}</Text>
        <View className="flex-row items-center gap-2">
          <Text variant="muted" className="text-xs">
            {onShown ? showLabel : requiredLabel}
          </Text>
          {onShown ? (
            <Switch checked={!!shown} onCheckedChange={onShown} accessibilityLabel={`${title} ${showLabel}`} />
          ) : (
            <Switch checked={required} onCheckedChange={onRequired} accessibilityLabel={`${title} ${requiredLabel}`} />
          )}
        </View>
      </View>
      {onShown && shown ? (
        <View className="border-border flex-row items-center justify-end gap-2 border-t pt-2">
          <Text variant="muted" className="text-xs">
            {requiredLabel}
          </Text>
          <Switch checked={required} onCheckedChange={onRequired} accessibilityLabel={`${title} ${requiredLabel}`} />
        </View>
      ) : null}
      {hint ? (
        <Text variant="muted" className="text-xs">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Create a signup link, or edit one with `?id=` (web: /admin/signup-links/new and /[id]/edit, SignupLinkForm). */
export default function SignupLinkFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const link = useApi(id ? ['admin', 'signup-link', id] : null, ([, , l]) => adminSignups.link(l as string));
  if (id && link.isLoading) return <LoadingList rows={6} />;
  return <LinkForm key={link.data?.id ?? 'new'} initial={id ? (link.data ?? undefined) : undefined} />;
}

function LinkForm({ initial }: { initial?: SignupLink }) {
  const { t } = useTranslation();
  const s = (k: string) => t(`signupLinks.${k}`);
  const k = (key: string) => t(`app.sl_${key}`);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const editing = !!initial;
  const isAr = locale === 'ar';
  const std = initial?.meta?.standard_fields;

  const [role, setRole] = useState<SignupRole>((initial?.role as SignupRole) ?? 'teacher');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [unlimited, setUnlimited] = useState(initial ? initial.max_uses == null : true);
  const [maxUses, setMaxUses] = useState(initial?.max_uses != null ? String(initial.max_uses) : '');
  const [neverExpires, setNeverExpires] = useState(initial ? !initial.expires_at : true);
  const [expiresAt, setExpiresAt] = useState(initial?.expires_at ? initial.expires_at.split('T')[0] : '');
  const linkCampus = initial ? (initial.campus_id ?? undefined) : (campusId ?? undefined);
  const [poster, setPoster] = useState(initial?.meta?.poster_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [freeform, setFreeform] = useState<Freeform[]>([]);
  const [pfc, setPfc] = useState<Record<string, Toggle>>({});
  const [standard, setStandard] = useState<Standard>({
    first_name_required: std?.first_name?.required ?? true,
    last_name_required: std?.last_name?.required ?? true,
    phone_enabled: std?.phone?.enabled ?? true,
    phone_required: std?.phone?.required ?? false,
    email_enabled: std?.email?.enabled ?? true,
    email_required: std?.email?.required ?? false,
    username_enabled: std?.username?.enabled ?? false,
    username_required: std?.username?.required ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<SignupLink | null>(null);

  const gradesQ = useApi(['admin', 'grades', linkCampus ?? 'school'], () => adminAcademics.grades(linkCampus));
  const fieldsQ = useApi(['admin', 'signup-profile-fields', role, linkCampus ?? 'school'], ([, , r]) => adminSignups.profileFields(r as string, linkCampus));
  const grades = gradesQ.data ?? [];
  const profileFields = fieldsQ.data ?? [];
  const withGrades = role === 'student' || role === 'parent';

  // Edit: once fields and grades are loaded, rebuild the toggles from the saved meta (once, during render).
  const [reconciled, setReconciled] = useState(!editing);
  const metaFields = initial?.meta?.custom_fields ?? [];
  if (!reconciled && fieldsQ.data && gradesQ.data) {
    const gradeField = metaFields.find((f) => f.id === 'grade_level');
    const nextPfc: Record<string, Toggle> = {};
    const matched = new Set<string>();
    for (const pf of fieldsQ.data) {
      const matchId = pf.source === 'custom_field' ? pf.field_key : pf.column;
      const stored = metaFields.find((f) => f.id === matchId);
      if (stored) {
        nextPfc[pfKey(pf)] = { shown: true, required: stored.required };
        matched.add(stored.id);
      }
    }
    setReconciled(true);
    if (gradeField) setGradeIds(gradesQ.data.filter((g) => gradeField.options?.includes(g.name)).map((g) => g.id));
    setPfc(nextPfc);
    setFreeform(
      metaFields
        .filter((f) => f.id !== 'grade_level' && !matched.has(f.id))
        .map((f) => ({ id: f.id, label: f.label, type: f.type === 'checkbox' || f.type === 'multi-select' ? 'text' : f.type, required: f.required, options: (f.options ?? []).join(', ') })),
    );
  }

  const toggleOf = (f: SignupProfileField): Toggle => pfc[pfKey(f)] ?? { shown: false, required: false };
  const setToggle = (f: SignupProfileField, patch: Partial<Toggle>) => setPfc((p) => ({ ...p, [pfKey(f)]: { ...toggleOf(f), ...patch } }));
  const setStd = (patch: Partial<Standard>) => setStandard((x) => ({ ...x, ...patch }));
  const updateFree = (i: number, patch: Partial<Freeform>) => setFreeform((list) => list.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  async function uploadPoster() {
    const picked = await pickImage({ maxDimension: 1600 });
    if (!picked.ok) {
      if (picked.reason === 'permission') toast.error(t('app.ob_photo_permission'));
      return;
    }
    setUploading(true);
    const res = await media.uploadImage(picked.file);
    setUploading(false);
    if (res.success && res.data) setPoster(res.data.url);
    else toast.error(res.error || t('app.error_title'));
  }

  async function submit() {
    if (!unlimited && !(parseInt(maxUses, 10) >= 1)) return toast.error(t('app.v_min_one'));
    if (!neverExpires && !expiresAt) return toast.error(t('app.v_date'));
    const custom_fields: SignupCustomField[] = [];
    // Same field list the web builds (grade levels, toggled profile fields in their order, then freeform fields).
    if (withGrades && grades.length) {
      const offered = gradeIds.length ? grades.filter((g) => gradeIds.includes(g.id)) : grades;
      custom_fields.push({ id: 'grade_level', label: 'Grade Level', label_ar: 'الصف الدراسي', type: 'select', required: true, options: offered.map((g) => g.name) });
    }
    for (const pf of profileFields) {
      const cfg = toggleOf(pf);
      if (!cfg.shown) continue;
      const options = pf.options ? pf.options.map((o) => o.id) : undefined;
      const options_ar = pf.options ? pf.options.map((o) => o.label_ar) : undefined;
      if (pf.source === 'custom_field') {
        custom_fields.push({ id: pf.field_key as string, label: pf.label_en, label_ar: pf.label_ar, type: pf.type, required: cfg.required, options, options_ar });
      } else {
        custom_fields.push({
          id: pf.column as string,
          label: pf.label_en,
          label_ar: pf.label_ar,
          type: pf.type,
          required: cfg.required,
          options,
          options_ar,
          source: 'profile_field',
          mapping: { table: pf.table as 'profiles' | 'parents' | 'staff', column: pf.column as string },
        });
      }
    }
    for (const f of freeform) {
      if (!f.label.trim()) continue;
      custom_fields.push({
        id: f.id,
        label: f.label.trim(),
        type: f.type,
        required: f.required,
        options: f.type === 'select' ? f.options.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
        source: 'custom',
      });
    }
    const meta: SignupLinkMeta = {
      poster_url: poster || null,
      description: initial?.meta?.description ?? null,
      custom_fields,
      standard_fields: {
        first_name: { required: standard.first_name_required },
        last_name: { required: standard.last_name_required },
        phone: { enabled: standard.phone_enabled, required: standard.phone_required },
        email: { enabled: standard.email_enabled, required: standard.email_required },
        username: { enabled: standard.username_enabled, required: standard.username_required },
      },
    };
    const payload = {
      label: label.trim() || null,
      max_uses: unlimited ? null : parseInt(maxUses, 10) || null,
      expires_at: neverExpires ? null : expiresAt || null,
      campus_id: linkCampus ?? null,
      meta,
    };
    setBusy(true);
    const res = initial ? await adminSignups.updateLink(initial.id, payload) : await adminSignups.createLink({ ...payload, role });
    setBusy(false);
    if (!res.success || !res.data) return toast.error(res.error || k('save_failed'));
    mutate((key) => Array.isArray(key) && key[0] === 'admin' && (key[1] === 'signup-links' || key[1] === 'signup-link'));
    if (initial) {
      toast.success(t('app.saved'));
      router.back();
    } else setCreated(res.data);
  }

  if (created) {
    const url = signupUrl(env.webUrl, created.token);
    return (
      <>
        <Stack.Screen options={{ title: s('generateSuccessTitle') }} />
        <Screen scroll edges={['bottom']}>
          <Text variant="muted">{s('generateSuccessDesc')}</Text>
          <Card className="py-3">
            <CardContent className="px-4">
              <Text selectable className="font-mono text-sm">
                {url}
              </Text>
            </CardContent>
          </Card>
          <View className="flex-row gap-2">
            <Button
              className="flex-1"
              variant="outline"
              onPress={async () => {
                await Clipboard.setStringAsync(url);
                toast.success(s('copied'));
              }}>
              <Text>{s('copyLink')}</Text>
            </Button>
            <Button className="flex-1" variant="outline" onPress={() => Share.share({ message: url })}>
              <Text>{s('share')}</Text>
            </Button>
          </View>
          <Button onPress={() => router.back()}>
            <Text>{s('done')}</Text>
          </Button>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: editing ? k('edit_title') : s('generateTitle') }} />
      <Screen scroll edges={['bottom']}>
        <Text variant="muted">{editing ? k('edit_subtitle') : k('create_subtitle')}</Text>

        {/* Basic information */}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{k('basic_title')}</CardTitle>
            <CardDescription>{k('basic_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <Label>{s('fieldRole')}</Label>
            {editing ? (
              <Text variant="muted" className="text-xs">
                {k('role_fixed')}
              </Text>
            ) : null}
            <View pointerEvents={editing ? 'none' : 'auto'} className={editing ? 'opacity-60' : undefined}>
              <FilterChips<SignupRole>
                value={role}
                onChange={(r) => {
                  setRole(r);
                  if (r !== 'student' && r !== 'parent') setGradeIds([]);
                }}
                options={ROLES.map((r) => ({ value: r, label: t(`app.role_${r}`) }))}
              />
            </View>

            {withGrades ? (
              <View className="gap-1.5">
                <Label>{k('grades_offered')}</Label>
                <Text variant="muted" className="text-xs">
                  {k('grades_offered_hint')}
                </Text>
                {!grades.length ? (
                  <Text variant="muted" className="text-xs italic">
                    {k('no_grades')}
                  </Text>
                ) : (
                  <View className="flex-row flex-wrap gap-x-4">
                    {grades.map((g) => (
                      <CheckRow
                        key={g.id}
                        checked={gradeIds.includes(g.id)}
                        onPress={() => setGradeIds((ids) => (ids.includes(g.id) ? ids.filter((x) => x !== g.id) : [...ids, g.id]))}
                        label={g.name}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            <View className="gap-1.5">
              <Label>{s('fieldLabel')}</Label>
              <Input value={label} onChangeText={setLabel} placeholder={s('fieldLabelPlaceholder')} />
              <Text variant="muted" className="text-xs">
                {s('fieldLabelHint')}
              </Text>
            </View>

            <View className="border-border gap-2 border-t pt-3">
              <View className="flex-row items-center justify-between">
                <Label>{s('fieldMaxUses')}</Label>
                <View className="flex-row items-center gap-2">
                  <Text variant="muted" className="text-xs">
                    {s('fieldMaxUsesUnlimited')}
                  </Text>
                  <Switch checked={unlimited} onCheckedChange={setUnlimited} accessibilityLabel={s('fieldMaxUsesUnlimited')} />
                </View>
              </View>
              {!unlimited ? <Input value={maxUses} onChangeText={setMaxUses} keyboardType="number-pad" placeholder="50" /> : null}
            </View>
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Label>{s('fieldExpiry')}</Label>
                <View className="flex-row items-center gap-2">
                  <Text variant="muted" className="text-xs">
                    {s('fieldExpiryNever')}
                  </Text>
                  <Switch checked={neverExpires} onCheckedChange={setNeverExpires} accessibilityLabel={s('fieldExpiryNever')} />
                </View>
              </View>
              {!neverExpires ? <DateField value={expiresAt || null} onChange={setExpiresAt} min={todayYmd()} /> : null}
            </View>
          </CardContent>
        </Card>

        {/* Form configuration */}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{k('form_title')}</CardTitle>
            <CardDescription>{k('form_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-2 px-4">
            <Text variant="muted" className="text-sm font-semibold">
              {k('standard_fields')}
            </Text>
            <View className="border-border flex-row items-center justify-between rounded-xl border p-3 opacity-60">
              <Text className="text-sm font-medium">{k('password')}</Text>
              <Text variant="muted" className="text-xs italic">
                {k('always_required')}
              </Text>
            </View>
            <ShowRequired
              showLabel={k('show')}
              requiredLabel={k('required')}
              title={k('email')}
              shown={standard.email_enabled}
              required={standard.email_required}
              onShown={(v) => setStd({ email_enabled: v, email_required: v ? standard.email_required : false })}
              onRequired={(v) => setStd({ email_required: v })}
              hint={standard.email_enabled && !standard.email_required ? k('email_hint') : undefined}
            />
            <ShowRequired
              showLabel={k('show')}
              requiredLabel={k('required')}
              title={k('username')}
              shown={standard.username_enabled}
              required={standard.username_required}
              onShown={(v) => setStd({ username_enabled: v, username_required: v ? standard.username_required : false })}
              onRequired={(v) => setStd({ username_required: v })}
              hint={standard.username_enabled ? k('username_hint') : undefined}
            />
            <ShowRequired showLabel={k('show')} requiredLabel={k('required')} title={k('first_name')} required={standard.first_name_required} onRequired={(v) => setStd({ first_name_required: v })} />
            <ShowRequired showLabel={k('show')} requiredLabel={k('required')} title={k('surname')} required={standard.last_name_required} onRequired={(v) => setStd({ last_name_required: v })} />
            <ShowRequired
              showLabel={k('show')}
              requiredLabel={k('required')}
              title={k('phone')}
              shown={standard.phone_enabled}
              required={standard.phone_required}
              onShown={(v) => setStd({ phone_enabled: v, phone_required: v ? standard.phone_required : false })}
              onRequired={(v) => setStd({ phone_required: v })}
            />

            {profileFields.length ? (
              <View className="border-border mt-2 gap-2 border-t pt-3">
                <Text variant="muted" className="text-sm font-semibold">
                  {k('profile_fields')}
                </Text>
                <Text variant="muted" className="text-xs">
                  {k('profile_fields_hint')}
                </Text>
                {profileFields.map((pf) => {
                  const cfg = toggleOf(pf);
                  return (
                    <View key={pfKey(pf)} className={cn('border-border gap-2 rounded-xl border p-3', cfg.shown && 'bg-info-soft/40')}>
                      <View className="flex-row items-center justify-between gap-2">
                        <View className="flex-1 flex-row flex-wrap items-center gap-1.5">
                          <Text className="text-sm font-medium">{isAr ? pf.label_ar : pf.label_en}</Text>
                          <StatusChip label={pf.type} tone="muted" className="px-1.5 py-0" />
                          {pf.source === 'custom_field' ? <StatusChip label={k('custom_field')} tone="info" className="px-1.5 py-0" /> : null}
                        </View>
                        <Switch checked={cfg.shown} onCheckedChange={(v) => setToggle(pf, { shown: v, required: v ? cfg.required : false })} accessibilityLabel={`${pf.label_en} ${k('show')}`} />
                      </View>
                      {cfg.shown ? (
                        <View className="border-border flex-row items-center justify-end gap-2 border-t pt-2">
                          <Text variant="muted" className="text-xs">
                            {k('required')}
                          </Text>
                          <Switch checked={cfg.required} onCheckedChange={(v) => setToggle(pf, { required: v })} accessibilityLabel={`${pf.label_en} ${k('required')}`} />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            <View className="border-border mt-2 gap-2 border-t pt-3">
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-sm font-semibold">{k('extra_fields')}</Text>
                  <Text variant="muted" className="text-xs">
                    {k('extra_fields_hint')}
                  </Text>
                </View>
                <Button size="sm" variant="outline" onPress={() => setFreeform((l) => [...l, { id: `field_${Date.now()}`, label: '', type: 'text', required: false, options: '' }])}>
                  <Icon as={Plus} className="size-4" />
                  <Text>{k('add_field')}</Text>
                </Button>
              </View>
              {!freeform.length ? (
                <Text variant="muted" className="border-border rounded-xl border border-dashed p-5 text-center text-sm">
                  {k('no_extra_fields')}
                </Text>
              ) : (
                freeform.map((f, i) => (
                  <View key={f.id} className="border-border gap-2 rounded-xl border p-3">
                    <View className="flex-row items-center justify-between">
                      <Label>{k('field_label')}</Label>
                      <Pressable onPress={() => setFreeform((l) => l.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                        <Icon as={Trash2} className="text-destructive size-4" />
                      </Pressable>
                    </View>
                    <Input value={f.label} onChangeText={(v) => updateFree(i, { label: v })} placeholder={k('field_label_example')} />
                    <Label>{k('field_type')}</Label>
                    <FilterChips<Freeform['type']>
                      value={f.type}
                      onChange={(v) => updateFree(i, { type: v })}
                      options={[
                        { value: 'text', label: k('type_text') },
                        { value: 'select', label: k('type_select') },
                      ]}
                    />
                    {f.type === 'select' ? (
                      <>
                        <Label>{k('options_comma')}</Label>
                        <Input value={f.options} onChangeText={(v) => updateFree(i, { options: v })} placeholder="Option 1, Option 2, Option 3" />
                      </>
                    ) : null}
                    <View className="flex-row items-center gap-2 pt-1">
                      <Switch checked={f.required} onCheckedChange={(v) => updateFree(i, { required: v })} accessibilityLabel={k('required_field')} />
                      <Text className="text-sm">{k('required_field')}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </CardContent>
        </Card>

        {/* Design */}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{k('design_title')}</CardTitle>
            <CardDescription>{k('design_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-2 px-4">
            <Label>{k('poster')}</Label>
            {poster ? (
              <View className="overflow-hidden rounded-xl">
                <Image source={{ uri: poster }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" />
                <Pressable onPress={() => setPoster('')} className="bg-card absolute end-2 top-2 rounded-full p-1.5" accessibilityRole="button" accessibilityLabel={t('common.delete')}>
                  <Icon as={X} className="size-4" />
                </Pressable>
              </View>
            ) : null}
            <Button variant="outline" onPress={uploadPoster} disabled={uploading}>
              <Icon as={ImagePlus} className="size-4" />
              <Text>{uploading ? t('app.ob_uploading') : k('upload_poster')}</Text>
            </Button>
            <Text variant="muted" className="text-center text-xs">
              {k('poster_hint')}
            </Text>
          </CardContent>
        </Card>

        <Button onPress={submit} disabled={busy || uploading}>
          <Text>{busy ? (editing ? k('saving') : s('generating')) : editing ? k('save_changes') : s('generateSubmit')}</Text>
        </Button>
      </Screen>
    </>
  );
}
