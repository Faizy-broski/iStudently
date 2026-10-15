import { CheckCircle2, CircleAlert, Info } from 'lucide-react-native';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

const ToastContext = createContext<((type: ToastType, message: string) => void) | null>(null);

/** `const toast = useToast(); toast.success('Saved')` */
export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside ToastProvider');
  return {
    success: (m: string) => show('success', m),
    error: (m: string) => show('error', m),
    info: (m: string) => show('info', m),
  };
}

const ICONS = { success: CheckCircle2, error: CircleAlert, info: Info } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const insets = useSafeAreaInsets();

  const show = useCallback((type: ToastType, message: string) => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-2), { id, type, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), type === 'error' ? 5000 : 3000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <View pointerEvents="box-none" className="absolute inset-x-0 top-0 gap-2 px-4" style={{ paddingTop: insets.top + 8 }}>
        {items.map((t) => (
          <Animated.View
            key={t.id}
            entering={FadeInUp}
            exiting={FadeOutUp}
            accessibilityLiveRegion="polite"
            className={cn(
              'bg-card border-border flex-row items-center gap-3 rounded-lg border px-4 py-3 shadow-lg shadow-black/10',
              t.type === 'error' && 'border-destructive/40',
            )}>
            <Icon
              as={ICONS[t.type]}
              className={cn(
                'size-5',
                t.type === 'success' && 'text-success',
                t.type === 'error' && 'text-destructive',
                t.type === 'info' && 'text-primary',
              )}
            />
            <Text className="flex-1">{t.message}</Text>
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}
