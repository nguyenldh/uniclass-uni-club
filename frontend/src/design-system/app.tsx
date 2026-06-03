/* ============================================================
   App UI Components — SF Pro Display, clean style (TypeScript)
   ============================================================ */
import React, {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type HTMLAttributes,
  type ChangeEvent,
  type ReactNode,
} from 'react';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

/* ============================================================
   Button
   ============================================================ */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'disabled';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, className)}
      disabled={variant === 'disabled' || rest.disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ============================================================
   Input + Field
   ============================================================ */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error = false, className, ...rest }: InputProps) {
  return <input className={cn('input', error && 'error', className)} {...rest} />;
}

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {error ? <span className="err">{error}</span>
             : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

/* ============================================================
   Checkbox row
   ============================================================ */
export interface CheckboxRowProps {
  id: string;
  checked?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  children: ReactNode;
}

export function CheckboxRow({ id, checked, onChange, children }: CheckboxRowProps) {
  return (
    <div className="checkbox-row">
      <input type="checkbox" id={id} checked={checked} onChange={onChange} />
      <label htmlFor={id}>{children}</label>
    </div>
  );
}

/* ============================================================
   Tabs
   ============================================================ */
export interface TabItem<T extends string = string> {
  value: T;
  label: ReactNode;
}

export interface TabsProps<T extends string = string> {
  items: ReadonlyArray<TabItem<T> | T>;
  active: T;
  onChange?: (value: T) => void;
}

export function Tabs<T extends string = string>({ items, active, onChange }: TabsProps<T>) {
  return (
    <div className="tabs">
      {items.map((it) => {
        const value = (typeof it === 'string' ? it : it.value) as T;
        const label = typeof it === 'string' ? it : it.label;
        return (
          <span
            key={value}
            className={cn('tab', value === active && 'active')}
            onClick={() => onChange?.(value)}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

/* ============================================================
   Badge
   ============================================================ */
export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', dot = false, children }: BadgeProps) {
  const dotClass: Record<string, string> = { success: 's', warning: 'w', danger: 'd', info: 'i' };
  const dotKey = dotClass[tone];
  return (
    <span className={cn('badge', tone)}>
      {dot && dotKey && <span className={cn('dot', dotKey)} />}
      {children}
    </span>
  );
}

/* ============================================================
   Card
   ============================================================ */
export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  badge?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
}

export function Card({ badge, title, children, className, ...rest }: CardProps) {
  return (
    <div className={cn('app-card', className)} {...rest}>
      {badge && <div style={{ marginBottom: 10 }}>{badge}</div>}
      {title && <h4>{title}</h4>}
      {children && <p>{children}</p>}
    </div>
  );
}

/* ============================================================
   AppList (rows with avatar + meta + trailing)
   ============================================================ */
export function AppList({ children }: { children: ReactNode }) {
  return <div className="app-list">{children}</div>;
}

export interface AppListItemProps {
  avatar: ReactNode;
  name: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  avatarBg?: string;
}

export function AppListItem({ avatar, name, sub, trailing, avatarBg }: AppListItemProps) {
  return (
    <div className="item">
      <div className="avatar" style={avatarBg ? { background: avatarBg } : undefined}>{avatar}</div>
      <div className="t">
        <div className="n">{name}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
      {trailing}
    </div>
  );
}

/* ============================================================
   Avatar
   ============================================================ */
export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  background?: string;
  children: ReactNode;
}

export function Avatar({ children, background, className, ...rest }: AvatarProps) {
  return (
    <div
      className={cn('avatar', className)}
      style={background ? { background } : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ============================================================
   Toast
   ============================================================ */
export type ToastTone = 'success' | 'warning';

export interface ToastProps {
  tone?: ToastTone;
  icon?: ReactNode;
  children: ReactNode;
}

export function Toast({ tone = 'success', children, icon }: ToastProps) {
  const baseStyle: React.CSSProperties = tone === 'success'
    ? { background: '#101418', color: '#fff' }
    : {
        background: '#fff', color: 'var(--ink-900)',
        border: '1px solid var(--ink-100)',
        boxShadow: 'var(--sh-2)',
      };
  const defaultIcon = tone === 'success' ? (
    <svg viewBox="0 0 24 24" className="ico" fill="none">
      <circle cx="12" cy="12" r="10" fill="#2bb673" />
      <path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="ico" fill="none">
      <circle cx="12" cy="12" r="10" fill="#f5a623" />
      <path d="M12 7v6M12 16v.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
  return (
    <div className="toast" style={baseStyle}>
      {icon ?? defaultIcon}
      {children}
    </div>
  );
}

/* ============================================================
   Modal (presentational — caller controls visibility)
   ============================================================ */
export interface ModalProps {
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** Wrap with a dark overlay shell (default true). */
  withShell?: boolean;
}

export function Modal({ title, children, actions, withShell = true }: ModalProps) {
  const modal = (
    <div className="modal">
      {title && <h4>{title}</h4>}
      {children && <p>{children}</p>}
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
  return withShell ? <div className="modal-shell">{modal}</div> : modal;
}
