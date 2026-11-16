import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../lib/utils';

const Tabs = TabsPrimitive.Root;

/**
 * Tabs styled as two variants:
 *  - "segmented": a single inset control, used for view switching.
 *  - "underline": plain text tabs with a quiet active indicator.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: 'segmented' | 'underline' }
>(({ className, variant = 'segmented', ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      variant === 'segmented' && 'inline-flex h-8 items-center gap-0.5 rounded-md border border-border bg-background/60 p-0.5',
      variant === 'underline' && 'flex h-9 items-center gap-4 border-b border-border',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { variant?: 'segmented' | 'underline' }
>(({ className, variant = 'segmented', ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50',
      variant === 'segmented' &&
        'h-7 flex-1 rounded-sm px-2.5 text-muted-foreground hover:text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground',
      variant === 'underline' &&
        'h-9 border-b border-transparent px-0.5 text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('flex-1 focus-visible:outline-none', className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
