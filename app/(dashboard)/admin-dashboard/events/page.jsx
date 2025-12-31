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

async function getEventsWithUsage() {
  const supabase = getSupabaseServerClient();

  const { data: events } = await supabase
    .from('events')
    .select('id,title,description,location,event_date,start_time,end_time,capacity,is_registration_open,status,created_by')
    .order('event_date', { ascending: true });

  const { data: registrations } = await supabase
    .from('registrations')
    .select('event_id,status');

  const usageMap = new Map();
  for (const r of registrations ?? []) {
    const key = r.event_id;
    const entry = usageMap.get(key) ?? { pending: 0, confirmed: 0 };
    if (r.status === 'PENDING') entry.pending += 1;
    if (r.status === 'CONFIRMED') entry.confirmed += 1;
    usageMap.set(key, entry);
  }

  const { data: organizers } = await supabase
    .from('profiles')
    .select('id,full_name');

  const orgMap = new Map();
  for (const o of organizers ?? []) {
    orgMap.set(o.id, (o.full_name) ?? 'Organizer');
  }

  return (events ?? []).map((e) => {
    const usage = usageMap.get(e.id) ?? { pending: 0, confirmed: 0 };
    const total = usage.pending + usage.confirmed;
    const capacity = e.capacity ?? 0;
    const utilization = capacity > 0 ? Math.min(100, Math.round((total / capacity) * 100)) : 0;
    const seatsLeft = Math.max(0, capacity - total);

    return {
      ...e,
      organizerName: orgMap.get(e.created_by) ?? 'Unknown',
      pendingCount: usage.pending,
      confirmedCount: usage.confirmed,
      utilization,
      seatsLeft
    };
  });
}

async function handleEventAction(formData) {
  'use server';

  const action = formData.get('action');
  const eventId = formData.get('eventId');

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

  const updates = {};
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
    const title = formData.get('title');
    const event_date = formData.get('event_date');
    const start_time = formData.get('start_time');
    const end_time = formData.get('end_time');
    const location = formData.get('location');
    const capacity = formData.get('capacity');

    if (title) updates.title = title;
    if (event_date) updates.event_date = event_date;
    if (start_time) updates.start_time = start_time;
    if (end_time) updates.end_time = end_time;
    if (location) updates.location = location;
    if (capacity) updates.capacity = Number(capacity);
    
    logAction = 'EVENT_EDIT';
  } else if (action === 'manual_override') {
    const userEmail = formData.get('userEmail');
    
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
        event_id: eventId,
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
}) {
  await requireAdmin();
  const events = await getEventsWithUsage();
  const highlightEventId = typeof searchParams?.new_event === 'string' ? searchParams?.new_event : undefined;

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
          {events.map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="text-sm font-semibold text-white">{event.title}</h2>
              <p className="text-xs text-slate-300">{event.location || 'No location'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
