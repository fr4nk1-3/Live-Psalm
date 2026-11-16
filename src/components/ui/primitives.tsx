import * as React from 'react';
import { cn } from '../../lib/utils';

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-background px-1 font-sans text-[10px] font-medium text-muted-foreground',
        className
      )}
    >
      {children}
    </kbd>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-[36ch] text-2xs leading-relaxed text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** Section header used inside scrollable panel bodies. */
export function ListHeader({
  children,
  action,
  className
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-2 px-1', className)}>
      <span className="text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground">{children}</span>
      {action}
    </div>
  );
}
