import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const eventInput = body?.event;
    const formFields = (body?.form_fields ?? []) as any[];

    if (!eventInput) {
      return NextResponse.json({ success: false, error: 'Missing event payload' }, { status: 400 });
    }

    if (!eventInput.title || !eventInput.event_date || !eventInput.start_time || !eventInput.end_time) {
      return NextResponse.json({ success: false, error: 'Missing required event fields' }, { status: 400 });
    }

    // Basic server-side validation for times
    const start = new Date(`2000-01-01T${eventInput.start_time}`);
    const end = new Date(`2000-01-01T${eventInput.end_time}`);
    if (!(start instanceof Date) || !(end instanceof Date) || isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ success: false, error: 'End time must be after start time' }, { status: 400 });
    }

    if (!eventInput.capacity || eventInput.capacity <= 0) {
      return NextResponse.json({ success: false, error: 'Capacity must be greater than 0' }, { status: 400 });
    }

    // Insert event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        title: eventInput.title,
        description: eventInput.description,
        location: eventInput.location,
        event_date: eventInput.event_date,
        start_time: eventInput.start_time,
        end_time: eventInput.end_time,
        capacity: eventInput.capacity,
        is_registration_open: !!eventInput.is_registration_open,
        price: eventInput.price ?? 0,
        status: eventInput.status ?? 'approved',
        created_by: user.id,
        assigned_organizer: eventInput.assigned_organizer ?? null
      })
      .select()
      .single();

    if (eventError || !event) {
      console.error('Failed to insert event', eventError);
      return NextResponse.json({ success: false, error: 'Failed to create event' }, { status: 500 });
    }

    const overrideChanges: any[] = [];

    if (Array.isArray(formFields) && formFields.length > 0) {
      const nowIso = new Date().toISOString();

      const insertPayload = formFields.map((field) => {
        const required = !!field.required;
        const disabled = !!field.disabled;
        const originalRequired =
          typeof field.original_required === 'boolean' ? field.original_required : required;

        const isOverridden = originalRequired !== required;

        if (disabled || isOverridden) {
          overrideChanges.push({
            label: field.label,
            field_type: field.field_type,
            disabled,
            original_required: originalRequired,
            required
          });
        }

        return {
          event_id: event.id,
          label: field.label,
          field_type: field.field_type,
          required,
          options: field.options ?? null,
          disabled,
          disabled_by: disabled ? user.id : null,
          disabled_at: disabled ? nowIso : null,
          original_required: originalRequired,
          overridden_by: isOverridden ? user.id : null,
          overridden_at: isOverridden ? nowIso : null
        };
      });

      const { error: fieldsError } = await supabase
        .from('event_form_fields')
        .insert(insertPayload);

      if (fieldsError) {
        console.error('Failed to insert form fields', fieldsError);
        return NextResponse.json({ success: false, error: 'Failed to create form fields' }, { status: 500 });
      }
    }

    // Log admin action (including overrides summary, if any)
    const { error: logError } = await supabase.from('admin_logs').insert({
      admin_id: user.id,
      action: 'CREATE_EVENT',
      details: {
        event_id: event.id,
        override_changes: overrideChanges
      }
    });

    if (logError) {
      console.error('Failed to log admin action', logError);
    }

    return NextResponse.json({ success: true, event }, { status: 200 });
  } catch (error: any) {
    console.error('create-event API error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
