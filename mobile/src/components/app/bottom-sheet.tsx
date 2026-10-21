import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoidingView } from '@/components/app/keyboard';
import { Text } from '@/components/ui/text';

/** Bottom sheet (Figma): dimmed backdrop, rounded top card with a grab handle and a title. Tap outside to close. */
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView className="flex-1">
        <Pressable className="flex-1 bg-black/40" onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <View className="bg-background max-h-[85%] rounded-t-3xl px-4 pt-2.5" style={{ paddingBottom: insets.bottom + 12 }}>
          <View className="bg-border mb-3 h-1.5 w-12 self-center rounded-full" />
          {title ? <Text className="text-brand dark:text-foreground mb-3 text-xl font-bold">{title}</Text> : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
