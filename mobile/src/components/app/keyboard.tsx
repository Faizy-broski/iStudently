import { cssInterop } from 'nativewind';
import type { Ref } from 'react';
import { ScrollView as RNScrollView, type ScrollViewProps } from 'react-native';
import {
  KeyboardAvoidingView as KCKeyboardAvoidingView,
  KeyboardAwareScrollView as KCKeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';

// Keyboard handling for the whole app. Android runs edge-to-edge, so the system no longer resizes
// the screen for the keyboard (adjustResize is ignored) and React Native's own KeyboardAvoidingView
// does nothing there. Screens with inputs import ScrollView / KeyboardAvoidingView from here.

cssInterop(KCKeyboardAwareScrollView, { className: 'style', contentContainerClassName: 'contentContainerStyle' });
cssInterop(KCKeyboardAvoidingView, { className: 'style' });

type Props = ScrollViewProps & Pick<KeyboardAwareScrollViewProps, 'bottomOffset' | 'disableScrollOnKeyboardHide'> & { ref?: Ref<RNScrollView> };

/**
 * Drop-in ScrollView that keeps the focused input above the keyboard (Android and iOS).
 * Horizontal scrollers (chip rows, tables) stay plain ScrollViews.
 */
export function ScrollView({ horizontal, bottomOffset = 24, keyboardShouldPersistTaps = 'handled', ref, ...props }: Props) {
  if (horizontal) return <RNScrollView ref={ref} horizontal keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props} />;
  return <KCKeyboardAwareScrollView ref={ref as never} bottomOffset={bottomOffset} keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props} />;
}

/** KeyboardAvoidingView that also works on Android edge-to-edge. Default behavior: padding. */
export function KeyboardAvoidingView({ behavior = 'padding', ...props }: React.ComponentProps<typeof KCKeyboardAvoidingView>) {
  return <KCKeyboardAvoidingView behavior={behavior} {...props} />;
}
