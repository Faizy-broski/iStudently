import { isValidElement, type ComponentType, type ReactElement, type Ref } from 'react';
import {
  FlatList as RNFlatList,
  SectionList as RNSectionList,
  View,
  type DefaultSectionT,
  type FlatListProps,
  type SectionListProps,
} from 'react-native';

import { useBottomGap } from '@/components/app/keyboard';

type Footer = ComponentType<unknown> | ReactElement | null | undefined;

function footerWithGap(footer: Footer, gap: number) {
  const el = isValidElement(footer) ? footer : footer ? (() => { const F = footer as ComponentType; return <F />; })() : null;
  if (gap <= 0) return el;
  return (
    <>
      {el}
      <View style={{ height: gap }} />
    </>
  );
}

/** FlatList whose end clears the system navigation bar (see useBottomGap). */
export function FlatList<T>({ ListFooterComponent, onLayout, ref, horizontal, ...props }: FlatListProps<T> & { ref?: Ref<RNFlatList<T>> }) {
  const [gap, handleLayout] = useBottomGap(onLayout);
  return (
    <RNFlatList
      ref={ref}
      onLayout={handleLayout}
      horizontal={horizontal}
      ListFooterComponent={footerWithGap(ListFooterComponent as Footer, horizontal ? 0 : gap)}
      {...props}
    />
  );
}

/** SectionList whose end clears the system navigation bar (see useBottomGap). */
export function SectionList<T, S = DefaultSectionT>({ ListFooterComponent, onLayout, ref, ...props }: SectionListProps<T, S> & { ref?: Ref<RNSectionList<T, S>> }) {
  const [gap, handleLayout] = useBottomGap(onLayout);
  return <RNSectionList ref={ref} onLayout={handleLayout} ListFooterComponent={footerWithGap(ListFooterComponent as Footer, gap)} {...props} />;
}
