import type { PhysicsLab } from '@studently/api-client';
import { getSimLocalized, PHYSICS_CATALOG, SIM_CATEGORIES, CATEGORY_LABELS_AR, type SimCategory, type SimulationMeta } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { FlaskConical, Pencil, Play, Plus, Trash2, Users, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { PublicWebView } from '@/components/app/web-session-view';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { CheckRow } from '@/features/admin/attendance';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { locale } from '@/i18n';
import { adminAcademics, adminResources } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const CATEGORY_TONE: Record<SimCategory, string> = {
  Pendulums: 'bg-blue-100',
  Springs: 'bg-green-100',
  Collisions: 'bg-red-100',
  'Roller Coasters': 'bg-orange-100',
  Orbital: 'bg-purple-100',
  Waves: 'bg-cyan-100',
  Other: 'bg-gray-100',
};

/** Assign MyPhysicsLab simulations to grades/sections, edit, remove, read submissions (web: /admin/physics-labs). */
export default function PhysicsLabs() {
  const { t, i18n } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`physicsLabs.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { me } = useSession();
  const { campusId } = useCampus();
  const own = me.status === 'ready' ? (me.me.profile.school_id ?? me.me.profile.campus_id) : null;
  const schoolId = campusId ?? own ?? null;
  const sid = schoolId ?? '';
  const sim = (s: SimulationMeta) => getSimLocalized(s, locale);
  const catLabel = (c: SimCategory) => (locale === 'ar' ? CATEGORY_LABELS_AR[c] : c);

  const labs = useApi(schoolId ? ['admin', 'physics-labs', schoolId] : null, ([, , s]) => adminResources.physicsLabs(s as string));
  const grades = useApi(['admin', 'grades', schoolId ?? 'school'], () => adminAcademics.grades(schoolId ?? undefined));
  const sections = useApi(['admin', 'sections-all', schoolId ?? 'school'], () => adminAcademics.sections(schoolId ?? undefined));
  const subjects = useApi(['admin', 'subjects-all', schoolId ?? 'school'], () => adminAcademics.subjects(schoolId ?? undefined));

  const [tab, setTab] = useState<'catalog' | 'assigned'>('catalog');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<SimCategory | 'All'>('All');
  const [preview, setPreview] = useState<SimulationMeta | null>(null);

  const [assign, setAssign] = useState<SimulationMeta | null>(null);
  const [aGrades, setAGrades] = useState<string[]>([]);
  const [aSection, setASection] = useState('none');
  const [aSubject, setASubject] = useState('none');
  const [aNote, setANote] = useState('');
  const [busy, setBusy] = useState(false);

  const [edit, setEdit] = useState<PhysicsLab | null>(null);
  const [eGrade, setEGrade] = useState('none');
  const [eSection, setESection] = useState('none');
  const [eSubject, setESubject] = useState('none');
  const [eNote, setENote] = useState('');
  const [eActive, setEActive] = useState(true);

  const [subsLab, setSubsLab] = useState<PhysicsLab | null>(null);
  const subs = useApi(subsLab && schoolId ? ['admin', 'physics-subs', subsLab.id, schoolId] : null, ([, , lid, s]) => adminResources.physicsLabSubmissions(lid as string, s as string));

  const assigned = labs.data ?? [];
  const gradeName = (id: string | null) => (grades.data ?? []).find((g) => g.id === id)?.name;
  const sectionName = (id: string | null) => (sections.data ?? []).find((s) => s.id === id)?.name;
  const subjectName = (id: string | null) => (subjects.data ?? []).find((s) => s.id === id)?.name;
  const entry = (key: string) => PHYSICS_CATALOG.find((s) => s.key === key);

  const catalog = useMemo(() => {
    const q = search.toLowerCase();
    return PHYSICS_CATALOG.filter((s) => {
      const ar = locale === 'ar' ? getSimLocalized(s, locale) : null;
      const hit = !q || s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.topics.some((x) => x.toLowerCase().includes(q)) || (ar && (ar.title.includes(search) || ar.description.includes(search) || ar.topics.some((x) => x.includes(search))));
      return hit && (category === 'All' || s.category === category);
    });
  }, [search, category]);

  const openAssign = (s: SimulationMeta) => {
    const existing = assigned.filter((l) => l.sim_key === s.key);
    const ids = [...new Set(existing.filter((l) => l.grade_id).map((l) => l.grade_id!))];
    setAssign(s);
    setAGrades(ids);
    setASection(ids.length === 1 ? (existing.find((l) => l.grade_id === ids[0])?.section_id ?? 'none') : 'none');
    setASubject(existing[0]?.subject_id ?? 'none');
    setANote(existing[0]?.custom_note ?? '');
  };

  async function doAssign() {
    if (!assign || !schoolId) return;
    setBusy(true);
    try {
      const wanted = aGrades.length ? aGrades : [null];
      const section = aGrades.length === 1 && aSection !== 'none' ? aSection : null;
      const subject = aSubject !== 'none' ? aSubject : null;
      const note = aNote.trim() || null;
      const key = (g: string | null, s: string | null) => `${g}|${s}`;
      const prev = assigned.filter((l) => l.sim_key === assign.key && l.grade_id);
      const want = new Set(wanted.map((g) => key(g, section)));
      const toRemove = prev.filter((l) => !want.has(key(l.grade_id, l.section_id)));
      await Promise.allSettled(toRemove.map((l) => adminResources.unassignPhysicsLab(l.id, schoolId)));
      const had = new Set(prev.map((l) => key(l.grade_id, l.section_id)));
      const toAdd = wanted.filter((g) => g === null || !had.has(key(g, section)));
      await Promise.allSettled(
        toAdd.map((g) => adminResources.assignPhysicsLab({ sim_key: assign.key, school_id: schoolId, grade_id: g, section_id: g === null ? null : section, subject_id: subject, custom_note: note })),
      );
      toast.success(t('app.pl_assigned', { count: aGrades.length || 1 }));
      setAssign(null);
      labs.mutate();
    } finally {
      setBusy(false);
    }
  }

  const openEdit = (l: PhysicsLab) => {
    setEdit(l);
    setEGrade(l.grade_id ?? 'none');
    setESection(l.section_id ?? 'none');
    setESubject(l.subject_id ?? 'none');
    setENote(l.custom_note ?? '');
    setEActive(l.is_active);
  };
  async function saveEdit() {
    if (!edit || !schoolId) return;
    setBusy(true);
    try {
      const r = await adminResources.updatePhysicsLab(edit.id, schoolId, {
        grade_id: eGrade !== 'none' ? eGrade : null,
        section_id: eGrade !== 'none' && eSection !== 'none' ? eSection : null,
        subject_id: eSubject !== 'none' ? eSubject : null,
        custom_note: eNote.trim() || null,
        is_active: eActive,
      });
      if (!r.success) return toast.error(r.error || t('app.pl_update_failed'));
      toast.success(p('editDialog.save'));
      setEdit(null);
      labs.mutate();
    } finally {
      setBusy(false);
    }
  }

  async function remove(l: PhysicsLab) {
    if (!schoolId) return;
    if (!(await confirm({ title: p('deleteDialog.title'), body: p('deleteDialog.description', { title: entry(l.sim_key)?.title ?? l.sim_key }), destructive: true, confirmLabel: p('deleteDialog.confirm') }))) return;
    const r = await adminResources.unassignPhysicsLab(l.id, schoolId);
    if (!r.success) return toast.error(r.error || t('app.pl_remove_failed'));
    toast.success(p('deleteDialog.confirm'));
    labs.mutate();
  }

  const subjOptions = [{ value: 'none', label: p('assignDialog.noSubject') }, ...(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))];
  const sectionsOf = (g: string) => (sections.data ?? []).filter((s) => s.grade_level_id === g);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: p('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-start gap-2">
          <Icon as={FlaskConical} className="text-primary mt-0.5 size-5" />
          <Text className="text-muted-foreground flex-1 text-sm">{p('subtitle')}</Text>
        </View>
        <FilterChips
          value={tab}
          onChange={setTab}
          options={[
            { value: 'catalog', label: `${p('tabCatalog')} (${PHYSICS_CATALOG.length})` },
            { value: 'assigned', label: `${p('tabAssigned')} (${assigned.length})` },
          ]}
        />
        {tab === 'catalog' ? (
          <>
            <SearchBar value={search} onChangeText={setSearch} placeholder={p('searchPlaceholder')} />
            <FilterChips<string> value={category} onChange={(c) => setCategory(c as SimCategory | 'All')} options={[{ value: 'All', label: p('allCategories') }, ...SIM_CATEGORIES.map((c) => ({ value: c, label: catLabel(c) }))]} />
            <Text className="text-muted-foreground text-xs">{p('simulationsCount', { count: catalog.length })}</Text>
            {catalog.map((s) => {
              const mine = assigned.filter((l) => l.sim_key === s.key);
              const names = mine.map((l) => (!l.grade_id ? p('allGrades') : l.section_id ? `${gradeName(l.grade_id)} — ${sectionName(l.section_id)}` : gradeName(l.grade_id))).filter(Boolean) as string[];
              const txt = sim(s);
              return (
                <Card key={s.key} className={mine.length ? 'border-green-300 dark:border-green-800' : ''}>
                  <CardContent className="gap-2 pt-4">
                    <View className="flex-row items-start gap-2">
                      <Text className="flex-1 font-semibold">{txt.title}</Text>
                      <View className={cn('rounded-full px-2 py-0.5', CATEGORY_TONE[s.category])}>
                        <Text className="text-[11px] text-gray-800">{txt.category}</Text>
                      </View>
                    </View>
                    <Text className="text-muted-foreground text-sm">{txt.description}</Text>
                    <View className="flex-row flex-wrap gap-1">
                      {txt.topics.slice(0, 3).map((x) => (
                        <View key={x} className="border-border rounded border px-1.5">
                          <Text className="text-[11px]">{x}</Text>
                        </View>
                      ))}
                    </View>
                    {names.map((n) => (
                      <Text key={n} className="text-xs text-green-700 dark:text-green-400">
                        ✓ {n}
                      </Text>
                    ))}
                    <View className="flex-row gap-2">
                      <Button size="sm" className="flex-1" variant={mine.length ? 'outline' : 'default'} onPress={() => openAssign(s)}>
                        <Icon as={Plus} className={mine.length ? 'text-foreground size-4' : 'text-primary-foreground size-4'} />
                        <Text>{mine.length ? p('assignAgain') : p('assign')}</Text>
                      </Button>
                      <Button size="sm" variant="ghost" onPress={() => setPreview(s)} accessibilityLabel={p('preview')}>
                        <Icon as={Play} className="text-foreground size-4" />
                      </Button>
                    </View>
                  </CardContent>
                </Card>
              );
            })}
          </>
        ) : labs.isLoading ? (
          <LoadingList />
        ) : !assigned.length ? (
          <View className="items-center gap-2 py-12">
            <Icon as={FlaskConical} className="text-muted-foreground size-10" />
            <Text className="text-muted-foreground text-center">{p('emptyAssigned')}</Text>
          </View>
        ) : (
          assigned.map((l) => {
            const s = entry(l.sim_key);
            const g = gradeName(l.grade_id);
            const sec = sectionName(l.section_id);
            return (
              <Card key={l.id}>
                <CardContent className="gap-1.5 pt-4">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="font-semibold">{s ? sim(s).title : l.sim_key}</Text>
                    {s ? (
                      <View className={cn('rounded-full px-2 py-0.5', CATEGORY_TONE[s.category])}>
                        <Text className="text-[11px] text-gray-800">{sim(s).category}</Text>
                      </View>
                    ) : null}
                    {!l.is_active ? (
                      <View className="border-border rounded border px-1.5">
                        <Text className="text-[11px]">{p('inactive')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-muted-foreground text-xs">{p('gradeLabel', { name: (g && sec ? `${g} — ${sec}` : g) || p('allGrades') })}</Text>
                  {subjectName(l.subject_id) ? <Text className="text-muted-foreground text-xs">{p('subjectLabel', { name: subjectName(l.subject_id) })}</Text> : null}
                  {l.custom_note ? <Text className="text-muted-foreground text-xs">{p('noteLabel', { text: l.custom_note })}</Text> : null}
                  <View className="flex-row justify-end gap-1">
                    <Button size="icon" variant="ghost" onPress={() => setSubsLab(l)} accessibilityLabel={p('viewSubmissions')}>
                      <Icon as={Users} className="text-foreground size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onPress={() => openEdit(l)} accessibilityLabel={t('common.edit')}>
                      <Icon as={Pencil} className="text-foreground size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onPress={() => remove(l)} accessibilityLabel={p('deleteDialog.confirm')}>
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Button>
                  </View>
                </CardContent>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Dialog open={!!assign} onOpenChange={(o) => !o && setAssign(null)}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
            <DialogHeader>
              <DialogTitle>{p('assignDialog.title', { title: assign ? sim(assign).title : '' })}</DialogTitle>
            </DialogHeader>
            <Label>
              {p('assignDialog.gradeLabel')}
              {aGrades.length ? ` · ${aGrades.length}` : ''}
            </Label>
            {(grades.data ?? []).map((g) => (
              <CheckRow
                key={g.id}
                checked={aGrades.includes(g.id)}
                label={g.name}
                onPress={() => {
                  setAGrades((prev) => (prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id]));
                  setASection('none');
                }}
              />
            ))}
            {aGrades.length === 1 ? (
              <View className="gap-1.5">
                <Label>{p('assignDialog.sectionLabel')}</Label>
                <Picker value={aSection} onChange={setASection} options={[{ value: 'none', label: p('assignDialog.allSections') }, ...sectionsOf(aGrades[0]).map((s) => ({ value: s.id, label: s.name }))]} />
                <Text className="text-muted-foreground text-xs">{p('assignDialog.sectionHint')}</Text>
              </View>
            ) : null}
            <Label>{p('assignDialog.subjectLabel')}</Label>
            <Picker value={aSubject} onChange={setASubject} options={subjOptions} />
            <Label>{p('assignDialog.noteLabel')}</Label>
            <Textarea value={aNote} onChangeText={setANote} placeholder={p('assignDialog.notePlaceholder')} />
            <View className="flex-row justify-end gap-2">
              <Button variant="outline" onPress={() => setAssign(null)}>
                <Text>{p('assignDialog.cancel')}</Text>
              </Button>
              <Button onPress={doAssign} disabled={busy || !sid}>
                <Text>{busy ? p('assignDialog.submitting') : p('assignDialog.submit')}</Text>
              </Button>
            </View>
          </ScrollView>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{p('editDialog.title')}</DialogTitle>
          </DialogHeader>
          <Label>{p('editDialog.gradeLabel')}</Label>
          <Picker
            value={eGrade}
            onChange={(g) => {
              setEGrade(g);
              setESection('none');
            }}
            options={[{ value: 'none', label: p('allGrades') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]}
          />
          {eGrade !== 'none' ? (
            <>
              <Label>{p('editDialog.sectionLabel')}</Label>
              <Picker value={eSection} onChange={setESection} options={[{ value: 'none', label: p('editDialog.allSections') }, ...sectionsOf(eGrade).map((s) => ({ value: s.id, label: s.name }))]} />
            </>
          ) : null}
          <Label>{p('editDialog.subjectLabel')}</Label>
          <Picker value={eSubject} onChange={setESubject} options={subjOptions} />
          <Label>{p('editDialog.noteLabel')}</Label>
          <Textarea value={eNote} onChangeText={setENote} />
          <View className="flex-row items-center gap-2">
            <Switch checked={eActive} onCheckedChange={setEActive} />
            <Label>{p('editDialog.activeLabel')}</Label>
          </View>
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" onPress={() => setEdit(null)}>
              <Text>{p('editDialog.cancel')}</Text>
            </Button>
            <Button onPress={saveEdit} disabled={busy}>
              <Text>{busy ? p('editDialog.saving') : p('editDialog.save')}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>

      <Dialog open={!!subsLab} onOpenChange={(o) => !o && setSubsLab(null)}>
        <DialogContent className="max-h-[85%] w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{p('submissionsDialog.title', { title: entry(subsLab?.sim_key ?? '')?.title ?? subsLab?.sim_key ?? '' })}</DialogTitle>
          </DialogHeader>
          <ScrollView contentContainerClassName="gap-2">
            {subs.isLoading ? (
              <Text className="text-muted-foreground">{p('submissionsDialog.loading')}</Text>
            ) : !(subs.data ?? []).length ? (
              <Text className="text-muted-foreground">{p('submissionsDialog.empty')}</Text>
            ) : (
              (subs.data ?? []).map((x) => {
                const name = x.profiles ? `${x.profiles.first_name ?? ''} ${x.profiles.last_name ?? ''}`.trim() || 'Student' : 'Student';
                const mins = x.time_spent_s ? Math.round(x.time_spent_s / 60) : null;
                return (
                  <View key={x.id} className="border-border gap-1 rounded-md border p-2">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="font-medium">{name}</Text>
                      {x.profiles?.grade_levels?.name ? <Text className="text-muted-foreground text-xs">{x.profiles.grade_levels.name}</Text> : null}
                      {mins !== null ? <Text className="text-muted-foreground text-xs">{p('submissionsDialog.minLabel', { count: mins })}</Text> : null}
                      <Text className="text-muted-foreground text-xs">{new Date(x.submitted_at).toLocaleDateString(i18n.language)}</Text>
                    </View>
                    <Text className="text-sm">{x.findings_text}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        </DialogContent>
      </Dialog>

      <Modal visible={!!preview} animationType="slide" onRequestClose={() => setPreview(null)}>
        <SafeAreaView className="bg-background flex-1">
          <View className="border-border flex-row items-center gap-2 border-b px-3 py-2">
            <Icon as={FlaskConical} className="text-primary size-4" />
            <Text className="flex-1 font-semibold" numberOfLines={1}>
              {preview ? sim(preview).title : ''}
            </Text>
            <Pressable onPress={() => setPreview(null)} hitSlop={8} accessibilityLabel={t('common.close')}>
              <Icon as={X} className="text-foreground size-5" />
            </Pressable>
          </View>
          {preview ? <PublicWebView url={preview.url} /> : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
