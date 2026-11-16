import * as React from 'react';
import { cn } from '../../lib/utils';
import { Label } from './label';

/**
 * A labelled control row. The label sits above the control at 11px muted;
 * optional hint text explains the consequence in plain language.
 */
export function Field({
  label,
  htmlFor,
  hint,
  action,
  className,
  children
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {action}
      </div>
      {children}
      {hint ? <p className="text-2xs leading-relaxed text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

/** A titled group of fields inside panels and dialogs. */
export function FieldGroup({
  title,
  description,
  children,
  className
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      {(title || description) && (
        <div className="space-y-0.5">
          {title ? <h3 className="text-xs font-medium text-foreground">{title}</h3> : null}
          {description ? <p className="text-2xs leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function Hint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-2xs leading-relaxed text-muted-foreground', className)}>{children}</p>;
}
