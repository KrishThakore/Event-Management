import { getSupabaseServerClient } from '@/lib/supabase-server';
import { TicketQr } from '@/components/TicketQr';
import { redirect } from 'next/navigation';

export const revalidate = 0;

const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';

async function getTicket(registrationId: string) {
  const supabase = getSupabaseServerClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: registration } = await supabase
    .from('registrations')
    .select('id,status,entry_code,event_id')
    .eq('id', registrationId)
    .single();

  if (!registration) return null;

  const { data: event } = await supabase
    .from('events')
    .select('title,location,event_date,start_time,end_time,is_paid,price')
    .eq('id', registration.event_id)
    .single();

  return { registration, event };
}

export default async function TicketPage({ params }: { params: { registrationId: string } }) {
  const data = await getTicket(params.registrationId);

  if (!data) {
    redirect('/');
  }

  const { registration, event } = data as any;

  const status = registration.status as 'PENDING' | 'CONFIRMED' | 'CANCELLED';

  const statusLabel =
    status === 'CONFIRMED' ? 'Confirmed' : status === 'PENDING' ? 'Payment processing' : 'Cancelled';
  const statusClass =
    status === 'CONFIRMED'
      ? 'bg-emerald-600/20 text-emerald-300'
      : status === 'PENDING'
      ? 'bg-amber-600/20 text-amber-300'
      : 'bg-red-900/30 text-red-300';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">Your ticket</h1>
          <p className="text-sm text-slate-300">Present this QR code at the venue for check-in.</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr,2fr]">
        <div className="space-y-3 text-sm">
          <h2 className="text-base font-semibold text-white">{event.title}</h2>
          <p className="text-slate-300">{event.location}</p>
          <p className="text-slate-300">
            {new Date(event.event_date as string).toLocaleDateString()} {event.start_time}–{event.end_time}
          </p>
          <p className="text-slate-300">
            {event.is_paid ? `Paid event • ₹${event.price}` : 'Free event'}
            {!PAYMENTS_ENABLED && event.is_paid && ' · payments disabled (test mode)'}
          </p>
          <div className="mt-4 space-y-1 text-xs text-slate-300">
            <p>
              <span className="font-semibold text-slate-100">Entry code:</span> {registration.entry_code || '—'}
            </p>
            <p className="text-[11px] text-slate-400">
              This code can be used for manual check-in if QR scanning is unavailable.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <TicketQr registrationId={registration.id as string} />
        </div>
      </div>
    </div>
  );
}
