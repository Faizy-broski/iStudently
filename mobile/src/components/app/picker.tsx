import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export interface PickerOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Single-choice select with a plain string value (wraps React Native Reusables Select). */
export function Picker({
  value,
  options,
  onChange,
  placeholder,
  invalid,
  className,
}: {
  value: string | null | undefined;
  options: PickerOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}) {
  const insets = useSafeAreaInsets();
  const selected = options.find((o) => o.value === value);
  return (
    <Select value={selected} onValueChange={(o) => o && onChange(o.value)}>
      <SelectTrigger className={cn('w-full', invalid && 'border-destructive', className)}>
        <SelectValue placeholder={placeholder ?? ''} />
      </SelectTrigger>
      <SelectContent insets={{ top: insets.top, bottom: insets.bottom, left: 12, right: 12 }} className="w-[92%]">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} label={o.label} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Picker bound to react-hook-form. */
export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  options: PickerOption[];
  placeholder?: string;
}) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View className="gap-1.5">
          {label ? <Label className={cn(fieldState.error && 'text-destructive')}>{label}</Label> : null}
          <Picker value={field.value} options={options} onChange={field.onChange} placeholder={placeholder} invalid={!!fieldState.error} />
          {fieldState.error?.message ? (
            <Text className="text-destructive text-sm">{t(fieldState.error.message, { defaultValue: fieldState.error.message })}</Text>
          ) : null}
        </View>
      )}
    />
  );
}
