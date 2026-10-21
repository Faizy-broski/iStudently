import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Platform, View } from 'react-native';

const badgeVariants = cva(
  cn(
    'border-transparent group shrink-0 flex-row items-center justify-center gap-1 overflow-hidden rounded-full border px-2.5 py-0.5',
    Platform.select({
      web: 'focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive w-fit whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3',
    })
  ),
  {
    variants: {
      variant: {
        default: cn(
          'bg-info-soft border-transparent',
          Platform.select({ web: '[a&]:hover:bg-primary/90' })
        ),
        secondary: cn(
          'bg-muted border-transparent',
          Platform.select({ web: '[a&]:hover:bg-secondary/90' })
        ),
        destructive: cn(
          'bg-destructive-soft border-transparent',
          Platform.select({ web: '[a&]:hover:bg-destructive/90' })
        ),
        outline: cn('border-info-soft dark:border-border bg-card', Platform.select({ web: '[a&]:hover:bg-accent [a&]:hover:text-accent-foreground' })),
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const badgeTextVariants = cva('text-[11px] font-semibold', {
  variants: {
    variant: {
      default: 'text-brand dark:text-brand-secondary',
      secondary: 'text-muted-foreground',
      destructive: 'text-destructive',
      outline: 'text-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

type BadgeProps = React.ComponentProps<typeof View> & React.RefAttributes<View> & {
  asChild?: boolean;
} & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, asChild, ...props }: BadgeProps) {
  const Component = asChild ? Slot : View;
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <Component className={cn(badgeVariants({ variant }), className)} {...props} />
    </TextClassContext.Provider>
  );
}

export { Badge, badgeTextVariants, badgeVariants };
export type { BadgeProps };
