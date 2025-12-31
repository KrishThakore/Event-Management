import { getSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export const revalidate = 0;

async function requireAdmin() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    redirect('/');
  }

  return { user };
}

async function getAdminLogs(adminFilter: string | null, actionFilter: string | null, dateFilter: string | null) {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from('admin_logs')
    .select(
      `id,action,created_at,details,
       admin:profiles(id,full_name,email)`
    )
    .order('created_at', { ascending: false });

  if (adminFilter && adminFilter !== 'all') {
    query = query.eq('admin_id', adminFilter);
  }

  if (actionFilter && actionFilter !== 'all') {
    query = query.eq('action', actionFilter);
  }

  if (dateFilter && dateFilter !== 'all') {
    const today = new Date();
    let startDate: Date;

    if (dateFilter === 'today') {
      startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    } else if (dateFilter === 'week') {
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    } else {
      startDate = new Date(0);
    }

    query = query.gte('created_at', startDate.toISOString());
  }

  const { data } = await query;
  return data ?? [];
}

async function getAdmins() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('id,full_name,email')
    .eq('role', 'admin')
    .order('full_name');
  return data ?? [];
}

async function getUniqueActions() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from('admin_logs')
    .select('action')
    .not('action', 'is', null);
  
  const actions = [...new Set((data ?? []).map((log: any) => log.action))];
  return actions.sort();
}

interface SearchParams {
  admin?: string;
  action?: string;
  date?: string;
}

export default async function AdminLogsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const adminFilter = searchParams?.admin ?? 'all';
  const actionFilter = searchParams?.action ?? 'all';
  const dateFilter = searchParams?.date ?? 'all';
  
  const [logs, admins, actions] = await Promise.all([
    getAdminLogs(adminFilter, actionFilter, dateFilter),
    getAdmins(),
    getUniqueActions()
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-400">
          View all admin actions with full audit trail. Read-only immutable logs.
        </p>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3">
        <div>
          <label htmlFor="admin" className="block text-xs font-medium text-slate-300 mb-1">
            Admin
          </label>
          <select
            id="admin"
            name="admin"
            defaultValue={adminFilter}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          >
            <option value="all">All Admins</option>
            {admins.map((admin: any) => (
              <option key={admin.id} value={admin.id}>
                {admin.full_name || admin.email}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="action" className="block text-xs font-medium text-slate-300 mb-1">
            Action
          </label>
          <select
            id="action"
            name="action"
            defaultValue={actionFilter}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          >
            <option value="all">All Actions</option>
            {actions.map((action: string) => (
              <option key={action} value={action}>
                {action.replace(/_/g, ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="date" className="block text-xs font-medium text-slate-300 mb-1">
            Date Range
          </label>
          <select
            id="date"
            name="date"
            defaultValue={dateFilter}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">This Month</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-md bg-slate-700 px-4 py-2 text-xs font-medium text-white hover:bg-slate-600"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Logs list */}
      {logs.length === 0 ? (
        <p className="text-sm text-slate-400">No logs found matching the filters.</p>
      ) : (
        <div className="space-y-3 text-sm">
          {logs.map((log: any) => (
            <div
              key={log.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white">
                      {log.action.replace(/_/g, ' ').toUpperCase()}
                    </h2>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide bg-slate-800 text-slate-300">
                      {log.admin?.full_name || log.admin?.email || 'Unknown Admin'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                  {log.details && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-slate-300 hover:text-slate-100">
                        View Details
                      </summary>
                      <pre className="mt-2 rounded-md bg-slate-800 p-2 text-[11px] text-slate-300 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>Log ID: {log.id.slice(0, 8)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info banner */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-400">
        <p className="font-semibold text-slate-300 mb-2">About Audit Logs:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>All admin actions are automatically logged and immutable</li>
          <li>Logs include full details of actions, timestamps, and performing admin</li>
          <li>Use filters to investigate specific actions or time periods</li>
          <li>Logs cannot be deleted or modified by any admin</li>
        </ul>
      </div>
    </div>
  );
}
