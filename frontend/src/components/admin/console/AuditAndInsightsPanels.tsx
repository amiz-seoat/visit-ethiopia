import { useState } from 'react';
import { getAssistantInsights, listAuditLog } from '../../../api/adminConsole';
import { PageLoader } from '../../ui/PageStatus';
import { Notice, PanelHeader, Pager, fmtDate, inputCls, useAdminData } from './shared';

const ACTION_LABELS: Record<string, string> = {
  'user.updated': 'Updated user',
  'payment.refund_review_resolved': 'Resolved payment review',
  'payment.verified': 'Re-checked payment with Chapa',
};

function describe(details: Record<string, unknown>) {
  const d = details as { before?: Record<string, unknown>; after?: Record<string, unknown>; resolution?: string; note?: string; outcome?: string };
  if (d.after) {
    return Object.entries(d.after)
      .map(([k, v]) => `${k}: ${String(d.before?.[k])} → ${String(v)}`)
      .join(', ');
  }
  if (d.resolution) return `${d.resolution.replace(/_/g, ' ')}${d.note ? ` — ${d.note}` : ''}`;
  if (d.outcome) return `outcome: ${d.outcome}`;
  return '';
}

export function AuditLogPanel() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAdminData(() => listAuditLog({ page, limit: 30 }), [page]);
  return (
    <div>
      <PanelHeader title="Audit log" subtitle="Privileged admin actions (role changes, suspensions, payment reviews). Booking lifecycle events are in each booking's history." />
      {error && <Notice kind="error">{error}</Notice>}
      {loading && !data ? <PageLoader message="Loading audit log..." /> : data && (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Admin</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Details</th></tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((r) => (
                  <tr key={r._id}>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtDate(r.createdAt, true)}</td>
                    <td className="px-3 py-2 text-xs">{r.actorEmail || r.actorId}</td>
                    <td className="px-3 py-2">{ACTION_LABELS[r.action] || r.action}</td>
                    <td className="px-3 py-2 text-xs"><span className="text-gray-500">{r.targetType}</span> <span className="font-mono">{r.targetId.slice(-8).toUpperCase()}</span></td>
                    <td className="px-3 py-2 text-xs text-gray-700">{describe(r.details)}</td>
                  </tr>
                ))}
                {!data.data.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">No admin actions recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

export function AssistantInsightsPanel() {
  const [days, setDays] = useState(30);
  const { data, loading, error } = useAdminData(() => getAssistantInsights(days), [days]);
  return (
    <div>
      <PanelHeader title="Travel assistant" subtitle="What visitors ask the AI travel assistant. Questions it could not answer show gaps in the knowledge base."
        actions={
          <select className={inputCls} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
          </select>
        } />
      {error && <Notice kind="error">{error}</Notice>}
      {loading && !data ? <PageLoader message="Loading..." /> : data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile label="Questions" value={data.total.toLocaleString()} />
            <Tile label="Unanswered" value={data.unanswered.toLocaleString()}
              sub={data.total ? `${Math.round((data.unanswered / data.total) * 100)}% of questions` : undefined} />
            <Tile label="Avg response time" value={data.avgLatencyMs != null ? `${(data.avgLatencyMs / 1000).toFixed(1)} s` : '—'} />
            <Tile label="AI vs. search-only" value={`${data.byMode.llm || 0} / ${data.byMode.retrieval || 0}`}
              sub="search-only = no LLM key or provider unavailable" />
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Recent unanswered questions</h3>
              {data.recentUnanswered.length ? (
                <ul className="divide-y border rounded-lg">
                  {data.recentUnanswered.map((q) => (
                    <li key={q.id} className="px-3 py-2 text-sm"><p className="text-gray-800">{q.question}</p>
                      <p className="text-xs text-gray-500">{fmtDate(q.createdAt, true)}</p></li>
                  ))}
                </ul>
              ) : <p className="text-sm text-gray-500">None. The assistant found sources for every question.</p>}
            </section>
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Most-cited sources</h3>
              {data.topSources.length ? (
                <ol className="divide-y border rounded-lg">
                  {data.topSources.map((s) => (
                    <li key={s.id} className="flex justify-between px-3 py-2 text-sm"><span className="font-mono text-xs text-gray-700">{s.id}</span>
                      <span className="tabular-nums">{s.count}</span></li>
                  ))}
                </ol>
              ) : <p className="text-sm text-gray-500">No questions yet.</p>}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
