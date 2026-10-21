import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

type InputProps = React.ComponentProps<typeof TextInput> &
  React.RefAttributes<TextInput> & {
    /** Leading icon inside the field (Figma: mail, lock …). */
    icon?: LucideIcon;
  };

/**
 * Text field (Figma): rounded pill, card background, brand border while focused, optional leading icon.
 * Multi-line fields keep rounded corners instead of a pill.
 */
function Input({ className, icon, onFocus, onBlur, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  const multiline = !!props.multiline;
  const field = (
    <TextInput
      className={cn(
        'border-input bg-card text-foreground w-full min-w-0 border px-4 text-base leading-5',
        multiline ? 'min-h-24 rounded-2xl py-3' : 'h-12 rounded-full py-1',
        icon && 'ps-11',
        focused && 'border-brand-secondary',
        props.editable === false &&
          cn(
            'opacity-50',
            Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' }),
          ),
        Platform.select({
          web: cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          ),
          native: 'placeholder:text-muted-foreground/60',
        }),
        className,
      )}
      textAlignVertical={multiline ? 'top' : undefined}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      {...props}
    />
  );
  if (!icon) return field;
  return (
    <View className="w-full justify-center">
      {field}
      <View className="absolute start-4" pointerEvents="none">
        <Icon
          as={icon}
          className={cn('size-4', focused ? 'text-brand-secondary' : 'text-muted-foreground')}
        />
      </View>
    </View>
  );
}

export { Input };
