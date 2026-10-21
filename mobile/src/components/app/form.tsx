import type { ComponentProps, ReactNode } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors } from '@/lib/colors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Validation messages in zod schemas are i18n keys (e.g. 'app.v_required'); this translates them,
 * falling back to the raw message for server-provided text.
 */
function useErrorText(message?: string) {
  const { t } = useTranslation();
  return message ? t(message, { defaultValue: message }) : undefined;
}

function FieldShell({
  label,
  error,
  hint,
  children,
}: {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const errorText = useErrorText(error);
  return (
    <View className="gap-1.5">
      {label ? <Label className={cn(errorText && 'text-destructive')}>{label}</Label> : null}
      {children}
      {errorText ? (
        <Text className="text-destructive text-sm" accessibilityLiveRegion="polite">
          {errorText}
        </Text>
      ) : hint ? (
        <Text className="text-muted-foreground text-sm">{hint}</Text>
      ) : null}
    </View>
  );
}

type BaseProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  hint?: string;
};

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  multiline,
  ...inputProps
}: BaseProps<T> & { multiline?: boolean } & Omit<
    ComponentProps<typeof Input>,
    'value' | 'onChangeText'
  >) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const Comp = multiline ? Textarea : Input;
        return (
          <FieldShell label={label} hint={hint} error={fieldState.error?.message}>
            <Comp
              value={field.value == null ? '' : String(field.value)}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={!!fieldState.error}
              className={cn(fieldState.error && 'border-destructive')}
              {...inputProps}
            />
          </FieldShell>
        );
      }}
    />
  );
}

/** Numeric input stored as number | null. */
export function NumberField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  ...inputProps
}: BaseProps<T> & Omit<ComponentProps<typeof Input>, 'value' | 'onChangeText'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell label={label} hint={hint} error={fieldState.error?.message}>
          <Input
            value={field.value == null ? '' : String(field.value)}
            onChangeText={(v) => {
              const cleaned = v.replace(/[^0-9.]/g, '');
              field.onChange(cleaned === '' ? null : Number(cleaned));
            }}
            onBlur={field.onBlur}
            keyboardType="decimal-pad"
            className={cn(fieldState.error && 'border-destructive')}
            {...inputProps}
          />
        </FieldShell>
      )}
    />
  );
}

export function SwitchField<T extends FieldValues>({ control, name, label, hint }: BaseProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <View className="flex-row items-center justify-between gap-4 py-1">
          <View className="flex-1 gap-0.5">
            {label ? <Label>{label}</Label> : null}
            {hint ? <Text className="text-muted-foreground text-sm">{hint}</Text> : null}
          </View>
          <Switch checked={!!field.value} onCheckedChange={field.onChange} />
        </View>
      )}
    />
  );
}

/** Errors that apply to the whole form (e.g. returned by the server). */
/** `solid`: opaque box for busy backgrounds (e.g. the sign-in image). */
export function FormError({ message, solid }: { message?: string | null; solid?: boolean }) {
  const text = useErrorText(message ?? undefined);
  if (!text) return null;
  return (
    <View
      className={
        solid
          ? 'border-destructive rounded-md border bg-white p-3'
          : 'border-destructive/40 bg-destructive/10 rounded-md border p-3'
      }>
      <Text className={solid ? 'text-destructive font-medium' : 'text-destructive'}>{text}</Text>
    </View>
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Hex color text input with a live swatch. */
export function ColorField<T extends FieldValues>({ control, name, label, hint }: BaseProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell label={label} hint={hint} error={fieldState.error?.message}>
          <View className="flex-row items-center gap-2">
            <View
              className="border-border size-10 rounded-md border"
              style={{
                backgroundColor: HEX.test(String(field.value ?? ''))
                  ? String(field.value)
                  : 'transparent',
              }}
            />
            <Input
              value={field.value == null ? '' : String(field.value)}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={7}
              placeholder={colors.brand}
              className={cn('flex-1', fieldState.error && 'border-destructive')}
            />
          </View>
        </FieldShell>
      )}
    />
  );
}
