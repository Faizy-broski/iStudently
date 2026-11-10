import { cssInterop } from 'nativewind';
import { useCallback, useState, type Ref } from 'react';
import { ScrollView as RNScrollView, View, type LayoutChangeEvent, type ScrollViewProps } from 'react-native';
import {
  KeyboardAvoidingView as KCKeyboardAvoidingView,
  KeyboardAwareScrollView as KCKeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';

// Keyboard handling for the whole app. Android runs edge-to-edge, so the system no longer resizes
// the screen for the keyboard (adjustResize is ignored) and React Native's own KeyboardAvoidingView
// does nothing there. Screens import ScrollView / KeyboardAvoidingView from here.

cssInterop(KCKeyboardAwareScrollView, { className: 'style', contentContainerClassName: 'contentContainerStyle' });
cssInterop(KCKeyboardAvoidingView, { className: 'style' });

type Props = ScrollViewProps & Pick<KeyboardAwareScrollViewProps, 'bottomOffset' | 'disableScrollOnKeyboardHide'> & { ref?: Ref<RNScrollView> };

type Measurable = { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void };

/**
 * Space to add after a scroller's content so its end clears the system navigation bar
 * (edge-to-edge Android, iOS home indicator). It is only the part of the bottom inset the
 * scroller actually overlaps: 0 inside a bottom SafeAreaView, above a tab bar or above StickyActions.
 */
export function useBottomGap(onLayout?: (e: LayoutChangeEvent) => void) {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const [below, setBelow] = useState<number | null>(null);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      onLayout?.(e);
      (e.currentTarget as unknown as Measurable | null)?.measureInWindow?.((_x, y, _w, h) => setBelow(frame.height - (y + h)));
    },
    [onLayout, frame.height]
  );

  return [Math.max(0, Math.round(insets.bottom - (below ?? 0))), handleLayout] as const;
}

/**
 * Drop-in ScrollView that keeps the focused input above the keyboard (Android and iOS) and keeps
 * the last content (action buttons) above the system navigation bar.
 * Horizontal scrollers (chip rows, tables) stay plain ScrollViews.
 */
export function ScrollView({ horizontal, bottomOffset = 24, keyboardShouldPersistTaps = 'handled', ref, onLayout, children, ...props }: Props) {
  const [gap, handleLayout] = useBottomGap(onLayout);
  if (horizontal)
    return (
      <RNScrollView ref={ref} horizontal keyboardShouldPersistTaps={keyboardShouldPersistTaps} onLayout={onLayout} {...props}>
        {children}
      </RNScrollView>
    );
  return (
    <KCKeyboardAwareScrollView ref={ref as never} onLayout={handleLayout} bottomOffset={bottomOffset} keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
      {children}
      {gap > 0 ? <View style={{ height: gap }} /> : null}
    </KCKeyboardAwareScrollView>
  );
}

/** KeyboardAvoidingView that also works on Android edge-to-edge. Default behavior: padding. */
export function KeyboardAvoidingView({ behavior = 'padding', ...props }: React.ComponentProps<typeof KCKeyboardAvoidingView>) {
  return <KCKeyboardAvoidingView behavior={behavior} {...props} />;
}
