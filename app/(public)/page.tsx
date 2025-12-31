import { getSupabaseServerClient } from '@/lib/supabase-server';
import Link from 'next/link';

export const revalidate = 60;

const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';

type EventCard = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  price: number;
  is_paid: boolean;
};

export default async function HomePage() {
  const supabase = getSupabaseServerClient();

  const { data: featured } = await supabase
    .from('events')
    .select('id,title,description,event_date,location,price,is_paid')
    .eq('status', 'approved')
    .order('event_date', { ascending: true })
    .limit(3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-12 grid gap-8 md:grid-cols-[3fr,2fr]">
        <div>
          <h1 className="mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
            University Event Management
          </h1>
          <p className="mb-6 max-w-xl text-sm text-slate-300">
            Discover, register, and manage events across the university with secure
            payment handling, real-time capacity protection, and QR-based
            attendance.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300">
          <h2 className="mb-2 text-sm font-semibold text-white">System guarantees</h2>
          <ul className="space-y-1 list-disc list-inside">
            <li>Capacity-safe registrations</li>
            <li>Razorpay-verified payments only</li>
            <li>QR + entry code attendance</li>
            <li>Admin audit logging</li>
          </ul>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Featured events</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {featured?.map((event: EventCard) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="group rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm hover:border-slate-600"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium text-white group-hover:text-sky-300">
                  {event.title}
                </h3>
              </div>
              <p className="mb-3 line-clamp-3 text-xs text-slate-300">
                {event.description}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{new Date(event.event_date).toLocaleDateString()}</span>
                <span>
                  {event.is_paid ? `₹${event.price}` : 'Free'}
                  {!PAYMENTS_ENABLED && event.is_paid && ' · payments disabled (test mode)'}
                </span>
              </div>
            </Link>
          ))}
          {featured?.length === 0 && (
            <p className="text-sm text-slate-400">No upcoming events.</p>
          )}
        </div>
      </section>
    </div>
  );
}
