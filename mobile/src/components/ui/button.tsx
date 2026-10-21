import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { BrandGradient } from '@/components/app/brand-gradient';

const buttonVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-2 overflow-hidden rounded-full',
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    }),
  ),
  {
    variants: {
      variant: {
        // Brand gradient pill (Figma); the gradient is drawn by <Button> unless a bg-* class overrides it.
        default: cn('bg-primary active:opacity-90', Platform.select({ web: 'hover:opacity-90' })),
        destructive: cn(
          'bg-destructive active:bg-destructive/90 dark:bg-destructive/60',
          Platform.select({
            web: 'hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
          }),
        ),
        outline: cn(
          'border-border bg-background active:bg-accent dark:bg-input/30 dark:border-input dark:active:bg-input/50 border',
          Platform.select({
            web: 'hover:bg-accent dark:hover:bg-input/50',
          }),
        ),
        secondary: cn(
          'bg-secondary active:bg-secondary/80',
          Platform.select({ web: 'hover:bg-secondary/80' }),
        ),
        ghost: cn(
          'active:bg-accent dark:active:bg-accent/50',
          Platform.select({ web: 'hover:bg-accent dark:hover:bg-accent/50' }),
        ),
        link: '',
      },
      size: {
        default: cn('h-11 px-5 py-2', Platform.select({ web: 'has-[>svg]:px-4' })),
        sm: cn('h-9 gap-1.5 px-3.5', Platform.select({ web: 'has-[>svg]:px-2.5' })),
        lg: cn('h-12 px-6', Platform.select({ web: 'has-[>svg]:px-4' })),
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const buttonTextVariants = cva(
  cn(
    'text-foreground text-sm font-medium',
    Platform.select({ web: 'pointer-events-none transition-colors' }),
  ),
  {
    variants: {
      variant: {
        default: 'text-primary-foreground font-semibold',
        destructive: 'text-white',
        outline: cn(
          'group-active:text-accent-foreground',
          Platform.select({ web: 'group-hover:text-accent-foreground' }),
        ),
        secondary: 'text-secondary-foreground',
        ghost: 'group-active:text-accent-foreground',
        link: cn(
          'text-primary group-active:underline',
          Platform.select({ web: 'underline-offset-4 hover:underline group-hover:underline' }),
        ),
      },
      size: {
        default: '',
        sm: '',
        lg: '',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = React.ComponentProps<typeof Pressable> &
  React.RefAttributes<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, children, ...props }: ButtonProps) {
  // Default buttons use the brand gradient, unless the screen sets its own background.
  const gradient =
    (variant ?? 'default') === 'default' &&
    !/(^|\s)bg-/.test(className ?? '') &&
    typeof children !== 'function';
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable
        className={cn(props.disabled && 'opacity-50', buttonVariants({ variant, size }), className)}
        role="button"
        {...props}>
        {gradient ? (
          <>
            <BrandGradient
              variant="primary"
              angle={90}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {children as React.ReactNode}
          </>
        ) : (
          children
        )}
      </Pressable>
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
