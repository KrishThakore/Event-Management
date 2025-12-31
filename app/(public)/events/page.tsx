import { getSupabaseServerClient } from '@/lib/supabase-server';
import Link from 'next/link';

export const revalidate = 30;

const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';

async function getEvents(params: { paid?: 'free' | 'paid' }) {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from('events')
    .select('id,title,description,event_date,location,price,is_paid,capacity,is_registration_open,status')
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .eq('status', 'approved')
    .order('event_date', { ascending: true });

  if (params.paid === 'free') {
    query = query.eq('is_paid', false);
  } else if (params.paid === 'paid') {
    query = query.eq('is_paid', true);
  }

  const { data: events } = await query;

  return events ?? [];
}

export default async function EventsPage({ searchParams }: { searchParams: { paid?: string } }) {
  const filterPaid = searchParams.paid === 'free' || searchParams.paid === 'paid' ? (searchParams.paid as 'free' | 'paid') : undefined;
  const events = await getEvents({ paid: filterPaid });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Upcoming events</h1>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Filter:</span>
          <Link
            href="/events"
            className={`rounded-full px-3 py-1 ${!filterPaid ? 'bg-sky-600 text-white' : 'border border-slate-700 text-slate-300'}`}
          >
            All
          </Link>
          <Link
            href="/events?paid=free"
            className={`rounded-full px-3 py-1 ${filterPaid === 'free' ? 'bg-sky-600 text-white' : 'border border-slate-700 text-slate-300'}`}
          >
            Free
          </Link>
          <Link
            href="/events?paid=paid"
            className={`rounded-full px-3 py-1 ${filterPaid === 'paid' ? 'bg-sky-600 text-white' : 'border border-slate-700 text-slate-300'}`}
          >
            Paid
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {events.map((event) => (
          <Link
            key={event.id as string}
            href={`/events/${event.id}`}
            className="group flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm hover:border-slate-600"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-medium text-white group-hover:text-sky-300">
                {event.title}
              </h2>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                {event.is_paid ? `₹${event.price}` : 'Free'}
                {!PAYMENTS_ENABLED && event.is_paid && ' · payments disabled (test mode)'}
              </span>
            </div>
            <p className="mb-3 line-clamp-3 text-xs text-slate-300">{event.description}</p>
            <div className="mt-auto flex items-center justify-between text-[11px] text-slate-400">
              <span>{new Date(event.event_date as string).toLocaleDateString()}</span>
              <span className="truncate">{event.location}</span>
            </div>
          </Link>
        ))}
        {events.length === 0 && (
          <p className="text-sm text-slate-400">No upcoming events match your filters.</p>
        )}
      </div>
    </div>
  );
}
