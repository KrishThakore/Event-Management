import { getSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { ViewTicketButton } from './ViewTicketButton';

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

async function getRegistrations(search: string | null, eventId: string | null, status: string | null, paymentType: string | null, sourceType: string | null) {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from('registrations')
    .select(
      `id,status,entry_code,created_at,event_id,user_id,
       event:events(id,title,is_paid,price),
       user:profiles(id,full_name,email)`
    )
    .order('created_at', { ascending: false });

  // Apply filters
  if (eventId && eventId !== 'all') {
    query = query.eq('event_id', eventId);
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (paymentType && paymentType !== 'all') {
    if (paymentType === 'paid') {
      query = query.eq('event.is_paid', true);
    } else if (paymentType === 'free') {
      query = query.eq('event.is_paid', false);
    }
  }

  if (sourceType && sourceType !== 'all') {
    if (sourceType === 'manual') {
      query = query.like('entry_code', 'MANUAL-%');
    } else if (sourceType === 'auto') {
      query = query.not('entry_code', 'like', 'MANUAL-%');
    }
  }

  if (search && search.trim().length > 0) {
    // Search by entry code, user full name, or email using the underlying profiles table
    query = query.or(
      `entry_code.ilike.%${search}%,profiles.full_name.ilike.%${search}%,profiles.email.ilike.%${search}%`
    ) as any;
  }

  const { data } = await query;
  return data ?? [];
}

async function registrationsAction(formData: FormData) {
  'use server';

  const action = formData.get('action') as string | null;
  const registrationId = formData.get('registrationId') as string | null;

  if (!action || !registrationId) {
    redirect('/admin-dashboard/registrations');
  }

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

  const { data: registration } = await supabase
    .from('registrations')
    .select('id,status,entry_code,event_id,user_id')
    .eq('id', registrationId)
    .single();

  if (!registration) {
    redirect('/admin-dashboard/registrations');
  }

  let newStatus: 'CONFIRMED' | 'CANCELLED' | null = null;
  let logAction = '';

  if (action === 'confirm') {
    newStatus = 'CONFIRMED';
    logAction = 'REG_CONFIRM';
  } else if (action === 'cancel') {
    newStatus = 'CANCELLED';
    logAction = 'REG_CANCEL';
  } else if (action === 'force_confirm') {
    newStatus = 'CONFIRMED';
    logAction = 'REG_FORCE_CONFIRM';
  }

  if (newStatus) {
    await supabase
      .from('registrations')
      .update({ status: newStatus })
      .eq('id', registrationId);

    await supabase.from('admin_logs').insert({
      admin_id: user.id,
      action: logAction,
      details: {
        registration_id: registration.id,
        event_id: registration.event_id,
        user_id: registration.user_id,
        previous_status: registration.status,
        new_status: newStatus
      }
    });
  }

  redirect('/admin-dashboard/registrations');
}

async function getEvents() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from('events')
    .select('id,title')
    .order('title', { ascending: true });
  return data ?? [];
}

interface SearchParams {
  search?: string;
  event?: string;
  status?: string;
  paymentType?: string;
  sourceType?: string;
}

export default async function AdminRegistrationsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const search = searchParams?.search ?? null;
  const eventId = searchParams?.event ?? null;
  const status = searchParams?.status ?? null;
  const paymentType = searchParams?.paymentType ?? null;
  const sourceType = searchParams?.sourceType ?? null;
  
  const [registrations, events] = await Promise.all([
    getRegistrations(search, eventId, status, paymentType, sourceType),
    getEvents()
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Registrations</h1>
          <p className="mt-1 text-sm text-slate-400">
            View and manage registrations. Confirm, cancel, and inspect tickets.
          </p>
        </div>
        <form className="w-full max-w-xs">
          <input
            type="text"
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by name, email, or entry code"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          />
        </form>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <form className="grid gap-3 md:grid-cols-5">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Event</label>
            <select
              name="event"
              defaultValue={eventId ?? 'all'}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Events</option>
              {events.map((event: any) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Status</label>
            <select
              name="status"
              defaultValue={status ?? 'all'}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Payment Type</label>
            <select
              name="paymentType"
              defaultValue={paymentType ?? 'all'}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Types</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Source</label>
            <select
              name="sourceType"
              defaultValue={sourceType ?? 'all'}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Sources</option>
              <option value="auto">Auto</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </div>

      {registrations.length === 0 ? (
        <p className="text-sm text-slate-400">No registrations found.</p>
      ) : (
        <div className="space-y-3 text-sm">
          {registrations.map((reg: any) => (
            <div
              key={reg.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white">
                      {reg.event?.title ?? 'Event'}
                    </h2>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-200 bg-slate-800">
                      {reg.status}
                    </span>
                    {reg.event?.is_paid && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-100 bg-amber-900/60">
                        Paid
                      </span>
                    )}
                    {reg.entry_code?.startsWith('MANUAL-') && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-blue-100 bg-blue-900/60">
                        Manual
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">
                    {reg.user?.full_name ?? 'User'} · {reg.user?.email ?? 'No email'} · Entry code:{' '}
                    {reg.entry_code ?? 'N/A'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Registered on {new Date(reg.created_at).toLocaleString()}
                    {reg.event?.price && reg.event.is_paid && ` · Price: ₹${reg.event.price}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <form action={registrationsAction}>
                    <input type="hidden" name="registrationId" value={reg.id} />
                    <div className="flex flex-wrap gap-2">
                      {reg.status !== 'CONFIRMED' && (
                        <button
                          type="submit"
                          name="action"
                          value="confirm"
                          className="rounded-md bg-emerald-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-600"
                        >
                          Confirm
                        </button>
                      )}
                      {reg.status !== 'CANCELLED' && (
                        <button
                          type="submit"
                          name="action"
                          value="cancel"
                          className="rounded-md bg-red-800 px-3 py-1 text-[11px] font-medium text-red-50 hover:bg-red-700"
                        >
                          Cancel
                        </button>
                      )}
                      {reg.status === 'PENDING' && (
                        <button
                          type="submit"
                          name="action"
                          value="force_confirm"
                          className="rounded-md bg-amber-700 px-3 py-1 text-[11px] font-medium text-amber-50 hover:bg-amber-600"
                        >
                          Force Confirm
                        </button>
                      )}
                    </div>
                  </form>
                  <ViewTicketButton registration={reg} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
