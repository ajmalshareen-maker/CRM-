import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useToast } from '../lib/store';
import { cn } from '../lib/utils';

export function Toasts() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => {
        const meta = {
          success: { Icon: CheckCircle2, cls: 'border-success/30', icon: 'text-success' },
          error: { Icon: AlertCircle, cls: 'border-danger/30', icon: 'text-danger' },
          warning: { Icon: TriangleAlert, cls: 'border-warning/35', icon: 'text-warning' },
          info: { Icon: Info, cls: 'border-info/30', icon: 'text-info' },
        }[t.tone];
        return (
          <div key={t.id} className={cn('pointer-events-auto flex gap-2.5 rounded-xl border bg-surface p-3 shadow-lift rf-animate-slide', meta.cls)}>
            <meta.Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.icon)} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-ink">{t.title}</div>
              {t.description && <div className="mt-0.5 text-[11.5px] leading-snug text-muted">{t.description}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} className="shrink-0 rounded p-0.5 text-faint transition hover:text-ink"><X className="h-3.5 w-3.5" /></button>
          </div>
        );
      })}
    </div>
  );
}
