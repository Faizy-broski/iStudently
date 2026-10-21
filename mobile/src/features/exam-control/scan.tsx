import { qrPrecheck, type JcQrKindCode } from '@studently/shared-utils';
import { Camera, ScanLine } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, type TextInput, View } from 'react-native';

import { BarcodeScanDialog } from '@/components/app/barcode-scan';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type ScanOutcome = { ok: boolean; message?: string };

const KNOWN = ['format', 'prefix', 'kind', 'length', 'check', 'signature', 'session', 'unknown_secret', 'unknown_seat', 'not_today'];

/** Message for a scan error code (local pre-check or server). */
export function useScanError() {
  const { t } = useTranslation();
  return (code: string | undefined, fallback?: string) => {
    const k = (code ?? '').replace(/^scan_/, '');
    return KNOWN.includes(k) ? t(`examControl.scanErr_${k}`) : (fallback ?? t('examControl.scanErr_format'));
  };
}

/**
 * Scan field (brief C7.4): Bluetooth/USB 2D scanners type the code and Enter into the focused field;
 * the camera button scans with the phone. Codes are pre-checked here (prefix, kind, length, check digit)
 * so partial input never reaches the server; the server checks the session and the signature.
 * With `onPlain`, a short number typed by hand (a secret or seat) is accepted too.
 */
export function ScanField({
  expect,
  onScan,
  onPlain,
  placeholder,
  camera = true,
  inputRef,
}: {
  expect: JcQrKindCode;
  onScan: (digits: string) => Promise<ScanOutcome>;
  onPlain?: (digits: string) => Promise<ScanOutcome> | ScanOutcome;
  placeholder?: string;
  camera?: boolean;
  inputRef?: React.RefObject<TextInput | null>;
}) {
  const { t } = useTranslation();
  const err = useScanError();
  const own = useRef<TextInput>(null);
  const ref = inputRef ?? own;
  const [value, setValue] = useState('');
  const [flash, setFlash] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cam, setCam] = useState(false);

  const submit = async (raw: string) => {
    const digits = raw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
    setValue('');
    if (!digits) return;
    setBusy(true);
    try {
      let out: ScanOutcome;
      if (onPlain && digits.length < 13) out = await onPlain(digits);
      else {
        const pre = qrPrecheck(digits, expect);
        out = pre.ok ? await onScan(pre.digits) : { ok: false, message: err(pre.reason) };
      }
      setFlash({ ok: out.ok, message: out.message ?? (out.ok ? t('examControl.scanOk') : t('examControl.scanErr_format')) });
    } finally {
      setBusy(false);
      ref.current?.focus();
    }
  };

  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center">
          <Icon as={ScanLine} className="text-muted-foreground absolute start-3 z-10 size-4" />
          <Input
            ref={ref}
            className={cn('flex-1 ps-9 font-mono', flash && (flash.ok ? 'border-success bg-success/10' : 'border-destructive bg-destructive/10'))}
            keyboardType="number-pad"
            autoCorrect={false}
            placeholder={placeholder ?? t('examControl.scanHint')}
            value={value}
            editable={!busy}
            onChangeText={setValue}
            onSubmitEditing={() => void submit(value)}
            submitBehavior="submit"
            returnKeyType="go"
          />
        </View>
        {camera ? (
          <Pressable onPress={() => setCam(true)} accessibilityRole="button" accessibilityLabel={t('examControl.scanCamera')} className="border-border rounded-xl border p-2.5">
            <Icon as={Camera} className="text-foreground size-5" />
          </Pressable>
        ) : null}
      </View>
      {flash ? <Text className={cn('text-xs font-medium', flash.ok ? 'text-success' : 'text-destructive')}>{flash.message}</Text> : null}
      {camera ? <BarcodeScanDialog open={cam} onOpenChange={setCam} onScan={(code) => void submit(code)} title={t('examControl.scanCamera')} /> : null}
    </View>
  );
}
