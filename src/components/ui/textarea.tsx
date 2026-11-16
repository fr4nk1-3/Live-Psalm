import * as React from 'react';
import { cn } from '../../lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[64px] w-full resize-none rounded-md border border-input bg-background/60 px-2.5 py-2 text-sm leading-relaxed text-foreground',
        'transition-colors placeholder:text-muted-foreground/70',
        'hover:border-border focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
