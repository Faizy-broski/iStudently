import { router, Stack, useFocusEffect, type Href } from 'expo-router';
import { FlaskConical, Heart } from 'lucide-react-native';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FlatList } from '@/components/app/lists';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useColors } from '@/lib/colors';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

import { LAB_NOT_INSTALLED, useLabCatalog } from './catalog';
import { buildHaystacks, countBy, EMPTY_FILTER, filterExperiments, labName, LAB_LANGS, type LabExperiment, type LabFilter, type LabLang } from './model';
import { useLabLang, useLabLists } from './store';

export type LabRole = 'admin' | 'teacher' | 'student' | 'parent';

/** Language names are shown in their own language on purpose. */
const LANG_NAMES: Record<LabLang, string> = { ar: 'العربية', en: 'English', fr: 'Français' };

function Chip({ label, on, onPress, small }: { label: string; on: boolean; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      className={cn('rounded-full border active:opacity-70', small ? 'px-3 py-1' : 'px-3.5 py-1.5', on ? 'bg-brand border-brand dark:bg-brand-secondary dark:border-brand-secondary' : 'border-info-soft dark:border-border bg-card')}>
      <Text className={cn('font-semibold', small ? 'text-xs' : 'text-sm', on ? 'text-white' : 'text-muted-foreground')}>{label}</Text>
    </Pressable>
  );
}

type RowProps = {
  exp: LabExperiment;
  lang: LabLang;
  groupLabel: string;
  kindLabel: string;
  fav: boolean;
  openLabel: string;
  favLabel: string;
  onOpen: (code: string) => void;
  onToggleFav: (code: string) => void;
};

/** One experiment row. Memoised: with ~1,800 rows only the rows whose props change re-render. */
const LabRow = memo(function LabRow({ exp, lang, groupLabel, kindLabel, fav, openLabel, favLabel, onOpen, onToggleFav }: RowProps) {
  const colors = useColors();
  const title = labName(exp, lang, exp.code);
  const meta = [groupLabel, kindLabel].filter(Boolean).join(' · ');
  return (
    <View className="border-info-soft dark:border-border bg-card mx-4 mb-2 flex-row items-center gap-3 overflow-hidden rounded-2xl border ps-3">
      <Pressable onPress={() => onOpen(exp.code)} accessibilityRole="button" accessibilityLabel={`${openLabel}: ${title}`} className="flex-1 flex-row items-center gap-3 py-3 active:opacity-70">
        <View className="bg-info-soft min-w-16 items-center rounded-lg px-2 py-1.5">
          <Text className="text-brand dark:text-brand-secondary text-xs font-bold" numberOfLines={1}>
            {exp.code}
          </Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold" numberOfLines={2}>
            {title}
          </Text>
          {meta ? (
            <Text variant="muted" className="text-xs" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable onPress={() => onToggleFav(exp.code)} hitSlop={6} accessibilityRole="button" accessibilityLabel={favLabel} accessibilityState={{ selected: fav }} className="p-3 active:opacity-70">
        <Icon as={Heart} fill={fav ? colors.destructive : 'none'} className={cn('size-5', fav ? 'text-destructive' : 'text-muted-foreground')} />
      </Pressable>
    </View>
  );
});

/**
 * The Jahbadh Lab catalog (web: /<role>/resources/jahbadh-lab): search in Arabic/English/French, subject,
 * section and level filters, favourites and recently opened. The ~1,800 experiments are plain HTML files
 * served from /lab/; the list comes from catalog.json.
 */
export function JahbadhLabCatalog({ role }: { role: LabRole }) {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.${key}`, o);
  const catalog = useLabCatalog();
  const { favs, recent, toggleFav, reload } = useLabLists();
  const [lang, setLang] = useLabLang(i18n.language);
  const [filter, setFilter] = useState<LabFilter>(EMPTY_FILTER);
  const [typed, setTyped] = useState('');
  const query = useDebounced(typed, 250);

  // The catalog stays mounted under the player, which writes favourites/recent: re-read them on return.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const data = catalog.data ?? null;
  const experiments = useMemo(() => (data ? data.experiments : []), [data]);
  const haystacks = useMemo(() => buildHaystacks(experiments), [experiments]);
  const favSet = useMemo(() => new Set(favs), [favs]);
  const byCode = useMemo(() => new Map(experiments.map((e) => [e.code, e])), [experiments]);
  const subjectCounts = useMemo(() => countBy(experiments, 'subject'), [experiments]);

  const subjects = useMemo(() => (data ? data.subjects.filter((s) => subjectCounts.has(s.id)) : []), [data, subjectCounts]);
  const groups = useMemo(() => (data && filter.subject ? data.groups.filter((g) => g.subject === filter.subject) : []), [data, filter.subject]);
  const groupLabels = useMemo(() => new Map((data ? data.groups : []).map((g) => [g.id, labName(g, lang)])), [data, lang]);
  const levels = useMemo(() => {
    if (!data) return [];
    const used = countBy(experiments, 'level');
    return data.levels.filter((l) => used.has(l.id));
  }, [data, experiments]);

  const results = useMemo(() => filterExperiments(experiments, haystacks, { ...filter, query }, favSet), [experiments, haystacks, filter, query, favSet]);
  const recentExps = useMemo(() => recent.map((c) => byCode.get(c)).filter((e): e is LabExperiment => !!e), [recent, byCode]);

  const filtered = !!(filter.subject || filter.group || filter.level || filter.favouritesOnly || query.trim());
  const set = (patch: Partial<LabFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const clear = () => {
    setTyped('');
    setFilter(EMPTY_FILTER);
  };

  const kindLabels = useMemo<Record<string, string>>(
    () => ({ experiment: t('app.jl_kind_experiment'), simulation: t('app.jl_kind_simulation'), howto: t('app.jl_kind_howto'), tool: t('app.jl_kind_tool'), model: t('app.jl_kind_model') }),
    [t],
  );
  const openLabel = k('jl_open');
  const onOpen = useCallback((code: string) => router.push({ pathname: `/${role}/jahbadh-lab/[code]`, params: { code } } as unknown as Href), [role]);

  if (catalog.isLoading) {
    return (
      <View className="bg-background flex-1 p-4">
        <Stack.Screen options={{ title: k('jl_title') }} />
        <LoadingList />
      </View>
    );
  }

  const err = catalog.error;
  if (err || !data) {
    const notInstalled = err?.code === LAB_NOT_INSTALLED;
    return (
      <View className="bg-background flex-1">
        <Stack.Screen options={{ title: k('jl_title') }} />
        {notInstalled ? (
          <EmptyState icon={FlaskConical} title={k('jl_not_installed')} body={k('jl_not_installed_body')} actionLabel={t('app.retry')} onAction={() => catalog.mutate()} />
        ) : (
          <ErrorState message={k('jl_load_failed')} offline={err?.offline} onRetry={() => catalog.mutate()} />
        )}
      </View>
    );
  }

  const header = (
    <View className="gap-3 p-4 pb-2">
      <Text className="text-muted-foreground text-sm">{k('jl_subtitle')}</Text>
      <SearchBar value={typed} onChangeText={setTyped} placeholder={k('jl_search')} />
      <View className="flex-row gap-2" accessibilityLabel={k('jl_language')}>
        {LAB_LANGS.map((l) => (
          <Chip key={l} small label={LANG_NAMES[l]} on={lang === l} onPress={() => setLang(l)} />
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" keyboardShouldPersistTaps="handled">
        <Chip label={k('jl_all')} on={!filter.subject && !filter.favouritesOnly} onPress={() => set({ subject: null, group: null, favouritesOnly: false })} />
        <Chip label={k('jl_favourites_n', { count: favs.length })} on={filter.favouritesOnly} onPress={() => set({ favouritesOnly: !filter.favouritesOnly })} />
        {subjects.map((s) => (
          <Chip key={s.id} label={`${labName(s, lang, s.id)} (${subjectCounts.get(s.id) ?? 0})`} on={filter.subject === s.id} onPress={() => set({ subject: filter.subject === s.id ? null : s.id, group: null })} />
        ))}
      </ScrollView>
      {groups.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" keyboardShouldPersistTaps="handled">
          <Chip small label={k('jl_group')} on={!filter.group} onPress={() => set({ group: null })} />
          {groups.map((g) => (
            <Chip key={g.id} small label={labName(g, lang, g.id)} on={filter.group === g.id} onPress={() => set({ group: filter.group === g.id ? null : g.id })} />
          ))}
        </ScrollView>
      ) : null}
      {levels.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" keyboardShouldPersistTaps="handled">
          <Chip small label={k('jl_level')} on={!filter.level} onPress={() => set({ level: null })} />
          {levels.map((l) => (
            <Chip key={l.id} small label={labName(l, lang, l.id)} on={filter.level === l.id} onPress={() => set({ level: filter.level === l.id ? null : l.id })} />
          ))}
        </ScrollView>
      ) : null}
      {!filtered && recentExps.length ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold">{k('jl_recent')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" keyboardShouldPersistTaps="handled">
            {recentExps.map((e) => (
              <Chip key={e.code} small label={`${e.code} · ${labName(e, lang, e.code)}`} on={false} onPress={() => onOpen(e.code)} />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View className="flex-row items-center justify-between">
        <Text variant="muted" className="text-xs">
          {k('jl_results', { count: results.length })}
        </Text>
        {filtered ? (
          <Pressable onPress={clear} hitSlop={8} accessibilityRole="button" className="active:opacity-70">
            <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{k('jl_clear_filters')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: k('jl_title') }} />
      <FlatList
        data={results}
        keyExtractor={(e) => e.code}
        renderItem={({ item }) => (
          <LabRow
            exp={item}
            lang={lang}
            groupLabel={item.group ? (groupLabels.get(item.group) ?? '') : ''}
            kindLabel={item.kind ? (kindLabels[item.kind] ?? '') : ''}
            fav={favSet.has(item.code)}
            openLabel={openLabel}
            favLabel={favSet.has(item.code) ? k('jl_remove_fav') : k('jl_add_fav')}
            onOpen={onOpen}
            onToggleFav={toggleFav}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon={filter.favouritesOnly && favs.length === 0 ? Heart : FlaskConical}
            title={filter.favouritesOnly && favs.length === 0 ? k('jl_no_favourites') : k('jl_no_results')}
            body={filter.favouritesOnly && favs.length === 0 ? k('jl_no_favourites_body') : k('jl_no_results_body')}
            actionLabel={filtered ? k('jl_clear_filters') : undefined}
            onAction={filtered ? clear : undefined}
          />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => catalog.mutate()} />}
      />
    </View>
  );
}
