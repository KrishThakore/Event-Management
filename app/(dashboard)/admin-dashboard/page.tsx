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

  return { user, profile };
}

async function getAdminOverviewMetrics() {
  const supabase = getSupabaseServerClient();

  const [{ data: usersCount }, { data: events }, { count: registrationsCount }, { count: attendanceTodayCount }] =
    await Promise.all([
      supabase.rpc('get_total_users_count'),
      supabase
        .from('events')
        .select('id,status,event_date,capacity,is_paid')
        .order('event_date', { ascending: true }),
      supabase.from('registrations').select('*', { count: 'exact', head: true }),
      supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .gte('checked_in_at', new Date(new Date().setHours(0,0,0,0)).toISOString())
    ]);

  const totalEvents = (events ?? []).length;
  const draftEvents = (events ?? []).filter((e) => e.status === 'draft').length;
  const approvedEvents = (events ?? []).filter((e) => e.status === 'approved').length;
  const cancelledEvents = (events ?? []).filter((e) => e.status === 'cancelled').length;

  const now = new Date();
  const upcomingEvents = (events ?? []).filter((e) => new Date(e.event_date as string) >= now).length;

  const totalCapacity = (events ?? []).reduce((sum, e) => sum + (e.capacity ?? 0), 0);

  // Capacity utilization placeholder (without heavy joins)
  const capacityUtilization = totalCapacity > 0 ? Math.min(100, Math.round(((registrationsCount ?? 0) / totalCapacity) * 100)) : 0;

  // Paid vs free events count
  const paidEvents = (events ?? []).filter((e) => e.is_paid === true).length;
  const freeEvents = (events ?? []).filter((e) => e.is_paid !== true).length;

  const paymentsEnabled = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';

  return {
    usersCount: usersCount ?? 0,
    totalEvents,
    draftEvents,
    approvedEvents,
    cancelledEvents,
    upcomingEvents,
    registrationsCount: registrationsCount ?? 0,
    attendanceTodayCount: attendanceTodayCount ?? 0,
    capacityUtilization,
    paidEvents,
    freeEvents,
    paymentsEnabled
  };
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const metrics = await getAdminOverviewMetrics();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Admin Overview</h1>
        <p className="mt-1 text-sm text-slate-400">System health and key metrics at a glance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <OverviewCard label="Total users" value={metrics.usersCount} />
        <OverviewCard
          label="Events (draft / approved / cancelled)"
          value={`${metrics.totalEvents}`}
          helper={`${metrics.draftEvents} draft • ${metrics.approvedEvents} approved • ${metrics.cancelledEvents} cancelled`}
        />
        <OverviewCard label="Upcoming events" value={metrics.upcomingEvents} />
        <OverviewCard label="Total registrations" value={metrics.registrationsCount} />
        <OverviewCard label="Today's attendance" value={metrics.attendanceTodayCount} />
        <OverviewCard label="Capacity utilization" value={`${metrics.capacityUtilization}%`} />
        <OverviewCard
          label="Paid vs free events"
          value={`${metrics.paidEvents} / ${metrics.freeEvents}`}
          helper={`${metrics.paidEvents} paid • ${metrics.freeEvents} free`}
        />
      </div>

      <div className="mt-4">
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-xs ${
            metrics.paymentsEnabled
              ? 'border-emerald-700 bg-emerald-900/20 text-emerald-200'
              : 'border-amber-700 bg-amber-900/20 text-amber-100'
          }`}
        >
          <div>
            <p className="font-semibold">Payment system status</p>
            <p className="mt-0.5 text-[11px]">
              {metrics.paymentsEnabled
                ? 'LIVE MODE – real payments are being processed.'
                : 'TEST MODE – payments are disabled or running in sandbox mode.'}
            </p>
          </div>
          <span className="rounded-full bg-black/20 px-3 py-1 text-[11px] font-medium uppercase tracking-wide">
            {metrics.paymentsEnabled ? 'Live mode' : 'Test mode'}
          </span>
        </div>
      </div>
    </div>
  );
}

function OverviewCard({
  label,
  value,
  helper
}: {
  label: string;
  value: number | string;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      {helper && <p className="mt-1 text-[11px] text-slate-400">{helper}</p>}
    </div>
  );
}
