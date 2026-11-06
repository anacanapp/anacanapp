import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Label + control + hint/error. Pass a render function to receive the generated id,
 * or a plain node and give it `id={fieldId}` yourself via the `id` prop.
 */
export function Field({ label, hint, error, required, children, className, id: given, inline }: {
  label: ReactNode; hint?: ReactNode; error?: ReactNode; required?: boolean; className?: string; id?: string; inline?: boolean;
  children: ReactNode | ((id: string) => ReactNode);
}) {
  const auto = useId(), id = given ?? `f${auto.replace(/:/g, '')}`;
  return (
    <div className={cn('ak-field', inline && 'is-inline', error && 'has-error', className)}>
      <label htmlFor={id} className="ak-label">{label}{required && <span className="ak-required" aria-hidden> *</span>}</label>
      <div className="ak-field-control">{typeof children === 'function' ? children(id) : children}</div>
      {error ? <p className="ak-field-error" role="alert">{error}</p> : hint ? <p className="ak-hint">{hint}</p> : null}
    </div>
  );
}

/** Two/three-column responsive field grid (single column on phones). */
export function FieldGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={cn('ak-field-grid', cols === 3 && 'is-3')}>{children}</div>;
}

/** Fieldset with a small heading, used to group drawer form sections. */
export function FormSection({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="ak-form-section">
      <legend>{title}</legend>
      {description && <p className="ak-hint">{description}</p>}
      <div className="ak-form-section-body">{children}</div>
    </fieldset>
  );
}

/** Row with title/description and a control on the end (switch rows in settings). */
export function SettingRow({ title, description, control, icon }: { title: ReactNode; description?: ReactNode; control: ReactNode; icon?: ReactNode }) {
  return (
    <div className="ak-setting-row">
      {icon && <span className="ak-setting-icon" aria-hidden>{icon}</span>}
      <div className="ak-setting-text"><strong>{title}</strong>{description && <p>{description}</p>}</div>
      <div className="ak-setting-control">{control}</div>
    </div>
  );
}
