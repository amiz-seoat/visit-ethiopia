import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { getErrorMessage } from '../../../services/api';

/** Load data on mount and whenever `deps` change; exposes reload(). */
export function useAdminData<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await run());
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [run]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, loading, error, reload, setData };
}

export function PanelHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Notice({ kind, children }: { kind: 'error' | 'success' | 'info'; children: ReactNode }) {
  const cls = {
    error: 'text-red-700 bg-red-50 border-red-200',
    success: 'text-green-800 bg-green-50 border-green-200',
    info: 'text-gray-700 bg-gray-50 border-gray-200',
  }[kind];
  return <div className={`mb-4 text-sm border rounded-md px-3 py-2 ${cls}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-50 text-green-800 ring-green-200',
  completed: 'bg-green-50 text-green-800 ring-green-200',
  approved: 'bg-green-50 text-green-800 ring-green-200',
  active: 'bg-green-50 text-green-800 ring-green-200',
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  payment_pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  processing: 'bg-amber-50 text-amber-800 ring-amber-200',
  flagged: 'bg-orange-50 text-orange-800 ring-orange-300',
  partially_refunded: 'bg-blue-50 text-blue-800 ring-blue-200',
  refunded: 'bg-blue-50 text-blue-800 ring-blue-200',
  cancelled: 'bg-gray-100 text-gray-700 ring-gray-200',
  expired: 'bg-gray-100 text-gray-700 ring-gray-200',
  suspended: 'bg-red-50 text-red-800 ring-red-200',
  failed: 'bg-red-50 text-red-800 ring-red-200',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] || 'bg-gray-100 text-gray-700 ring-gray-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function Pager({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return <p className="mt-3 text-xs text-gray-500">{total} result{total === 1 ? '' : 's'}</p>;
  return (
    <div className="mt-3 flex items-center justify-between text-sm">
      <span className="text-gray-500">
        {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </span>
      <div className="flex gap-2">
        <button className="px-3 py-1 border rounded-md disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button className="px-3 py-1 border rounded-md disabled:opacity-40" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export const inputCls = 'border border-gray-300 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500';

export const fmtDate = (d?: string | null, withTime = false) =>
  d
    ? new Date(d).toLocaleString(undefined, withTime
        ? { dateStyle: 'medium', timeStyle: 'short' }
        : { dateStyle: 'medium' })
    : '—';

/** Debounce a fast-changing value (search boxes). */
export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
