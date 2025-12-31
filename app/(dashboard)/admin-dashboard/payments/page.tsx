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

async function getPaymentsData(statusFilter: string | null, eventFilter: string | null) {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from('payments')
    .select(
      `id,amount,status,razorpay_order_id,razorpay_payment_id,razorpay_signature,created_at,
       registration:registrations(id,status,entry_code,event_id,user_id),
       event:events(id,title,is_paid,price),
       user:profiles(id,full_name)`
    )
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  if (eventFilter && eventFilter !== 'all') {
    query = query.eq('event_id', eventFilter);
  }

  const { data } = await query;
  return data ?? [];
}

async function getEvents() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from('events')
    .select('id,title')
    .eq('is_paid', true)
    .order('title', { ascending: true });
  return data ?? [];
}

interface SearchParams {
  status?: string;
  event?: string;
}

export default async function AdminPaymentsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const statusFilter = searchParams?.status ?? 'all';
  const eventFilter = searchParams?.event ?? 'all';
  
  const [payments, events] = await Promise.all([
    getPaymentsData(statusFilter, eventFilter),
    getEvents()
  ]);

  const paymentsEnabled = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';

  // Detect payment success but missing registration
  const suspiciousPayments = payments.filter(
    (p: any) => p.status === 'SUCCESS' && (!p.registration || p.registration?.status !== 'CONFIRMED')
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Payments</h1>
          <p className="mt-1 text-sm text-slate-400">
            View all payments, filter by status and event, and detect payment anomalies.
          </p>
        </div>
        <form className="w-full max-w-xs">
          <select
            name="status"
            defaultValue={statusFilter}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="CREATED">Created</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
          </select>
        </form>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <form className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Status</label>
            <select
              name="status"
              defaultValue={statusFilter}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Status</option>
              <option value="CREATED">Created</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
          
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Event</label>
            <select
              name="event"
              defaultValue={eventFilter}
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
          
          <div className="flex items-end md:col-span-2">
            <button
              type="submit"
              className="w-full rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </div>

      {/* Payment mode banner */}
      <div
        className={`flex items-center justify-between rounded-lg border px-4 py-3 text-xs ${
          paymentsEnabled
            ? 'border-emerald-700 bg-emerald-900/20 text-emerald-200'
            : 'border-amber-700 bg-amber-900/20 text-amber-100'
        }`}
      >
        <div>
          <p className="font-semibold">Payment system status</p>
          <p className="mt-0.5 text-[11px]">
            {paymentsEnabled
              ? 'LIVE MODE – real payments are being processed.'
              : 'TEST MODE – payments are disabled or running in sandbox mode.'}
          </p>
        </div>
        <span className="rounded-full bg-black/20 px-3 py-1 text-[11px] font-medium uppercase tracking-wide">
          {paymentsEnabled ? 'Live mode' : 'Test mode'}
        </span>
      </div>

      {/* Suspicious payments warning */}
      {suspiciousPayments.length > 0 && (
        <div className="rounded-lg border border-red-700 bg-red-900/20 px-4 py-3 text-xs text-red-200">
          <p className="font-semibold">Suspicious payments detected</p>
          <p className="mt-0.5 text-[11px]">
            {suspiciousPayments.length} payment(s) marked as SUCCESS but registration is missing or not confirmed.
          </p>
        </div>
      )}

      {payments.length === 0 ? (
        <p className="text-sm text-slate-400">No payments found.</p>
      ) : (
        <div className="space-y-3 text-sm">
          {payments.map((payment: any) => {
            const isSuspicious = payment.status === 'SUCCESS' && (!payment.registration || payment.registration?.status !== 'CONFIRMED');
            
            return (
              <div
                key={payment.id}
                className={`rounded-xl border bg-slate-900/60 p-4 ${
                  isSuspicious ? 'border-red-700/50' : 'border-slate-800'
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-white">
                        ₹{payment.amount}
                      </h2>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                        payment.status === 'SUCCESS'
                          ? 'bg-emerald-700/30 text-emerald-300'
                          : payment.status === 'FAILED'
                          ? 'bg-red-700/30 text-red-300'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {payment.status}
                      </span>
                      {isSuspicious && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide bg-red-700/30 text-red-300">
                          Suspicious
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300">
                      {payment.event?.title ?? 'Event'} · {payment.user?.full_name ?? 'User'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Registration: {payment.registration?.entry_code ?? 'Missing'}
                    </p>
                    <div className="space-y-0.5 text-[11px] text-slate-500">
                      {payment.razorpay_order_id && (
                        <p>Order ID: {payment.razorpay_order_id}</p>
                      )}
                      {payment.razorpay_payment_id && (
                        <p>Payment ID: {payment.razorpay_payment_id}</p>
                      )}
                      <p>Created: {new Date(payment.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {payment.registration && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide bg-slate-800 text-slate-300">
                        Reg #{payment.registration.id.slice(0, 8)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
