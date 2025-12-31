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

async function getApprovedEvents() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from('events')
    .select('id,title,event_date')
    .eq('status', 'approved')
    .order('title', { ascending: true });

  return data ?? [];
}
export default async function AdminExportsPage() {
  await requireAdmin();
  const events = await getApprovedEvents();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Exports</h1>
        <p className="mt-1 text-sm text-slate-400">
          Export data as CSV files compatible with Excel. All exports are logged.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <form
          action="/api/admin/exports"
          method="post"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <input type="hidden" name="exportType" value="registrations" />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Registrations</h2>
            <p className="text-xs text-slate-400">
              Export all registrations with user and event details.
            </p>
            <button
              type="submit"
              className="w-full rounded-md bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600"
            >
              Export CSV
            </button>
          </div>
        </form>

        <form
          action="/api/admin/exports"
          method="post"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <input type="hidden" name="exportType" value="attendance" />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Attendance</h2>
            <p className="text-xs text-slate-400">
              Export all attendance records with check-in times.
            </p>
            <button
              type="submit"
              className="w-full rounded-md bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600"
            >
              Export CSV
            </button>
          </div>
        </form>

        <form action="/api/admin/exports" method="post" className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <input type="hidden" name="exportType" value="manual_registrations" />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Manual Registrations</h2>
            <p className="text-xs text-slate-400">
              Export only manually created registrations.
            </p>
            <button
              type="submit"
              className="w-full rounded-md bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600"
            >
              Export CSV
            </button>
          </div>
        </form>

        <form
          action="/api/admin/exports"
          method="post"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <input type="hidden" name="exportType" value="payments" />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Payments</h2>
            <p className="text-xs text-slate-400">
              Export all payment records with Razorpay details.
            </p>
            <button
              type="submit"
              className="w-full rounded-md bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600"
            >
              Export CSV
            </button>
          </div>
        </form>

        <form
          action="/api/admin/exports"
          method="post"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <input type="hidden" name="exportType" value="users" />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Users</h2>
            <p className="text-xs text-slate-400">
              Export all user profiles with roles.
            </p>
            <button
              type="submit"
              className="w-full rounded-md bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600"
            >
              Export CSV
            </button>
          </div>
        </form>

        <form
          action="/api/admin/exports"
          method="post"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <input type="hidden" name="exportType" value="event_detailed" />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Event Detailed Export</h2>
            <p className="text-xs text-slate-400">
              Export a single event with all registrations and custom field responses (including file URLs).
            </p>
            <select
              name="eventId"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              defaultValue={events[0]?.id ?? ''}
            >
              <option value="" disabled>
                Select event
              </option>
              {events.map((event: any) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                  {event.event_date
                    ? ` • ${new Date(event.event_date as string).toLocaleDateString()}`
                    : ''}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full rounded-md bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600"
            >
              Export Event CSV
            </button>
          </div>
        </form>
      </div>

      {/* Info section */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-400">
        <p className="font-semibold text-slate-300 mb-2">Export Information:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>All exports are in CSV format, compatible with Microsoft Excel</li>
          <li>Files include proper headers and formatted data</li>
          <li>Special characters are properly escaped for Excel compatibility</li>
          <li>Exports are logged in audit logs for compliance</li>
          <li>Filenames include date: {`export-type-YYYY-MM-DD.csv`}</li>
        </ul>
      </div>
    </div>
  );
}
