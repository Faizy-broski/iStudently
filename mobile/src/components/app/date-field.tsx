import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** "YYYY-MM-DD" in local time. */
export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayYmd() {
  return ymd(new Date());
}

export function parseYmd(s: string | null | undefined): Date | null {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function addDays(s: string, days: number) {
  const d = parseYmd(s) ?? new Date();
  d.setDate(d.getDate() + days);
  return ymd(d);
}

export function monthNames(locale: string) {
  return Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, i, 1)));
}

/** Sunday-first short weekday names. */
export function weekdayNames(locale: string, width: 'short' | 'narrow' = 'short') {
  return Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: width }).format(new Date(2000, 0, 2 + i)));
}

export function formatYmd(s: string | null | undefined, locale: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  const d = parseYmd(s);
  return d ? new Intl.DateTimeFormat(locale, opts).format(d) : '';
}

/** Weeks (Sunday-first) of a month; null cells pad the first and last week. */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

function CalendarPicker({ value, onPick, min, max }: { value: string | null; onPick: (v: string) => void; min?: string; max?: string }) {
  const { i18n } = useTranslation();
  const start = parseYmd(value) ?? new Date();
  const [cursor, setCursor] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const names = monthNames(i18n.language);
  const days = weekdayNames(i18n.language, 'narrow');
  const today = todayYmd();
  const shift = (n: number) => setCursor(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  const Prev = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  const Next = I18nManager.isRTL ? ChevronLeft : ChevronRight;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => shift(-1)} hitSlop={10} className="p-2" accessibilityRole="button">
          <Icon as={Prev} className="text-foreground size-5" />
        </Pressable>
        <Pressable onPress={() => setCursor(({ y, m }) => ({ y: y + 1, m }))} onLongPress={() => setCursor(({ y, m }) => ({ y: y - 1, m }))}>
          <Text className="font-semibold">{`${names[cursor.m]} ${cursor.y}`}</Text>
        </Pressable>
        <Pressable onPress={() => shift(1)} hitSlop={10} className="p-2" accessibilityRole="button">
          <Icon as={Next} className="text-foreground size-5" />
        </Pressable>
      </View>
      <View className="flex-row">
        {days.map((d, i) => (
          <Text key={i} className="text-muted-foreground flex-1 text-center text-xs">
            {d}
          </Text>
        ))}
      </View>
      {monthGrid(cursor.y, cursor.m).map((week, wi) => (
        <View key={wi} className="flex-row">
          {week.map((day, di) => {
            if (!day) return <View key={di} className="h-10 flex-1" />;
            const s = ymd(new Date(cursor.y, cursor.m, day));
            const disabled = (!!min && s < min) || (!!max && s > max);
            const selected = s === value;
            return (
              <Pressable
                key={di}
                disabled={disabled}
                onPress={() => onPick(s)}
                className={cn('h-10 flex-1 items-center justify-center rounded-md', selected && 'bg-primary', disabled && 'opacity-30')}>
                <Text className={cn('text-sm', selected ? 'text-primary-foreground font-semibold' : s === today ? 'text-primary font-semibold' : 'text-foreground')}>
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** A date input ("YYYY-MM-DD") that opens a month calendar. */
export function DateField({
  value,
  onChange,
  label,
  placeholder,
  clearable,
  min,
  max,
  className,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  clearable?: boolean;
  min?: string;
  max?: string;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View className={cn('gap-1.5', className)}>
      {label ? <Label>{label}</Label> : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="border-input bg-background h-10 flex-row items-center gap-2 rounded-md border px-3">
        <Icon as={CalendarDays} className="text-muted-foreground size-4" />
        <Text className={cn('flex-1', !value && 'text-muted-foreground')} numberOfLines={1}>
          {value ? formatYmd(value, i18n.language) : (placeholder ?? t('app.df_pick'))}
        </Text>
        {clearable && value ? (
          <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel={t('app.df_clear')}>
            <Icon as={X} className="text-muted-foreground size-4" />
          </Pressable>
        ) : null}
      </Pressable>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[92vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>{label ?? t('app.df_pick')}</DialogTitle>
          </DialogHeader>
          {open ? (
            <CalendarPicker
              value={value || null}
              min={min}
              max={max}
              onPick={(v) => {
                onChange(v);
                setOpen(false);
              }}
            />
          ) : null}
          <Button
            variant="outline"
            onPress={() => {
              onChange(todayYmd());
              setOpen(false);
            }}>
            <Text>{t('app.df_today')}</Text>
          </Button>
        </DialogContent>
      </Dialog>
    </View>
  );
}
