import { getSupabaseServerClient } from '@/lib/supabase-server';
import { RegisterClient } from './RegisterClient';
import { EventRegistrationSection } from './EventRegistrationSection';
import { redirect } from 'next/navigation';

export const revalidate = 0;

const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';

async function getEventWithCapacity(id: string) {
  const supabase = getSupabaseServerClient();

  const { data: event } = await supabase
    .from('events')
    .select('id,title,description,location,event_date,start_time,end_time,capacity,is_registration_open,is_paid,price,status')
    .eq('id', id)
    .single();

  if (!event || event.status !== 'approved') {
    return null;
  }

  const { data: formFields } = await supabase
    .from('event_form_fields')
    .select('id,label,field_type,required,options,disabled')
    .eq('event_id', id)
    .order('created_at');

  const activeFormFields = (formFields || []).filter((field: any) => !field.disabled);
  const serializedFormFields = JSON.parse(JSON.stringify(activeFormFields));

  const { count } = await supabase
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)
    .in('status', ['PENDING', 'CONFIRMED']);

  const used = count ?? 0;
  const remaining = Math.max(0, (event.capacity as number) - used);

  return { event, remaining, used, registration_form_fields: serializedFormFields };
}

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const result = await getEventWithCapacity(params.id);
  if (!result) {
    redirect('/events');
  }

  const { event, remaining, used, registration_form_fields } = result as any;

  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isLoggedIn = !!user;
  const registrationOpen = event.is_registration_open && remaining > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">{event.title}</h1>
          <p className="mb-3 text-sm text-slate-300">{event.description}</p>
          <div className="flex flex-wrap gap-3 text-xs text-slate-300">
            <span className="rounded-full bg-slate-800 px-3 py-1">
              {new Date(event.event_date as string).toLocaleDateString()} {event.start_time}–{event.end_time}
            </span>
            <span className="rounded-full bg-slate-800 px-3 py-1">{event.location}</span>
            <span className="rounded-full bg-slate-800 px-3 py-1">
              {event.is_paid ? `Paid • ₹${event.price}` : 'Free event'}
              {!PAYMENTS_ENABLED && event.is_paid && ' · payments disabled (test mode)'}
            </span>
          </div>
        </div>
        <div className="w-full max-w-xs rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">Capacity</span>
            <span className="text-xs font-medium text-slate-100">
              {used}/{event.capacity} used
            </span>
          </div>
          <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-sky-500"
              style={{ width: `${(used / event.capacity) * 100}%` }}
            />
          </div>
          <p className="mb-4 text-xs text-slate-300">
            {remaining > 0 ? `${remaining} seats left` : 'Event is full'}
          </p>
          <div className="flex flex-col gap-2 text-xs">
            <span
              className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] ${registrationOpen ? 'bg-emerald-600/20 text-emerald-300' : 'bg-red-900/30 text-red-300'}`}
            >
              {registrationOpen ? 'Registration open' : 'Registration closed'}
            </span>
            <EventRegistrationSection 
              eventId={event.id as string} 
              registrationOpen={registrationOpen} 
              isLoggedIn={isLoggedIn}
              registrationFormFields={registration_form_fields}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
