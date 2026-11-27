import { useState } from 'react';
import { listAdminUsers, updateAdminUser, type AdminUserRow } from '../../../api/adminConsole';
import { getErrorMessage } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { PageLoader } from '../../ui/PageStatus';
import { Notice, PanelHeader, Pager, StatusBadge, fmtDate, inputCls, useAdminData, useDebounced } from './shared';

const ROLES = ['user', 'customer', 'admin', 'guide', 'tour_operator', 'hotel_manager', 'transport_manager'];

export function UsersPanel() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState('');
  const [actionError, setActionError] = useState('');
  const q = useDebounced(search);
  const { data, loading, error, setData } = useAdminData(
    () => listAdminUsers({ search: q, role, status, page, limit: 25 }),
    [q, role, status, page]
  );

  const apply = async (u: AdminUserRow, change: { role?: string; active?: boolean }, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setActionError('');
    try {
      const updated = await updateAdminUser(u._id, change);
      setData((d) => d && { ...d, data: d.data.map((x) => (x._id === u._id ? { ...x, ...updated, bookingsCount: x.bookingsCount } : x)) });
      setMsg(`${u.email}: ${change.role ? `role → ${change.role}` : change.active ? 'reactivated' : 'suspended'}`);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Update failed'));
    }
  };

  return (
    <div>
      <PanelHeader title="Users" subtitle="Change roles or suspend accounts. Suspended users cannot sign in. Every change is recorded in the audit log." />
      {msg && <Notice kind="success">{msg}</Notice>}
      {(error || actionError) && <Notice kind="error">{error || actionError}</Notice>}
      <div className="flex flex-wrap gap-2 mb-3">
        <input className={`${inputCls} w-64`} placeholder="Search name or email…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search users" />
        <select className={inputCls} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Role">
          <option value="">All roles</option>{ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
        </select>
        <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
          <option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option>
        </select>
      </div>

      {loading && !data ? <PageLoader message="Loading users..." /> : data && (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <tr><th className="px-3 py-2">User</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Bookings</th><th className="px-3 py-2">Joined</th><th className="px-3 py-2" /></tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((u) => {
                  const self = u._id === me?._id;
                  return (
                    <tr key={u._id}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{u.FirstName} {u.LastName}{self && <span className="ml-1 text-xs text-gray-500">(you)</span>}</div>
                        <div className="text-xs text-gray-500">{u.email}{!u.isVerified && ' · unverified'}</div>
                      </td>
                      <td className="px-3 py-2">
                        <select className={inputCls} value={u.role} disabled={self} aria-label={`Role for ${u.email}`}
                          onChange={(e) => apply(u, { role: e.target.value }, `Change ${u.email} from ${u.role} to ${e.target.value}?`)}>
                          {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={u.active ? 'active' : 'suspended'} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{u.bookingsCount ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(u.createdAt)}</td>
                      <td className="px-3 py-2 text-right">
                        {!self && (u.active ? (
                          <button className="text-xs text-red-700 border border-red-200 rounded px-2 py-1 hover:bg-red-50"
                            onClick={() => apply(u, { active: false }, `Suspend ${u.email}? They will be signed out and unable to sign in.`)}>Suspend</button>
                        ) : (
                          <button className="text-xs text-green-800 border border-green-200 rounded px-2 py-1 hover:bg-green-50"
                            onClick={() => apply(u, { active: true }, `Reactivate ${u.email}?`)}>Reactivate</button>
                        ))}
                      </td>
                    </tr>
                  );
                })}
                {!data.data.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">No users match.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
