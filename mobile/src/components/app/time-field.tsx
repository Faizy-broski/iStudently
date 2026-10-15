import { View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

/** "HH:MM" (24h) as hour + minute pickers; minutes step by `step` but keep an existing odd value. */
export function TimeField({ value, onChange, label, step = 5, className }: { value: string; onChange: (v: string) => void; label?: string; step?: number; className?: string }) {
  const [h = '00', m = '00'] = (value || '00:00').slice(0, 5).split(':');
  const minutes = Array.from({ length: 60 / step }, (_, i) => String(i * step).padStart(2, '0'));
  if (!minutes.includes(m)) minutes.push(m);
  minutes.sort();
  return (
    <View className={cn('gap-1.5', className)}>
      {label ? <Label>{label}</Label> : null}
      <View className="flex-row gap-1">
        <Picker className="flex-1" value={h} onChange={(v) => onChange(`${v}:${m}`)} options={HOURS.map((x) => ({ value: x, label: x }))} />
        <Picker className="flex-1" value={m} onChange={(v) => onChange(`${h}:${v}`)} options={minutes.map((x) => ({ value: x, label: x }))} />
      </View>
    </View>
  );
}
