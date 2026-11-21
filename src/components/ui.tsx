import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Loader2, Search, X, AlertCircle, Info, CheckCircle2, TriangleAlert } from 'lucide-react';
import { cn, initials, toneClasses } from '../lib/utils';

/* ------------------------------- Button ------------------------------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'navy' | 'soft' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
};
export function Button({ variant = 'secondary', size = 'md', loading, icon, iconRight, className, children, disabled, ...rest }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all duration-150 select-none disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';
  const variants = {
    primary: 'bg-teal text-white hover:bg-[#1aa595] shadow-[0_1px_2px_rgba(20,45,70,0.12)] active:scale-[0.985]',
    navy: 'bg-navy text-white hover:bg-navy-soft active:scale-[0.985] dark:bg-teal dark:hover:bg-[#1aa595]',
    secondary: 'bg-surface text-ink border border-line hover:bg-surface2 hover:border-line-strong active:scale-[0.985]',
    soft: 'bg-teal/10 text-teal hover:bg-teal/16',
    ghost: 'text-muted hover:text-ink hover:bg-surface2',
    danger: 'bg-danger text-white hover:bg-[#d34a54] active:scale-[0.985]',
    link: 'text-teal hover:underline underline-offset-2 px-0',
  };
  const sizes = { xs: 'h-7 px-2 text-[11.5px]', sm: 'h-8 px-2.5 text-[12.5px]', md: 'h-9 px-3.5 text-[13px]', lg: 'h-11 px-5 text-sm' };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
      {iconRight}
    </button>
  );
}

/* ------------------------------- Badge ------------------------------- */
export function Badge({ children, tone = 'slate', className, dot }: { children: React.ReactNode; tone?: keyof typeof toneClasses; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset capitalize', toneClasses[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ------------------------------- Avatar ------------------------------- */
export function Avatar({ name = '', color = '#21B8A6', size = 'md', status, className, src }: { name?: string; color?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; status?: string; className?: string; src?: string }) {
  const sizes = { xs: 'h-6 w-6 text-[9.5px]', sm: 'h-8 w-8 text-[11px]', md: 'h-9 w-9 text-[12px]', lg: 'h-11 w-11 text-sm', xl: 'h-16 w-16 text-lg' };
  const statusColor = status === 'online' ? 'bg-success' : status === 'away' ? 'bg-warning' : 'bg-faint';
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-black/5', sizes[size], className)}
      style={{ background: src ? undefined : `linear-gradient(135deg, ${color}, ${shade(color, -16)})` }}>
      {src ? <img src={src} alt={name} className="h-full w-full rounded-full object-cover" /> : initials(name)}
      {status && <span className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface', statusColor)} />}
    </span>
  );
}
function shade(hex: string, amt: number) {
  const c = hex.replace('#', '');
  const num = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/* ------------------------------- Inputs ------------------------------- */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={cn('h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-faint outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15 disabled:bg-surface2', className)} {...rest} />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...rest }, ref) => (
    <textarea ref={ref} className={cn('w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink placeholder:text-faint outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15 resize-none', className)} {...rest} />
  ),
);
Textarea.displayName = 'Textarea';

export function Select({ value, onChange, options, className, placeholder, size = 'md', disabled }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  className?: string; placeholder?: string; size?: 'sm' | 'md'; disabled?: boolean;
}) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn('w-full appearance-none rounded-lg border border-line bg-surface pl-3 pr-8 text-[13px] text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15 cursor-pointer disabled:opacity-60',
          size === 'sm' ? 'h-8 text-[12.5px]' : 'h-9')}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; description?: string; disabled?: boolean }) {
  return (
    <label className={cn('flex items-start gap-3', disabled ? 'opacity-60' : 'cursor-pointer')}>
      <button
        type="button" role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-teal' : 'bg-line-strong')}
      >
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-[13px] font-medium text-ink">{label}</span>}
          {description && <span className="mt-0.5 block text-[12px] leading-snug text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function Checkbox({ checked, onChange, className }: { checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <button
      type="button" role="checkbox" aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={cn('flex h-4 w-4 items-center justify-center rounded border transition', checked ? 'border-teal bg-teal text-white' : 'border-line-strong bg-surface hover:border-teal', className)}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className, autoFocus, onClear }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean; onClear?: () => void }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
      <input
        value={value} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-8 text-[13px] text-ink placeholder:text-faint outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15"
      />
      {value && (
        <button onClick={() => { onChange(''); onClear?.(); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:bg-surface2 hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------- Card ------------------------------- */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rf-card', className)} {...rest}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, icon, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-line px-4 py-3', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface3 text-navy dark:text-teal">{icon}</span>}
        <div className="min-w-0">
          <h3 className="truncate text-[13.5px] font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 truncate text-[11.5px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------- Modal ------------------------------- */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', icon }: {
  open: boolean; onClose: () => void; title: string; description?: string;
  children?: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; icon?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-navy/45 backdrop-blur-[2px] rf-animate-in" onClick={onClose} />
      <div className={cn('relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-lift rf-animate-pop sm:rounded-2xl', sizes[size])}>
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          {icon && <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal/10 text-teal">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-faint transition hover:bg-surface2 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="rf-scroll flex-1 px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface2/50 px-5 py-3">{footer}</div>}
      </div>
    </div>, document.body,
  );
}

/* ------------------------------- Dropdown ------------------------------- */
export function Dropdown({ trigger, children, align = 'right', className, width = 'w-56' }: { trigger: React.ReactNode; children: React.ReactNode | ((close: () => void) => React.ReactNode); align?: 'left' | 'right'; className?: string; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className={cn('relative', className)} ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div role="menu" className={cn('absolute z-50 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lift rf-animate-pop', width, align === 'right' ? 'right-0' : 'left-0')}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ children, onClick, icon, danger, active, shortcut, disabled }: { children: React.ReactNode; onClick?: () => void; icon?: React.ReactNode; danger?: boolean; active?: boolean; shortcut?: string; disabled?: boolean }) {
  return (
    <button
      role="menuitem" onClick={onClick} disabled={disabled}
      className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition disabled:opacity-40',
        danger ? 'text-danger hover:bg-danger/10' : 'text-ink hover:bg-surface2', active && 'bg-surface2 font-medium')}
    >
      {icon && <span className="shrink-0 text-muted">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <span className="text-[10.5px] text-faint">{shortcut}</span>}
      {active && <Check className="h-3.5 w-3.5 text-teal" />}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-faint">{children}</div>;
}

export function MenuDivider() { return <div className="my-1 h-px bg-line" />; }

/* ------------------------------- Tabs ------------------------------- */
export function Tabs({ tabs, value, onChange, className }: { tabs: { value: string; label: string; count?: number; icon?: React.ReactNode }[]; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto rf-no-scrollbar', className)}>
      {tabs.map((t) => (
        <button
          key={t.value} onClick={() => onChange(t.value)}
          className={cn('relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition',
            value === t.value ? 'bg-navy text-white dark:bg-teal' : 'text-muted hover:bg-surface2 hover:text-ink')}
        >
          {t.icon}{t.label}
          {t.count != null && (
            <span className={cn('rounded px-1 text-[10.5px] font-semibold', value === t.value ? 'bg-white/20' : 'bg-surface2 text-muted')}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- Empty state ------------------------------- */
export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface3 text-navy/70 dark:text-teal/80">{icon}</div>}
      <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------- Skeleton ------------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('rf-shimmer rounded-md', className)} />;
}
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2 py-0.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- Progress ------------------------------- */
export function Progress({ value, tone = 'teal', className }: { value: number; tone?: 'teal' | 'amber' | 'red' | 'blue' | 'green'; className?: string }) {
  const colors = { teal: 'bg-teal', amber: 'bg-warning', red: 'bg-danger', blue: 'bg-info', green: 'bg-success' };
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface2', className)}>
      <div className={cn('h-full rounded-full transition-all duration-500', colors[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/* ------------------------------- Tooltip ------------------------------- */
export function Tooltip({ label, children, side = 'top' }: { label: string; children: React.ReactNode; side?: 'top' | 'bottom' | 'right' }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span className={cn('pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-navy px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lift transition group-hover/tt:opacity-100',
        side === 'top' && 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
        side === 'bottom' && 'left-1/2 top-full mt-1.5 -translate-x-1/2',
        side === 'right' && 'left-full top-1/2 ml-2 -translate-y-1/2')}>
        {label}
      </span>
    </span>
  );
}

/* ------------------------------- Toast list ------------------------------- */
export function Alert({ tone = 'info', title, children, className }: { tone?: 'info' | 'warning' | 'error' | 'success'; title?: string; children?: React.ReactNode; className?: string }) {
  const map = {
    info: { cls: 'border-info/25 bg-info/8 text-info', Icon: Info },
    warning: { cls: 'border-warning/30 bg-warning/10 text-warning', Icon: TriangleAlert },
    error: { cls: 'border-danger/30 bg-danger/8 text-danger', Icon: AlertCircle },
    success: { cls: 'border-success/30 bg-success/8 text-success', Icon: CheckCircle2 },
  }[tone];
  return (
    <div className={cn('flex gap-2.5 rounded-xl border px-3 py-2.5', map.cls, className)}>
      <map.Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed">
        {title && <div className="font-semibold">{title}</div>}
        <div className={cn(title && 'mt-0.5', 'text-ink/80 dark:text-ink/75')}>{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------- Section ------------------------------- */
export function PageHeader({ title, description, actions, badge, children }: { title: string; description?: string; actions?: React.ReactNode; badge?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line bg-surface/60 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-lg font-semibold tracking-tight text-ink">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) { return <div className={cn('h-px w-full bg-line', className)} />; }

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn('rounded border border-line bg-surface2 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted', className)}>{children}</kbd>;
}
