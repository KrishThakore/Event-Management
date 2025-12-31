import { getSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

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

async function getEventsWithUsage() {
  const supabase = getSupabaseServerClient();

  const { data: events } = await supabase
    .from('events')
    .select('id,title,description,location,event_date,start_time,end_time,capacity,is_registration_open,status,created_by')
    .order('event_date', { ascending: true });

  const { data: registrations } = await supabase
    .from('registrations')
    .select('event_id,status');

  const usageMap = new Map<string, { pending: number; confirmed: number }>();
  for (const r of registrations ?? []) {
    const key = r.event_id as string;
    const entry = usageMap.get(key) ?? { pending: 0, confirmed: 0 };
    if (r.status === 'PENDING') entry.pending += 1;
    if (r.status === 'CONFIRMED') entry.confirmed += 1;
    usageMap.set(key, entry);
  }

  const { data: organizers } = await supabase
    .from('profiles')
    .select('id,full_name');

  const orgMap = new Map<string, string>();
  for (const o of organizers ?? []) {
    orgMap.set(o.id as string, (o.full_name as string) ?? 'Organizer');
  }

  return (events ?? []).map((e) => {
    const usage = usageMap.get(e.id as string) ?? { pending: 0, confirmed: 0 };
    const total = usage.pending + usage.confirmed;
    const capacity = e.capacity ?? 0;
    const utilization = capacity > 0 ? Math.min(100, Math.round((total / capacity) * 100)) : 0;
    const seatsLeft = Math.max(0, capacity - total);

    return {
      ...e,
      organizerName: orgMap.get(e.created_by as string) ?? 'Unknown',
      pendingCount: usage.pending,
      confirmedCount: usage.confirmed,
      utilization,
      seatsLeft
    };
  });
}

async function handleEventAction(formData: FormData) {
  'use server';

  const action = formData.get('action') as string | null;
  const eventId = formData.get('eventId') as string | null;

  if (!action || !eventId) {
    redirect('/admin-dashboard/events');
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

  const { data: event } = await supabase
    .from('events')
    .select('id,status,is_registration_open')
    .eq('id', eventId)
    .single();

  if (!event) {
    redirect('/admin-dashboard/events');
  }

  const updates: Record<string, any> = {};
  let logAction = '';

  if (action === 'approve') {
    updates.status = 'approved';
    logAction = 'EVENT_APPROVE';
  } else if (action === 'cancel') {
    updates.status = 'cancelled';
    updates.is_registration_open = false;
    logAction = 'EVENT_CANCEL';
  } else if (action === 'open_reg') {
    updates.is_registration_open = true;
    logAction = 'EVENT_OPEN_REG';
  } else if (action === 'close_reg') {
    updates.is_registration_open = false;
    logAction = 'EVENT_CLOSE_REG';
  } else if (action === 'emergency_disable') {
    updates.status = 'cancelled';
    updates.is_registration_open = false;
    logAction = 'EVENT_EMERGENCY_DISABLE';
  } else if (action === 'edit_event') {
    const title = formData.get('title') as string | null;
    const event_date = formData.get('event_date') as string | null;
    const start_time = formData.get('start_time') as string | null;
    const end_time = formData.get('end_time') as string | null;
    const location = formData.get('location') as string | null;
    const capacity = formData.get('capacity') as string | null;

    if (title) updates.title = title;
    if (event_date) updates.event_date = event_date;
    if (start_time) updates.start_time = start_time;
    if (end_time) updates.end_time = end_time;
    if (location) updates.location = location;
    if (capacity) updates.capacity = parseInt(capacity, 10);
    
    logAction = 'EVENT_EDIT';
  } else if (action === 'manual_override') {
    const userEmail = formData.get('userEmail') as string | null;
    
    if (!userEmail) {
      redirect('/admin-dashboard/events');
    }

    // Find user by email
    const { data: user } = await supabase
      .from('profiles')
      .select('id,full_name')
      .eq('email', userEmail)
      .single();

    if (!user) {
      redirect('/admin-dashboard/events');
    }

    // Generate manual entry code
    const entryCode = `MANUAL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create manual registration
    await supabase.from('registrations').insert({
      event_id: eventId,
      user_id: user.id,
      status: 'CONFIRMED',
      entry_code: entryCode
    });

    // Log manual override immediately
    await supabase.from('admin_logs').insert({
      admin_id: user.id,
      action: 'REG_MANUAL_OVERRIDE',
      details: {
        event_id: eventId,
        user_email: userEmail,
        entry_code: entryCode
      }
    });

    logAction = 'REG_MANUAL_OVERRIDE';
  } else if (action === 'force_close_capacity') {
    updates.is_registration_open = false;
    logAction = 'EVENT_FORCE_CLOSE_CAPACITY';
  } else if (action === 'clone_event') {
    // Get the full event data including form fields
    const { data: fullEvent } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!fullEvent) {
      redirect('/admin-dashboard/events');
    }

    // Get form fields for the event
    const { data: formFields } = await supabase
      .from('event_form_fields')
      .select('*')
      .eq('event_id', eventId);

    // Create cloned event
    const clonedEventData = {
      title: `${fullEvent.title} (Copy)`,
      description: fullEvent.description,
      location: fullEvent.location,
      event_date: new Date().toISOString().split('T')[0], // Set to today
      start_time: fullEvent.start_time,
      end_time: fullEvent.end_time,
      capacity: fullEvent.capacity,
      is_registration_open: false, // Start with registration closed
      status: 'draft',
      price: fullEvent.price,
      visibility: 'hidden',
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: clonedEvent, error: cloneError } = await supabase
      .from('events')
      .insert(clonedEventData)
      .select()
      .single();

    if (cloneError || !clonedEvent) {
      redirect('/admin-dashboard/events');
    }

    // Clone form fields if they exist
    if (formFields && formFields.length > 0) {
      const clonedFormFields = formFields.map(field => ({
        event_id: clonedEvent.id,
        label: field.label,
        field_type: field.field_type,
        required: field.required,
        options: field.options,
        disabled: false,
        original_required: field.original_required,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      await supabase
        .from('event_form_fields')
        .insert(clonedFormFields);
    }

    // Log clone action
    await supabase.from('admin_logs').insert({
      admin_id: user.id,
      action: 'EVENT_CLONE',
      details: {
        original_event_id: eventId,
        cloned_event_id: clonedEvent.id,
        original_title: fullEvent.title,
        cloned_title: clonedEventData.title
      }
    });

    logAction = 'EVENT_CLONE';
  } else if (action === 'delete') {
    await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    await supabase.from('admin_logs').insert({
      admin_id: user.id,
      action: 'EVENT_DELETE',
      details: {
        event_id: eventId
      }
    });

    logAction = 'EVENT_DELETE';
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId);

    await supabase.from('admin_logs').insert({
      admin_id: user.id,
      action: logAction,
      details: {
        event_id: event.id,
        previous_status: event.status,
        previous_is_registration_open: event.is_registration_open,
        updates
      }
    });
  }

  redirect('/admin-dashboard/events');
}

export default async function AdminEventsPage({
  searchParams
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  await requireAdmin();
  const events = await getEventsWithUsage();
  const highlightEventId = typeof searchParams?.new_event === 'string' ? searchParams?.new_event : 
                          typeof searchParams?.updated_event === 'string' ? searchParams?.updated_event : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Events</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage events, approvals, registrations, and capacity.
        </p>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-slate-400">No events found.</p>
      ) : (
        <div className="space-y-3 text-sm">
          {events.map((event: any) => (
            <details
              key={event.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-white">{event.title}</h2>
                    <p className="text-xs text-slate-300">
                      {event.location || 'No location'} ·{' '}
                      {new Date(event.event_date).toLocaleDateString()} · {event.start_time} -{' '}
                      {event.end_time}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px]">
                    <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 font-medium uppercase tracking-wide text-slate-200">
                      {event.status}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium uppercase tracking-wide ${
                        event.is_registration_open
                          ? 'bg-emerald-800/50 text-emerald-200'
                          : 'bg-red-800/40 text-red-200'
                      }`}
                    >
                      {event.is_registration_open ? 'Registrations Open' : 'Registrations Closed'}
                    </span>
                  </div>
                </div>
              </summary>
              <div className="mt-4 space-y-3 text-xs">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-slate-400">Organizer</p>
                    <p className="font-medium text-slate-100">{event.organizerName}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Capacity / Seats Left</p>
                    <p className="font-medium text-slate-100">
                      {event.capacity ?? 0} / {event.seatsLeft}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Registrations</p>
                    <p className="font-medium text-slate-100">
                      {event.confirmedCount} confirmed, {event.pendingCount} pending
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={handleEventAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="eventId" value={event.id} />
                    <Link
                      href={`/admin-dashboard/events/${event.id}/edit`}
                      className="rounded-md bg-blue-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-600 inline-block"
                    >
                      Edit Event
                    </Link>
                    <button
                      type="submit"
                      name="action"
                      value="clone_event"
                      className="rounded-md bg-purple-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-purple-600"
                    >
                      Clone Event
                    </button>
                    <button
                      type="submit"
                      name="action"
                      value={event.is_registration_open ? 'close_reg' : 'open_reg'}
                      className="rounded-md bg-sky-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-sky-600"
                    >
                      {event.is_registration_open ? 'Close Registrations' : 'Open Registrations'}
                    </button>
                    <button
                      type="submit"
                      name="action"
                      value="cancel"
                      className="rounded-md bg-amber-700 px-3 py-1 text-[11px] font-medium text-amber-50 hover:bg-amber-600"
                    >
                      Cancel Event
                    </button>
                    <button
                      type="submit"
                      name="action"
                      value="delete"
                      data-event-title={event.title}
                      className="rounded-md bg-red-800 px-3 py-1 text-[11px] font-medium text-red-50 hover:bg-red-700"
                    >
                      Delete Event
                    </button>
                  </form>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
