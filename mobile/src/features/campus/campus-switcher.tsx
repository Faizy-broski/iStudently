import { Building2, Check, ChevronDown, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { raised } from '@/components/app/tile-grid';
import { BottomSheet } from '@/components/app/bottom-sheet';
import { BrandGradient } from '@/components/app/brand-gradient';
import { SchoolLogo } from '@/components/app/school-logo';
import { SearchBar } from '@/components/app/search-bar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { colors } from '@/lib/colors';

/**
 * Header title: school logo + current campus; admins tap it to pick a campus (web: CampusSwitcher).
 * `variant="card"`: the More screen card (Figma): "Campus / name / Switch".
 */
export function CampusSwitcher({ variant = 'header', detail }: { variant?: 'header' | 'card' | 'pill'; detail?: string }) {
  const { t } = useTranslation();
  const { me } = useSession();
  const { campuses, campus, canSwitch, setCampus } = useCampus();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? campuses.filter((c) => [c.name, c.city, c.address].some((v) => v?.toLowerCase().includes(q))) : campuses;
  const school = me.status === 'ready' ? me.me.school : null;
  const name = campus?.name ?? school?.name ?? '';
  const logo = campus?.logo_url ?? school?.logo_url;

  const title =
    variant === 'pill' ? (
      <View style={raised(colors.brand)} className="border-info-soft dark:border-border bg-card h-11 flex-row items-center gap-2 rounded-full border px-4">
        <Icon as={Building2} className="text-brand dark:text-brand-secondary size-4" />
        <Text className="shrink text-sm font-semibold" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="muted" className="flex-1 text-xs" numberOfLines={1}>
          {detail ?? (campuses.length > 1 ? t('app.cp_count', { count: campuses.length }) : '')}
        </Text>
        {canSwitch ? <Icon as={ChevronDown} className="text-muted-foreground size-4" /> : null}
      </View>
    ) : variant === 'card' ? (
      <View style={raised(colors.brand)} className="border-info-soft dark:border-border bg-card flex-row items-center gap-3 rounded-2xl border p-3">
        <View className="bg-info-soft size-11 items-center justify-center rounded-full">
          <Icon as={Building2} className="text-brand dark:text-brand-secondary size-5" />
        </View>
        <View className="flex-1">
          <Text variant="muted" className="text-xs">
            {t('app.cp_campus')}
          </Text>
          <Text className="font-semibold" numberOfLines={1}>
            {name}
          </Text>
        </View>
        {canSwitch ? <Text className="text-brand-secondary text-sm font-semibold">{t('app.cp_switch_short')}</Text> : null}
      </View>
    ) : (
    <View className="max-w-64 flex-row items-center gap-2">
      <SchoolLogo url={logo} size={28} shape={campus?.logo_shape ?? 'rounded'} />
      <Text className="shrink font-semibold" numberOfLines={1}>
        {name}
      </Text>
      {canSwitch ? <Icon as={ChevronDown} className="text-muted-foreground size-4" /> : null}
    </View>
    );
  if (!canSwitch) return title;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('app.cp_switch', { name })}>
        {title}
      </Pressable>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('app.cp_title')}>
        {campuses.length > 5 ? (
          <View className="mb-3">
            <SearchBar value={query} onChangeText={setQuery} placeholder={t('app.cp_search')} />
          </View>
        ) : null}
        <ScrollView contentContainerClassName="gap-2.5 pb-2" keyboardShouldPersistTaps="handled">
          {shown.map((c) => {
            const selected = c.id === campus?.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  setCampus(c.id);
                  setOpen(false);
                  setQuery('');
                }}
                style={selected ? undefined : raised(colors.brand)}
                className={selected ? 'bg-info-soft border-brand-secondary flex-row items-center gap-3 rounded-2xl border-2 p-3' : 'border-info-soft dark:border-border bg-card flex-row items-center gap-3 rounded-2xl border p-3 active:opacity-80'}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}>
                <BrandGradient variant="primary" angle={135} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon as={MapPin} className="size-5 text-white" />
                </BrandGradient>
                <View className="flex-1">
                  <Text className="font-semibold" numberOfLines={1}>
                    {c.name}
                  </Text>
                  {c.city || c.address ? (
                    <Text variant="muted" className="text-xs" numberOfLines={1}>
                      {[c.address, c.city].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                {selected ? (
                  <View className="bg-brand size-6 items-center justify-center rounded-full">
                    <Icon as={Check} strokeWidth={3} className="size-3.5 text-white" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          {shown.length === 0 ? (
            <Text variant="muted" className="py-6 text-center text-sm">
              {t('app.cp_none')}
            </Text>
          ) : null}
        </ScrollView>
      </BottomSheet>
    </>
  );
}
