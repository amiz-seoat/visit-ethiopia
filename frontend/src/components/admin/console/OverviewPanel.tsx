import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatMoney, getAdminOverview, type AdminOverview } from '../../../api/adminConsole';
import { Notice, PanelHeader, inputCls, useAdminData } from './shared';
import { PageLoader } from '../../ui/PageStatus';

export type ConsoleTab =
  | 'overview' | 'bookings' | 'payments' | 'users' | 'approvals'
  | 'reviews' | 'contacts' | 'audit' | 'assistant';

const SERIES_COLOR = '#d97706'; // validated (light surface): contrast ≥ 3:1

export function OverviewPanel({ onNavigate }: { onNavigate: (tab: ConsoleTab, filter?: string) => void }) {
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useAdminData(() => getAdminOverview(days), [days]);

  return (
    <div>
      <PanelHeader
        title="Overview"
        subtitle={data ? `Last ${data.periodDays} days · updated ${new Date().toLocaleTimeString()}` : undefined}
        actions={
          <>
            <select className={inputCls} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button className="text-sm border rounded-md px-3 py-1.5 hover:bg-gray-50" onClick={reload}>Refresh</button>
          </>
        }
      />
      {error && <Notice kind="error">{error}</Notice>}
      {loading && !data ? <PageLoader message="Loading overview..." /> : data && <OverviewBody data={data} onNavigate={onNavigate} />}
    </div>
  );
}

function OverviewBody({ data, onNavigate }: { data: AdminOverview; onNavigate: (tab: ConsoleTab, filter?: string) => void }) {
  const q = data.queues;
  const queue = [
    { label: 'Flagged payments to review', value: q.flaggedPayments, tab: 'payments' as const, filter: 'flagged', urgent: true },
    { label: 'Failed refunds', value: q.failedRefunds, tab: 'payments' as const, urgent: true },
    { label: 'Provider approvals waiting', value: q.pendingApprovals, tab: 'approvals' as const },
    { label: 'Reviews to moderate', value: q.pendingReviews, tab: 'reviews' as const },
    { label: 'New contact messages', value: q.newContacts, tab: 'contacts' as const },
    { label: 'Expired holds not yet released', value: q.expiredHoldsAwaitingCleanup, tab: 'bookings' as const, filter: 'payment_pending' },
  ];
  const currencies = Object.keys({ ...data.revenue.allTimeMinor, ...data.revenue.periodMinor });
  const mainCur = currencies.includes('ETB') ? 'ETB' : currencies[0] || 'ETB';
  const confirmed = (data.bookings.byStatus.confirmed || 0) + (data.bookings.byStatus.completed || 0);

  return (
    <div className="space-y-8">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={`Net revenue (${data.periodDays}d)`} value={formatMoney(data.revenue.periodMinor[mainCur] || 0, mainCur)}
          sub={`All time ${formatMoney(data.revenue.allTimeMinor[mainCur] || 0, mainCur)}`} />
        <Kpi label={`Bookings (${data.periodDays}d)`} value={data.bookings.inPeriod.toLocaleString()}
          sub={`${data.bookings.total.toLocaleString()} total · ${confirmed} confirmed/completed`} />
        <Kpi label="Users" value={data.users.total.toLocaleString()}
          sub={`+${data.users.newInPeriod} new · ${data.users.suspended} suspended`} />
        <Kpi label={`Refunds (${data.periodDays}d)`} value={formatMoney(data.revenue.refundsInPeriod.amountMinor, 'ETB')}
          sub={`${data.revenue.refundsInPeriod.count} completed`} />
      </div>
      {currencies.filter((c) => c !== mainCur).length > 0 && (
        <p className="text-xs text-gray-500 -mt-5">
          Other currencies (period):{' '}
          {currencies.filter((c) => c !== mainCur).map((c) => formatMoney(data.revenue.periodMinor[c] || 0, c)).join(' · ')}
        </p>
      )}

      {/* Action queue */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Needs attention</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {queue.map((item) => {
            const hot = item.value > 0;
            return (
              <button key={item.label} onClick={() => onNavigate(item.tab, item.filter)}
                className={`flex items-center justify-between gap-3 text-left border rounded-lg px-3 py-2.5 hover:bg-gray-50 ${hot && item.urgent ? 'border-orange-300 bg-orange-50/40' : 'border-gray-200'}`}>
                <span className="flex items-center gap-2 text-sm text-gray-700">
                  {hot ? <AlertTriangle size={15} className={item.urgent ? 'text-orange-600' : 'text-amber-600'} aria-hidden />
                    : <CheckCircle2 size={15} className="text-green-600" aria-hidden />}
                  {item.label}
                </span>
                <span className="text-lg font-semibold tabular-nums text-gray-900">{item.value}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Trends: two single-series charts (never a dual axis) */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ColumnChart title="Bookings per day" series={data.series.map((s) => ({ x: s.date, y: s.bookings }))} format={(v) => v.toLocaleString()} />
        <ColumnChart title="Net revenue per day (ETB)" series={data.series.map((s) => ({ x: s.date, y: s.revenueMinorEtb / 100 }))}
          format={(v) => `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} ETB`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <BarList title="Bookings by status (all time)" rows={data.bookings.byStatus} />
        <BarList title="Bookings by type (all time)" rows={data.bookings.byType} />
        <BarList title="Users by role" rows={data.users.byRole} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Top listings ({data.periodDays}d, confirmed bookings)</h3>
          {data.topListings.length ? (
            <ol className="divide-y border rounded-lg">
              {data.topListings.map((t, i) => (
                <li key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-gray-700"><span className="text-gray-400 mr-2 tabular-nums">{i + 1}.</span>{t.title}
                    <span className="ml-2 text-xs text-gray-500 capitalize">{t.type}</span></span>
                  <span className="font-medium tabular-nums">{t.bookings}</span>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-gray-500">No confirmed bookings in this period.</p>}
        </section>
        <section className="grid grid-cols-2 gap-6">
          <BarList title="Paid payments by provider" rows={data.revenue.paymentsByProvider} />
          <BarList title="Providers by approval" rows={data.providers.byApprovalStatus} />
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function BarList({ title, rows }: { title: string; rows: Record<string, number> }) {
  const entries = Object.entries(rows).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
      {entries.length ? (
        <ul className="space-y-1.5">
          {entries.map(([k, v]) => (
            <li key={k} className="text-sm" title={`${k.replace(/_/g, ' ')}: ${v}`}>
              <div className="flex justify-between text-gray-700"><span className="capitalize">{k.replace(/_/g, ' ')}</span><span className="tabular-nums">{v}</span></div>
              <div className="h-1.5 bg-gray-100 rounded-full mt-0.5">
                <div className="h-1.5 rounded-full" style={{ width: `${(v / max) * 100}%`, background: SERIES_COLOR }} />
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-gray-500">No data.</p>}
    </section>
  );
}

/** Single-series column chart: thin bars, hairline grid, hover tooltip, table fallback. */
function ColumnChart({ title, series, format }: { title: string; series: { x: string; y: number }[]; format: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const W = 560, H = 200, padL = 44, padB = 22, padT = 10;
  const max = Math.max(...series.map((s) => s.y), 0);
  const ticks = useMemo(() => niceTicks(max), [max]);
  const top = ticks[ticks.length - 1] || 1;
  const band = (W - padL) / Math.max(1, series.length);
  const bw = Math.min(24, Math.max(2, band - 2));
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / top);
  const total = series.reduce((a, s) => a + s.y, 0);
  const labelEvery = Math.ceil(series.length / 6);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <button className="text-xs text-gray-500 hover:text-gray-800 underline" onClick={() => setShowTable((s) => !s)}>
          {showTable ? 'Chart' : 'Table'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-2">Total {format(total)}</p>
      {showTable ? (
        <div className="max-h-52 overflow-auto border rounded-md">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50"><tr><th className="text-left px-2 py-1">Date</th><th className="text-right px-2 py-1">Value</th></tr></thead>
            <tbody>{series.map((s) => <tr key={s.x} className="border-t"><td className="px-2 py-1">{s.x}</td><td className="px-2 py-1 text-right tabular-nums">{format(s.y)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${title}, total ${format(total)}`}
            onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
                <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#6b7280">{compact(t)}</text>
              </g>
            ))}
            {series.map((s, i) => {
              const cx = padL + band * i + band / 2;
              const h = Math.max(0, y(0) - y(s.y));
              const r = Math.min(4, bw / 2, h);
              const x0 = cx - bw / 2, yTop = y(s.y), yBase = y(0);
              // rounded data-end, square at the baseline
              const d = h > 0
                ? `M${x0},${yBase} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + bw - r} Q${x0 + bw},${yTop} ${x0 + bw},${yTop + r} V${yBase} Z`
                : '';
              return (
                <g key={s.x} onMouseEnter={() => setHover(i)}>
                  <rect x={padL + band * i} y={padT} width={band} height={H - padT - padB} fill="transparent" />
                  {d && <path d={d} fill={SERIES_COLOR} opacity={hover === null || hover === i ? 1 : 0.45} />}
                  {i % labelEvery === 0 && (
                    <text x={cx} y={H - 6} textAnchor="middle" fontSize={10} fill="#6b7280">{s.x.slice(5)}</text>
                  )}
                </g>
              );
            })}
          </svg>
          {hover !== null && series[hover] && (
            <div className="pointer-events-none absolute -top-2 bg-gray-900 text-white text-xs rounded px-2 py-1 shadow"
              style={{ left: `${((padL + band * hover + band / 2) / W) * 100}%`, transform: 'translate(-50%, -100%)' }}>
              <div className="text-gray-300">{series[hover].x}</div>
              <div className="font-medium tabular-nums">{format(series[hover].y)}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const out = [];
  for (let v = 0; v <= max + step * 0.999; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

const compact = (v: number) =>
  v >= 10000 ? `${Math.round(v / 1000)}K` : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
