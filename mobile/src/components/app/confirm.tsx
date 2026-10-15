import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** Require typing this exact text first (for irreversible actions, e.g. a school's name). */
  typeToConfirm?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** `const confirm = useConfirm(); if (await confirm({ title, destructive: true })) ...` */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setTyped('');
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  };

  const blocked = !!options?.typeToConfirm && typed.trim() !== options.typeToConfirm.trim();

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!options} onOpenChange={(open) => !open && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            {options?.body ? <AlertDialogDescription>{options.body}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          {options?.typeToConfirm ? (
            <View className="gap-2">
              <Text className="text-muted-foreground text-sm">
                {t('app.type_to_confirm', { text: options.typeToConfirm })}
              </Text>
              <Input value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} />
            </View>
          ) : null}
          <AlertDialogFooter>
            {/* Plain Buttons: the dialog is controlled, and AlertDialogAction's className also styles its text. */}
            <Button variant="outline" onPress={() => close(false)}>
              <Text>{t('common.cancel')}</Text>
            </Button>
            <Button
              variant={options?.destructive ? 'destructive' : 'default'}
              disabled={blocked}
              onPress={() => close(true)}
              accessibilityState={{ disabled: blocked }}>
              <Text>{options?.confirmLabel ?? t('app.confirm')}</Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
