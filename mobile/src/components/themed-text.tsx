import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { colors } from '@/lib/colors';
import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'IBMPlexSansArabic_500Medium',
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'IBMPlexSansArabic_700Bold',
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'IBMPlexSansArabic_500Medium',
  },
  title: {
    fontSize: 48,
    fontFamily: 'IBMPlexSansArabic_600SemiBold',
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontFamily: 'IBMPlexSansArabic_600SemiBold',
  },
  link: {
    fontFamily: 'IBMPlexSansArabic_400Regular',
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: 'IBMPlexSansArabic_400Regular',
    lineHeight: 30,
    fontSize: 14,
    color: colors.brandSecondary,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
