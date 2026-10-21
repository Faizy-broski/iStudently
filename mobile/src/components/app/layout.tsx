import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Pencil, Trash2, X, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandGradient } from '@/components/app/brand-gradient';
import { Panel } from '@/components/app/panel';
import { PersonAvatar } from '@/components/app/person-avatar';
import { raised } from '@/components/app/tile-grid';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useColors } from '@/lib/colors';
import { cn } from '@/lib/utils';

// Layout building blocks of the app's design (the Figma dashboards), shared by every screen.

export type Tone = 'brand' | 'success' | 'warning' | 'destructive' | 'muted';
const SOFT: Record<Tone, string> = { brand: 'bg-info-soft', success: 'bg-success-soft', warning: 'bg-warning-soft', destructive: 'bg-destructive-soft', muted: 'bg-muted' };
const FG: Record<Tone, string> = { brand: 'text-brand dark:text-brand-secondary', success: 'text-success', warning: 'text-warning', destructive: 'text-destructive', muted: 'text-muted-foreground' };

/** Section title with an optional "View all"-style action. */
export function Section({ title, action, onAction, children, className }: { title: string; action?: string; onAction?: () => void; children: ReactNode; className?: string }) {
  const { t } = useTranslation();
  return (
    <View className={cn('gap-2', className)}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-base font-semibold">{title}</Text>
        {onAction ? (
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="link">
            <Text className="text-brand-secondary text-sm font-medium">{action ?? t('app.sad_view_all')}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Soft rounded icon square (or circle) in a tone. */
export function IconTile({ icon, tone = 'brand', size = 36, round }: { icon: LucideIcon; tone?: Tone; size?: number; round?: boolean }) {
  return (
    <View style={{ width: size, height: size }} className={cn('items-center justify-center', round ? 'rounded-full' : 'rounded-xl', SOFT[tone])}>
      <Icon as={icon} strokeWidth={2.2} className={cn(size >= 48 ? 'size-6' : size >= 40 ? 'size-5' : size >= 32 ? 'size-[18px]' : 'size-4', FG[tone])} />
    </View>
  );
}

/** Initials in a soft circle (people rows). */
export function Initials({ name, tone = 'brand', size = 36 }: { name: string; tone?: Tone; size?: number }) {
  const ini =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('') || '?';
  return (
    <View style={{ width: size, height: size }} className={cn('items-center justify-center rounded-full', SOFT[tone])}>
      <Text className={cn(size >= 40 ? 'text-sm font-bold' : 'text-xs font-bold', FG[tone])}>{ini}</Text>
    </View>
  );
}

/** One divided row inside a Panel: leading tile, title + meta, trailing slot, optional chevron. */
export function RowItem({
  title,
  meta,
  leading,
  trailing,
  onPress,
  chevron,
  last,
  children,
  className,
}: {
  title: string;
  meta?: string | null;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  last?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const body = (
    <View className={cn('gap-2 px-4 py-3', !last && 'border-info-soft dark:border-border border-b', className)}>
      <View className="flex-row items-center gap-3">
        {leading}
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold" numberOfLines={2}>
            {title}
          </Text>
          {meta ? (
            <Text variant="muted" className="text-[11px]" numberOfLines={2}>
              {meta}
            </Text>
          ) : null}
        </View>
        {trailing}
        {chevron ?? !!onPress ? <Icon as={ChevronRight} flipRtl className="text-muted-foreground size-4" /> : null}
      </View>
      {children}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} className="active:opacity-70" accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** Raised number tile: muted label, big brand number, optional note or chip. */
export function StatTile({ label, value, note, chip, tone = 'brand', icon, onPress }: { label: string; value: string; note?: string; chip?: ReactNode; tone?: Tone; icon?: LucideIcon; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={raised(c.brand)}
      className="border-info-soft dark:border-border bg-card min-w-[30%] flex-1 gap-1 rounded-2xl border p-3 active:opacity-80"
      accessibilityRole={onPress ? 'button' : undefined}>
      <View className="flex-row items-center gap-1.5">
        {icon ? <Icon as={icon} className={cn('size-4', FG[tone])} /> : null}
        <Text variant="muted" className="flex-1 text-[11px]" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text className={cn('text-xl font-bold', tone === 'brand' ? 'text-brand dark:text-foreground' : FG[tone])} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {chip ?? (note ? (
        <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>
          {note}
        </Text>
      ) : null)}
    </Pressable>
  );
}

/** A wrapping row of StatTiles (2–4 per line). */
export function StatTiles({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap gap-2.5">{children}</View>;
}

/** Brand gradient summary card (white text). */
export function HeroCard({ children, style, className }: { children: ReactNode; style?: ViewStyle; className?: string }) {
  return (
    <BrandGradient variant="primary" angle={150} style={[{ borderRadius: 24 }, style ?? {}]}>
      <View className={cn('gap-3 p-5', className)}>{children}</View>
    </BrandGradient>
  );
}

/** Titled Panel for a group of form fields or settings. */
export function FormSection({ title, description, icon, children, className, action }: { title: string; description?: string; icon?: LucideIcon; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <Panel className={cn('gap-3 p-4', className)}>
      <View className="flex-row items-center gap-2.5">
        {icon ? <IconTile icon={icon} size={32} /> : null}
        <View className="flex-1">
          <Text className="font-semibold">{title}</Text>
          {description ? (
            <Text variant="muted" className="text-xs">
              {description}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </Panel>
  );
}

/** Bottom bar for a screen's main action(s); put it after the scroll view. */
export function StickyActions({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="bg-background border-info-soft dark:border-border flex-row gap-2 border-t px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
      {children}
    </View>
  );
}

/** Header of a detail screen: photo or icon, name, subtitle, chips. */
export function DetailHeader({ name, subtitle, photo, icon, chips, actions }: { name: string; subtitle?: string | null; photo?: string | null; icon?: LucideIcon; chips?: ReactNode; actions?: ReactNode }) {
  return (
    <Panel className="flex-row items-center gap-3 p-4">
      {icon ? <IconTile icon={icon} size={56} /> : <PersonAvatar url={photo ?? null} name={name} size={56} />}
      <View className="flex-1 gap-1">
        <Text className="text-brand dark:text-foreground text-lg font-bold" numberOfLines={2}>
          {name}
        </Text>
        {subtitle ? (
          <Text variant="muted" className="text-xs" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {chips ? <View className="flex-row flex-wrap gap-1.5">{chips}</View> : null}
      </View>
      {actions}
    </Panel>
  );
}

/** Round raised icon button (header-style), with an optional count badge. */
export function RoundIcon({ icon, label, onPress, count }: { icon: LucideIcon; label: string; onPress: () => void; count?: number }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={raised(c.brand)} className="border-info-soft dark:border-border bg-card size-12 items-center justify-center rounded-full border active:opacity-80" accessibilityRole="button" accessibilityLabel={label}>
      <Icon as={icon} className="text-brand dark:text-brand-secondary size-5" />
      {count ? (
        <View className="bg-brand-accent absolute -end-0.5 -top-0.5 min-w-5 items-center justify-center rounded-full px-1">
          <Text className="text-white text-[10px] font-bold">{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Active filter shown as a pill; tap to clear it. */
export function FilterTag({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Pressable onPress={onClear} className="border-info-soft dark:border-border bg-card flex-row items-center gap-1 rounded-full border px-2.5 py-1 active:opacity-70" accessibilityRole="button" accessibilityLabel={label}>
      <Text className="text-xs font-medium">{label}</Text>
      <Icon as={X} className="text-muted-foreground size-3" />
    </Pressable>
  );
}

/** Sort pills: tap a field to sort by it, tap again to flip the direction. */
export function SortChips<K extends string>({ options, value, dir, onChange }: { options: [K, string][]; value: K; dir: 'asc' | 'desc'; onChange: (key: K, dir: 'asc' | 'desc') => void }) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {options.map(([k, label]) => {
        const on = value === k;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k, on ? (dir === 'asc' ? 'desc' : 'asc') : 'asc')}
            className={cn('flex-row items-center gap-1 rounded-full border px-3 py-1.5', on ? 'border-brand bg-brand' : 'border-info-soft dark:border-border bg-card')}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}>
            <Text className={cn('text-xs font-semibold', on ? 'text-white' : 'text-foreground')}>{label}</Text>
            {on ? <Icon as={dir === 'asc' ? ArrowUp : ArrowDown} className="text-white size-3" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export type HeroActionItem = { icon: LucideIcon; label: string; onPress: () => void };

/** Gradient profile header: photo, name, subtitle, chips, round quick actions, optional previous / next. */
export function PersonHero({
  name,
  subtitle,
  photo,
  chips,
  actions,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  name: string;
  subtitle?: string | null;
  photo?: string | null;
  chips?: ReactNode;
  actions?: HeroActionItem[];
  onPrev?: (() => void) | null;
  onNext?: (() => void) | null;
  prevLabel?: string;
  nextLabel?: string;
}) {
  const nav = onPrev !== undefined || onNext !== undefined;
  const arrow = (dir: 'prev' | 'next') => {
    const fn = dir === 'prev' ? onPrev : onNext;
    return (
      <Pressable onPress={fn ?? undefined} disabled={!fn} className={cn('size-9 items-center justify-center rounded-full bg-white/15', !fn && 'opacity-40')} accessibilityRole="button" accessibilityLabel={dir === 'prev' ? prevLabel : nextLabel}>
        <Icon as={dir === 'prev' ? ChevronLeft : ChevronRight} flipRtl className="text-white size-5" />
      </Pressable>
    );
  };
  return (
    <HeroCard>
      <View className="flex-row items-center gap-3">
        {nav ? arrow('prev') : null}
        <View className="flex-1 items-center gap-1.5">
          <View className="rounded-full border-2 border-white/40">
            <PersonAvatar url={photo ?? null} name={name} size={76} />
          </View>
          <Text className="text-white text-center text-xl font-bold">{name}</Text>
          {subtitle ? <Text className="text-white text-center text-xs opacity-80">{subtitle}</Text> : null}
          {chips ? <View className="flex-row flex-wrap items-center justify-center gap-1.5">{chips}</View> : null}
        </View>
        {nav ? arrow('next') : null}
      </View>
      {actions?.length ? (
        <View className="flex-row justify-center gap-5">
          {actions.map((a) => (
            <Pressable key={a.label} onPress={a.onPress} className="items-center gap-1 active:opacity-70" accessibilityRole="button" accessibilityLabel={a.label}>
              <View className="size-11 items-center justify-center rounded-full bg-white/15">
                <Icon as={a.icon} className="text-white size-5" />
              </View>
              <Text className="text-white text-[11px] opacity-90" numberOfLines={1}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </HeroCard>
  );
}

/** Edit / delete round buttons at the end of a card row (plus optional extra actions before them). */
export function RowActions({ onEdit, onDelete, editLabel, deleteLabel, children }: { onEdit?: () => void; onDelete?: () => void; editLabel?: string; deleteLabel?: string; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-end gap-2">
      {children}
      {onEdit ? (
        <Pressable onPress={onEdit} hitSlop={4} accessibilityRole="button" accessibilityLabel={editLabel ?? t('common.edit')} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
          <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-4" />
        </Pressable>
      ) : null}
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={4} accessibilityRole="button" accessibilityLabel={deleteLabel ?? t('common.delete')} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
          <Icon as={Trash2} className="text-destructive size-4" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Header-bar icon button (add, export …) for Stack.Screen headerRight. */
export function HeaderButton({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label} className="p-2 active:opacity-70">
      <Icon as={icon} className="text-brand dark:text-brand-secondary size-5" />
    </Pressable>
  );
}

/** Thin used-of-total bar (seats, copies, capacity): green, amber from 75 %, red from 90 %. */
export function UsageBar({ used, total, label }: { used: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.min(1, used / total) : 0;
  const tone = pct >= 0.9 ? 'bg-destructive' : pct >= 0.75 ? 'bg-warning' : 'bg-success';
  return (
    <View className="gap-1">
      {label ? (
        <Text variant="muted" className="text-[11px]">
          {label}
        </Text>
      ) : null}
      <View className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <View className={cn('h-1.5 rounded-full', tone)} style={{ width: `${Math.round(pct * 100)}%` }} />
      </View>
    </View>
  );
}

/** Check box mark in the app style (brand fill and white tick when on). */
export function CheckMark({ on, size = 20 }: { on: boolean; size?: number }) {
  return (
    <View style={{ width: size, height: size }} className={cn('items-center justify-center rounded-md border-2', on ? 'border-brand bg-brand dark:border-brand-secondary dark:bg-brand-secondary' : 'border-info-soft dark:border-border bg-card')}>
      {on ? <Icon as={Check} strokeWidth={3} className="size-3 text-white" /> : null}
    </View>
  );
}

/** Drill-down path as chips: earlier steps are tappable, the last one is highlighted. */
export function Breadcrumbs({ items }: { items: { label: string; onPress?: () => void }[] }) {
  return (
    <View className="flex-row flex-wrap items-center gap-1.5">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <View key={`${i}-${it.label}`} className="flex-row items-center gap-1.5">
            {i > 0 ? <Icon flipRtl as={ChevronRight} className="text-muted-foreground size-3.5" /> : null}
            <Pressable
              onPress={it.onPress}
              disabled={last || !it.onPress}
              accessibilityRole={last ? 'text' : 'link'}
              className={cn('rounded-full px-3 py-1', last ? 'bg-brand dark:bg-brand-secondary' : 'bg-info-soft active:opacity-70')}>
              <Text className={cn('text-xs font-semibold', last ? 'text-white' : 'text-brand dark:text-brand-secondary')} numberOfLines={1}>
                {it.label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

/** Small text pill action in a card row (enable/disable, view …), next to RowActions. */
export function RowPill({ label, onPress, icon, tone = 'brand' }: { label: string; onPress: () => void; icon?: LucideIcon; tone?: Tone }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button" className={cn('flex-row items-center gap-1 rounded-full px-3 py-2 active:opacity-70', SOFT[tone])}>
      {icon ? <Icon as={icon} className={cn('size-3.5', FG[tone])} /> : null}
      <Text className={cn('text-xs font-semibold', FG[tone])}>{label}</Text>
    </Pressable>
  );
}
